import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router: Router = Router();

router.use(authMiddleware);

// ─── Validation ───
const createNoteSchema = z.object({
    roomSlug: z.string(),
    title: z.string().min(1).max(200),
    content: z.any().optional().default({}),
    type: z.enum(['NOTE', 'TODO_LIST']).optional().default('NOTE'),
});

const updateNoteSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.any().optional(),
    isPinned: z.boolean().optional(),
});

const addTodoSchema = z.object({
    text: z.string().min(1).max(500),
    assigneeId: z.string().uuid().optional(),
});

// ─── POST /api/notes — Create a note ───
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = createNoteSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.errors[0].message });
            return;
        }

        const { roomSlug, title, content, type } = parsed.data;
        const userId = req.user!.userId;

        // Verify room membership
        const room = await prisma.room.findUnique({ where: { slug: roomSlug } });
        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }

        const member = await prisma.roomMember.findUnique({
            where: { roomId_userId: { roomId: room.id, userId } },
        });
        if (!member) {
            res.status(403).json({ error: 'You are not a member of this room' });
            return;
        }

        // Limit notes per room
        const noteCount = await prisma.note.count({ where: { roomId: room.id } });
        if (noteCount >= 50) {
            res.status(429).json({ error: 'Maximum 50 notes per room' });
            return;
        }

        const note = await prisma.note.create({
            data: { roomId: room.id, authorId: userId, title, content, type },
            include: {
                author: { select: { id: true, username: true } },
                todos: true,
            },
        });

        res.status(201).json({ note });
    } catch (err) {
        console.error('Create note error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PATCH /api/notes/:noteId — Update a note ───
router.patch('/:noteId', async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = updateNoteSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.errors[0].message });
            return;
        }

        const noteId = req.params.noteId as string;
        const userId = req.user!.userId;

        const note = await prisma.note.findFirst({
            where: { id: noteId },
            include: { room: true },
        });

        if (!note) {
            res.status(404).json({ error: 'Note not found' });
            return;
        }

        // Only author or host can update
        const isHost = (note as any).room.hostId === userId;
        const isAuthor = note.authorId === userId;
        if (!isHost && !isAuthor) {
            res.status(403).json({ error: 'Only the author or room host can update this note' });
            return;
        }

        const updated = await prisma.note.update({
            where: { id: noteId },
            data: parsed.data,
            include: {
                author: { select: { id: true, username: true } },
                todos: { orderBy: { order: 'asc' } },
            },
        });

        res.json({ note: updated });
    } catch (err) {
        console.error('Update note error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── DELETE /api/notes/:noteId — Delete a note ───
router.delete('/:noteId', async (req: Request, res: Response): Promise<void> => {
    try {
        const noteId = req.params.noteId as string;
        const userId = req.user!.userId;

        const note = await prisma.note.findFirst({
            where: { id: noteId },
            include: { room: true },
        });

        if (!note) {
            res.status(404).json({ error: 'Note not found' });
            return;
        }

        const isHost = (note as any).room.hostId === userId;
        const isAuthor = note.authorId === userId;
        if (!isHost && !isAuthor) {
            res.status(403).json({ error: 'Only the author or room host can delete this note' });
            return;
        }

        await prisma.note.delete({ where: { id: noteId } });
        res.json({ message: 'Note deleted successfully' });
    } catch (err) {
        console.error('Delete note error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/notes/:noteId/todos — Add a todo item ───
router.post('/:noteId/todos', async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = addTodoSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.errors[0].message });
            return;
        }

        const noteId = req.params.noteId as string;
        const userId = req.user!.userId;

        const note = await prisma.note.findFirst({
            where: { id: noteId, type: 'TODO_LIST' },
            include: { room: { include: { members: true } } },
        });

        if (!note) {
            res.status(404).json({ error: 'Todo list not found' });
            return;
        }

        // Check membership
        const isMember = (note as any).room.members.some((m: any) => m.userId === userId);
        if (!isMember) {
            res.status(403).json({ error: 'You are not a member of this room' });
            return;
        }

        // Get max order
        const maxOrder = await prisma.todoItem.aggregate({
            where: { noteId },
            _max: { order: true },
        });

        const todo = await prisma.todoItem.create({
            data: {
                noteId,
                title: parsed.data.text,
                assigneeId: parsed.data.assigneeId,
                order: (maxOrder._max.order ?? -1) + 1,
            },
        });

        res.status(201).json({ todo });
    } catch (err) {
        console.error('Add todo error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PATCH /api/notes/:noteId/todos/:todoId/toggle — Toggle todo ───
router.patch('/:noteId/todos/:todoId/toggle', async (req: Request, res: Response): Promise<void> => {
    try {
        const todoId = req.params.todoId as string;

        const todo = await prisma.todoItem.findFirst({ where: { id: todoId } });
        if (!todo) {
            res.status(404).json({ error: 'Todo not found' });
            return;
        }

        const updated = await prisma.todoItem.update({
            where: { id: todoId },
            data: { isCompleted: !todo.isCompleted },
        });

        res.json({ todo: updated });
    } catch (err) {
        console.error('Toggle todo error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
