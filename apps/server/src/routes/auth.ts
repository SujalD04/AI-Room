import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { generateToken, authMiddleware } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';
import { emailService } from '../services/email';

const router: Router = Router();

const USER_SELECT = {
    id: true,
    username: true,
    email: true,
    nickname: true,
    bio: true,
    avatarUrl: true,
    createdAt: true,
};

// ─── Validation Schemas ───
const registerSchema = z.object({
    username: z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(30, 'Username must be at most 30 characters')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
    email: z.string().email('Invalid email address'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be at most 128 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one digit')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

const profileUpdateSchema = z.object({
    nickname: z.string().max(50).optional().nullable(),
    bio: z.string().max(300).optional().nullable(),
    avatarUrl: z.string().max(500).optional().nullable().or(z.literal('')),
});

const changePasswordSchema = z.object({
    oldPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be at most 128 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one digit')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

const forgotPasswordSchema = z.object({
    email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
    email: z.string().email(),
    otp: z.string().length(6, 'OTP must be 6 digits'),
    newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be at most 128 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one digit')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});


// ─── POST /api/auth/register ───
router.post('/register', authRateLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.errors[0].message });
            return;
        }

        const { username, email, password } = parsed.data;

        const existing = await prisma.user.findFirst({
            where: { OR: [{ email }, { username }] },
        });

        if (existing) {
            const field = existing.email === email ? 'email' : 'username';
            res.status(409).json({ error: `A user with this ${field} already exists` });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: { username, email, passwordHash },
            select: USER_SELECT,
        });

        const token = generateToken({ userId: user.id, email: user.email });

        res.status(201).json({ user, token });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/auth/login ───
router.post('/login', authRateLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.errors[0].message });
            return;
        }

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }

        const token = generateToken({ userId: user.id, email: user.email });

        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                nickname: user.nickname,
                bio: user.bio,
                avatarUrl: user.avatarUrl,
                createdAt: user.createdAt,
            },
            token,
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/auth/me ───
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: USER_SELECT,
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({ user });
    } catch (err) {
        console.error('Me error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/auth/change-password ───
router.post('/change-password', authMiddleware, authRateLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = changePasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.errors[0].message });
            return;
        }

        const { oldPassword, newPassword } = parsed.data;
        const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const valid = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: 'Incorrect current password' });
            return;
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash },
        });

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/auth/forgot-password ───
router.post('/forgot-password', authRateLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = forgotPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.errors[0].message });
            return;
        }

        const { email } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            // Silently return success to avoid email enumeration
            res.json({ message: 'If that email exists, an OTP has been sent.' });
            return;
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        await prisma.passwordResetToken.create({
            data: { email, otp, expiresAt }
        });

        // Send the real email
        try {
            await emailService.sendOTP(email, otp);
        } catch (mailErr) {
            console.error('Email delivery failed:', mailErr);
            // We don't return 400/500 here to avoid confirming if email exists to the client, 
            // but we log it for the developer.
        }

        res.json({ message: 'If that email exists, an OTP has been sent.' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/auth/reset-password ───
router.post('/reset-password', authRateLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = resetPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.errors[0].message });
            return;
        }

        const { email, otp, newPassword } = parsed.data;

        const token = await prisma.passwordResetToken.findFirst({
            where: { email, otp },
            orderBy: { createdAt: 'desc' }
        });

        if (!token) {
            res.status(400).json({ error: 'Invalid OTP' });
            return;
        }

        if (token.expiresAt < new Date()) {
            res.status(400).json({ error: 'OTP has expired' });
            return;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash }
        });

        // Delete all tokens for this email
        await prisma.passwordResetToken.deleteMany({ where: { email } });

        res.json({ message: 'Password has been reset successfully' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PATCH /api/auth/profile ───
router.patch('/profile', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = profileUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.errors[0].message });
            return;
        }

        const updateData: any = {};
        if (parsed.data.nickname !== undefined) updateData.nickname = parsed.data.nickname || null;
        if (parsed.data.bio !== undefined) updateData.bio = parsed.data.bio || null;
        if (parsed.data.avatarUrl !== undefined) updateData.avatarUrl = parsed.data.avatarUrl || null;

        const user = await prisma.user.update({
            where: { id: req.user!.userId },
            data: updateData,
            select: USER_SELECT,
        });

        res.json({ user });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

