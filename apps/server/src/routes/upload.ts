import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authMiddleware);

// Ensure upload directory exists
const uploadDir = path.resolve(__dirname, '../../public/uploads/avatars');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uuidv4()}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, PNG, and WebP images are allowed'));
        }
    },
});

/**
 * POST /api/upload/avatar — Upload a profile picture
 */
router.post('/avatar', (req, res) => {
    upload.single('avatar')(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File size too big (max 2MB)' });
            }
            return res.status(400).json({ error: err.message });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const userId = (req as any).user.userId;
            const avatarUrl = `/uploads/avatars/${req.file.filename}`;

            // Update user's avatarUrl
            const user = await prisma.user.update({
                where: { id: userId },
                data: { avatarUrl },
                select: { id: true, username: true, email: true, nickname: true, bio: true, avatarUrl: true, createdAt: true },
            });

            res.json({ user, avatarUrl });
        } catch (dbErr: any) {
            console.error('Avatar upload error:', dbErr);
            res.status(500).json({ error: dbErr.message || 'Upload failed' });
        }
    });
});

/**
 * DELETE /api/upload/avatar — Remove a profile picture
 */
router.delete('/avatar', async (req, res) => {
    try {
        const userId = (req as any).user.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user || !user.avatarUrl) {
            return res.status(400).json({ error: 'No avatar to remove' });
        }

        // Delete the file from filesystem
        const filename = path.basename(user.avatarUrl);
        const filepath = path.join(uploadDir, filename);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }

        // Update database
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { avatarUrl: null },
            select: { id: true, username: true, email: true, nickname: true, bio: true, avatarUrl: true, createdAt: true },
        });

        res.json({ user: updatedUser, message: 'Avatar removed' });
    } catch (err: any) {
        console.error('Avatar removal error:', err);
        res.status(500).json({ error: err.message || 'Removal failed' });
    }
});

export default router;
