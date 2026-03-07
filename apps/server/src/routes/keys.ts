import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { encryptApiKey, decryptApiKey } from '../services/crypto';
import type { LLMProvider } from '@airoom/shared';

const router: Router = Router();

router.use(authMiddleware);

// ─── Validation ───
const validProviders: LLMProvider[] = [
    'openrouter', 'groq', 'gemini', 'openai', 'anthropic', 'deepseek', 'together',
];

const addKeySchema = z.object({
    provider: z.enum(validProviders as [string, ...string[]]),
    apiKey: z
        .string()
        .min(10, 'API key seems too short')
        .max(500, 'API key seems too long'),
    label: z.string().max(50).optional().default('Default'),
});

// ─── POST /api/keys — Add an API key ───
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = addKeySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.errors[0].message });
            return;
        }

        const { provider, apiKey, label } = parsed.data;
        const userId = req.user!.userId;

        // Limit keys per provider
        const existingCount = await prisma.apiKey.count({
            where: { userId, provider: provider as any },
        });
        if (existingCount >= 3) {
            res.status(429).json({ error: `Maximum 3 keys per provider (${provider})` });
            return;
        }

        // Encrypt the key
        const { encryptedKey, iv, authTag } = encryptApiKey(apiKey);

        const key = await prisma.apiKey.create({
            data: {
                userId,
                provider: provider as any,
                keyName: label,
                keyHash: encryptedKey,
                encryptedKey,
                iv,
                authTag,
                label
            },
            select: { id: true, provider: true, label: true, createdAt: true },
        });

        res.status(201).json({ key });
    } catch (err) {
        console.error('Add key error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/keys — List user's API keys (no actual keys exposed) ───
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;

        const keys = await prisma.apiKey.findMany({
            where: { userId },
            select: { id: true, provider: true, label: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ keys });
    } catch (err) {
        console.error('List keys error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── DELETE /api/keys/:keyId — Delete an API key ───
router.delete('/:keyId', async (req: Request, res: Response): Promise<void> => {
    try {
        const keyId = req.params.keyId as string;
        const userId = req.user!.userId;

        const key = await prisma.apiKey.findFirst({
            where: { id: keyId, userId },
        });

        if (!key) {
            res.status(404).json({ error: 'Key not found' });
            return;
        }

        await prisma.apiKey.delete({ where: { id: keyId } });
        res.json({ message: 'Key deleted successfully' });
    } catch (err) {
        console.error('Delete key error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
