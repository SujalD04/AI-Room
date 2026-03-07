import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { dagService } from '../services/dag';
import { prisma } from '../lib/prisma';

const router: Router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/threads — Create a new conversation thread
 */
const createThreadSchema = z.object({
    roomSlug: z.string(),
    title: z.string().min(1).max(100),
    modelConfig: z.object({
        modelId: z.string(),
        provider: z.string(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
        systemPrompt: z.string().optional(),
    }).optional().default({
        modelId: 'google/gemini-2.0-flash-exp:free',
        provider: 'openrouter',
    }),
});

router.post('/', async (req, res) => {
    try {
        const data = createThreadSchema.parse(req.body);
        const userId = (req as any).user.userId;

        // Verify room exists and user is a member
        const room = await prisma.room.findUnique({
            where: { slug: data.roomSlug },
            include: { members: { select: { userId: true } } },
        });

        if (!room || !room.isActive) {
            return res.status(404).json({ error: 'Room not found' });
        }

        if (!room.members.some((m) => m.userId === userId)) {
            return res.status(403).json({ error: 'Not a member of this room' });
        }

        // Limit threads per room (max 20)
        const threadCount = await prisma.conversationThread.count({ where: { roomId: room.id } });
        if (threadCount >= 20) {
            return res.status(400).json({ error: 'Maximum 20 threads per room reached' });
        }

        const thread = await dagService.createThread(room.id, userId, data.title, data.modelConfig);

        // Emit socket event for real-time sync
        const { io } = require('../index');
        if (io) {
            io.to(room.id).emit('room:thread_created', {
                thread: {
                    id: thread.id,
                    roomId: thread.roomId,
                    creatorId: thread.creatorId,
                    title: thread.title,
                    modelConfig: thread.modelConfig,
                    createdAt: thread.createdAt.toISOString(),
                }
            });
        }

        res.status(201).json({
            thread: {
                id: thread.id,
                roomId: thread.roomId,
                creatorId: thread.creatorId,
                title: thread.title,
                modelConfig: thread.modelConfig,
                createdAt: thread.createdAt.toISOString(),
            },
        });
    } catch (err: any) {
        if (err.name === 'ZodError') {
            return res.status(400).json({ error: 'Invalid input', details: err.errors });
        }
        console.error('Create thread error:', err);
        res.status(500).json({ error: 'Failed to create thread' });
    }
});

/**
 * GET /api/threads/:threadId/tree — Get the DAG tree for visualization
 */
router.get('/:threadId/tree', async (req, res) => {
    try {
        const { threadId } = req.params;
        const userId = (req as any).user.userId;

        // Verify user has access to this thread's room
        const thread = await prisma.conversationThread.findUnique({
            where: { id: threadId },
            include: {
                room: { include: { members: { select: { userId: true } } } },
            },
        });

        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        if (!thread.room.members.some((m) => m.userId === userId)) {
            return res.status(403).json({ error: 'Not a member of this room' });
        }

        const tree = await dagService.getThreadTree(threadId);

        // Transform for ReactFlow format
        const nodes = tree.messages.map((msg: any) => ({
            id: msg.id,
            type: msg.authorType === 'USER' ? 'userMessage' : msg.authorType === 'AI' ? 'aiMessage' : 'systemMessage',
            position: { x: 0, y: 0 }, // Client computes layout
            data: {
                id: msg.id,
                authorType: msg.authorType,
                authorName: msg.author?.username,
                modelId: msg.modelId,
                content: msg.content.substring(0, 200),
                fullContent: msg.content,
                metadata: msg.metadata,
                createdAt: msg.createdAt.toISOString(),
            },
        }));

        const edges = tree.edges.map((edge: any) => ({
            id: `${edge.parentId}-${edge.childId}`,
            source: edge.parentId,
            target: edge.childId,
            type: edge.edgeType === 'BRANCH' ? 'branch' : 'default',
            animated: edge.edgeType === 'BRANCH',
            label: edge.edgeType === 'BRANCH' ? '🌿 Branch' : undefined,
        }));

        res.json({ nodes, edges });
    } catch (err: any) {
        console.error('Get tree error:', err);
        res.status(500).json({ error: 'Failed to get thread tree' });
    }
});

/**
 * GET /api/threads/:threadId/messages — Get messages in a thread
 */
router.get('/:threadId/messages', async (req, res) => {
    try {
        const { threadId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const userId = (req as any).user.userId;

        // Verify access
        const thread = await prisma.conversationThread.findUnique({
            where: { id: threadId },
            include: {
                room: { include: { members: { select: { userId: true } } } },
            },
        });

        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        if (!thread.room.members.some((m) => m.userId === userId)) {
            return res.status(403).json({ error: 'Not a member of this room' });
        }

        const messages = await dagService.getThreadMessages(threadId, limit);

        res.json({
            messages: messages.map((msg: any) => ({
                id: msg.id,
                threadId: msg.threadId,
                parentId: msg.parentId,
                authorType: msg.authorType,
                authorId: msg.authorId,
                authorName: msg.author?.username,
                modelId: msg.modelId,
                content: msg.content,
                metadata: msg.metadata,
                createdAt: msg.createdAt.toISOString(),
            })),
        });
    } catch (err: any) {
        console.error('Get messages error:', err);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

/**
 * DELETE /api/threads/:threadId — Delete a thread and all its messages (host only)
 */
router.delete('/:threadId', async (req, res) => {
    try {
        const { threadId } = req.params;
        const userId = (req as any).user.userId;

        const thread = await prisma.conversationThread.findUnique({
            where: { id: threadId },
            include: {
                room: { select: { hostId: true } },
            },
        });

        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        const isHost = thread.room.hostId === userId;
        const isCreator = thread.creatorId === userId;

        // Permission: Thread creator can always delete.
        // Room host can delete threads EXCEPT those owned by others (BYOK protection).
        if (!isCreator && (!isHost || (thread.creatorId && thread.creatorId !== userId))) {
            return res.status(403).json({
                error: 'Permission denied. Only the thread creator can delete this thread.'
            });
        }

        // Cascade: delete edges, then messages, then thread
        await prisma.messageEdge.deleteMany({
            where: {
                OR: [
                    { parent: { threadId } },
                    { child: { threadId } },
                ],
            },
        });
        await prisma.messageNode.deleteMany({ where: { threadId } });
        await prisma.conversationThread.delete({ where: { id: threadId } });

        res.json({ message: 'Thread deleted successfully' });
    } catch (err: any) {
        console.error('Delete thread error:', err);
        res.status(500).json({ error: 'Failed to delete thread' });
    }
});

export default router;
