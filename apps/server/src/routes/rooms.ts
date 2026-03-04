import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { authMiddleware, hostOnlyMiddleware } from '../middleware/auth';

const router = Router();

// All room routes require authentication
router.use(authMiddleware);

// ─── Validation Schemas ───
const createRoomSchema = z.object({
    name: z
        .string()
        .min(2, 'Room name must be at least 2 characters')
        .max(100, 'Room name must be at most 100 characters'),
    maxMembers: z.number().int().min(2).max(10).optional().default(10),
    settings: z.record(z.any()).optional().default({}),
});

// ─── Generate a URL-friendly slug ───
function generateSlug(): string {
    // 8-character random hex string
    return uuidv4().replace(/-/g, '').substring(0, 8);
}

// ─── POST /api/rooms — Create a new room ───
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = createRoomSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.errors[0].message });
            return;
        }

        const { name, maxMembers, settings } = parsed.data;
        const userId = req.user!.userId;

        // Limit rooms per user to prevent abuse
        const roomCount = await prisma.room.count({ where: { hostId: userId, isActive: true } });
        if (roomCount >= 5) {
            res.status(429).json({ error: 'You can host at most 5 active rooms' });
            return;
        }

        const slug = generateSlug();

        const room = await prisma.room.create({
            data: {
                name,
                slug,
                hostId: userId,
                maxMembers,
                settings,
                members: {
                    create: { userId, role: 'HOST' },
                },
            },
            include: {
                members: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
            },
        });

        res.status(201).json({ room });
    } catch (err) {
        console.error('Create room error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/rooms — List rooms the user is a member of ───
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;

        const rooms = await prisma.room.findMany({
            where: {
                members: { some: { userId } },
                isActive: true,
            },
            include: {
                host: { select: { id: true, username: true, avatarUrl: true } },
                _count: { select: { members: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });

        // Calculate total tokens used by the user across all messages in their rooms
        // Note: tokensUsed is stored inside the metadata JSON field of AI messages
        const tokenResult: any = await prisma.$queryRaw`
            SELECT SUM((metadata->>'tokensUsed')::int) as tokens
            FROM "MessageNode"
            WHERE "threadId" IN (
                SELECT id FROM "ConversationThread"
                WHERE "roomId" IN (
                    SELECT "roomId" FROM "RoomMember" WHERE "userId" = ${userId}
                )
            )
            AND "authorType" = 'AI'
        `;
        const totalTokens = Number(tokenResult[0]?.tokens || 0);

        res.json({ rooms, totalTokens });
    } catch (err) {
        console.error('List rooms error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/rooms/:slug — Get room details ───
router.get('/:slug', async (req: Request, res: Response): Promise<void> => {
    try {
        const { slug } = req.params;
        const userId = req.user!.userId;

        const room: any = await prisma.room.findUnique({
            where: { slug: slug as string },
            include: {
                host: { select: { id: true, username: true, avatarUrl: true } },
                members: {
                    include: { user: { select: { id: true, username: true, email: true, avatarUrl: true } } },
                },
                threads: { orderBy: { createdAt: 'desc' } },
                notes: {
                    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
                    include: {
                        author: { select: { id: true, username: true } },
                        todos: { orderBy: { order: 'asc' } },
                    },
                },
            },
        });

        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }

        // Check if user is a member
        const isMember = (room as any).members.some((m: any) => m.userId === userId);
        if (!isMember) {
            // Return limited info for non-members (for join page)
            res.json({
                room: {
                    id: room.id,
                    name: room.name,
                    slug: room.slug,
                    hostId: room.hostId,
                    host: room.host,
                    maxMembers: room.maxMembers,
                    memberCount: room.members.length,
                    isActive: room.isActive,
                    isMember: false,
                },
            });
            return;
        }

        res.json({ room: { ...room, isMember: true } });
    } catch (err) {
        console.error('Get room error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/rooms/:slug/join — Join a room ───
router.post('/:slug/join', async (req: Request, res: Response): Promise<void> => {
    try {
        const { slug } = req.params;
        const userId = req.user!.userId;

        const room: any = await prisma.room.findUnique({
            where: { slug: slug as string },
            include: { _count: { select: { members: true } } },
        });

        if (!room || !room.isActive) {
            res.status(404).json({ error: 'Room not found or inactive' });
            return;
        }

        // Check if already a member
        const existingMember = await prisma.roomMember.findUnique({
            where: { roomId_userId: { roomId: room.id, userId } },
        });

        if (existingMember) {
            res.json({ message: 'Already a member', roomSlug: room.slug });
            return;
        }

        // Check member limit
        if (room._count.members >= room.maxMembers) {
            res.status(403).json({ error: 'Room is full' });
            return;
        }

        // Add member
        await prisma.roomMember.create({
            data: { roomId: room.id, userId, role: 'MEMBER' },
        });

        res.json({ message: 'Joined room successfully', roomSlug: room.slug });
    } catch (err) {
        console.error('Join room error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/rooms/:slug/leave — Leave a room ───
router.post('/:slug/leave', async (req: Request, res: Response): Promise<void> => {
    try {
        const { slug } = req.params;
        const userId = req.user!.userId;

        const room = await prisma.room.findUnique({ where: { slug: slug as string } });
        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }

        // Host cannot leave (must delete room instead)
        if (room.hostId === userId) {
            res.status(400).json({ error: 'Host cannot leave. Transfer ownership or delete the room.' });
            return;
        }

        await prisma.roomMember.deleteMany({
            where: { roomId: room.id, userId },
        });

        res.json({ message: 'Left room successfully' });
    } catch (err) {
        console.error('Leave room error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── DELETE /api/rooms/:slug — Delete a room (host only) ───
router.delete('/:slug', async (req: Request, res: Response): Promise<void> => {
    try {
        const { slug } = req.params;
        const userId = req.user!.userId;

        const room = await prisma.room.findUnique({ where: { slug: slug as string } });
        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }

        if (room.hostId !== userId) {
            res.status(403).json({ error: 'Only the host can delete this room' });
            return;
        }

        // Soft delete
        await prisma.room.update({
            where: { id: room.id },
            data: { isActive: false },
        });

        res.json({ message: 'Room deleted successfully' });
    } catch (err) {
        console.error('Delete room error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/rooms/:slug/kick/:userId — Kick a member (host only) ───
router.post('/:slug/kick/:targetUserId', async (req: Request, res: Response): Promise<void> => {
    try {
        const { slug, targetUserId } = req.params;
        const userId = req.user!.userId;

        const room = await prisma.room.findUnique({ where: { slug: slug as string } });
        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }

        if (room.hostId !== userId) {
            res.status(403).json({ error: 'Only the host can kick members' });
            return;
        }

        if (targetUserId === userId) {
            res.status(400).json({ error: 'Cannot kick yourself' });
            return;
        }

        await prisma.roomMember.deleteMany({
            where: { roomId: room.id, userId: targetUserId as string },
        });

        res.json({ message: 'Member kicked successfully' });
    } catch (err) {
        console.error('Kick member error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
