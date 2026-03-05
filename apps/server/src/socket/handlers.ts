import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken, AuthPayload } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { dagService } from '../services/dag';
import { streamCompletion, MODEL_CATALOG } from '../services/llm/gateway';
import { runCouncil } from '../services/llm/council';
import { setupMediaHandlers, handleMediaDisconnect } from './mediaHandlers';
import type {
    ServerToClientEvents,
    ClientToServerEvents,
    SendMessagePayload,
    BranchMessagePayload,
    CouncilQueryPayload,
    CreateNotePayload,
    UpdateNotePayload,
    MessageMetadata,
} from '@airoom/shared';

// Track online users per room
const roomPresence = new Map<string, Set<string>>();

// Track voice channel participants per room
const voicePresence = new Map<string, Set<string>>();

// Socket-level AI Rate Limiting (Simple Cooldown)
const aiCooldowns = new Map<string, number>(); // userId -> lastRequestTime
const COOLDOWN_MS = 2000; // 2 seconds between AI requests

// Extend Socket with user data
interface AuthenticatedSocket extends Socket<ClientToServerEvents, ServerToClientEvents> {
    data: {
        user: AuthPayload;
        roomId?: string;
        roomSlug?: string;
    };
}

/**
 * Register all Socket.IO event handlers.
 */
export function setupSocketHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>) {
    // ─── Authentication Middleware ───
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }

        const payload = verifyToken(token);
        if (!payload) {
            return next(new Error('Invalid token'));
        }

        (socket as AuthenticatedSocket).data.user = payload;
        next();
    });

    io.on('connection', (rawSocket) => {
        const socket = rawSocket as AuthenticatedSocket;
        const userId = socket.data.user.userId;

        console.log(`⚡ User connected: ${userId}`);

        // ─── Room: Join ───
        socket.on('room:join', async (data, callback) => {
            try {
                const { roomSlug } = data;

                // Verify room exists and user is a member
                const room = await prisma.room.findUnique({
                    where: { slug: roomSlug },
                    include: {
                        members: {
                            include: {
                                user: { select: { id: true, username: true, email: true, avatarUrl: true, createdAt: true } },
                            },
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

                if (!room || !room.isActive) {
                    callback({ success: false, error: 'Room not found or inactive' });
                    return;
                }

                const isMember = room.members.some((m) => m.userId === userId);
                if (!isMember) {
                    callback({ success: false, error: 'You are not a member of this room' });
                    return;
                }

                // Join the Socket.IO room
                socket.join(room.id);
                socket.data.roomId = room.id;
                socket.data.roomSlug = roomSlug;

                // Register mediasoup signaling handlers for this peer
                setupMediaHandlers(io as any, socket as any, userId, room.id);

                // Track presence
                if (!roomPresence.has(room.id)) {
                    roomPresence.set(room.id, new Set());
                }
                roomPresence.get(room.id)!.add(userId);

                // Notify others
                const user = room.members.find((m) => m.userId === userId);
                if (user) {
                    socket.to(room.id).emit('room:member_joined', user as any);
                }

                // Broadcast presence
                const online = Array.from(roomPresence.get(room.id) || []);
                io.to(room.id).emit('room:presence', {
                    onlineUserIds: online,
                    memberCount: room.members.length,
                });

                callback({
                    success: true,
                    room: {
                        id: room.id,
                        name: room.name,
                        slug: room.slug,
                        hostId: room.hostId,
                        maxMembers: room.maxMembers,
                        isActive: room.isActive,
                        settings: room.settings as any,
                        createdAt: room.createdAt.toISOString(),
                    },
                    members: room.members.map((m) => ({
                        id: m.id,
                        roomId: m.roomId,
                        userId: m.userId,
                        user: { ...m.user, createdAt: m.user.createdAt.toISOString() },
                        role: m.role,
                        joinedAt: m.joinedAt.toISOString(),
                    })),
                    threads: room.threads.map((t) => ({
                        id: t.id,
                        roomId: t.roomId,
                        creatorId: t.creatorId,
                        title: t.title,
                        modelConfig: t.modelConfig as any,
                        createdAt: t.createdAt.toISOString(),
                    })),
                    notes: room.notes.map((n) => ({
                        id: n.id,
                        roomId: n.roomId,
                        authorId: n.authorId,
                        authorName: (n as any).author?.username,
                        title: n.title,
                        content: n.content,
                        type: n.type,
                        isPinned: n.isPinned,
                        createdAt: n.createdAt.toISOString(),
                        updatedAt: n.updatedAt.toISOString(),
                    })),
                });
            } catch (err: any) {
                console.error('Room join error:', err);
                callback({ success: false, error: 'Failed to join room' });
            }
        });

        // ─── Room: Leave ───
        socket.on('room:leave', () => {
            if (socket.data.roomId) {
                // Clear media from memory
                handleMediaDisconnect(io as any, socket as any, userId, socket.data.roomId);

                // Handle voice presence leave
                const roomVoiceSet = voicePresence.get(socket.data.roomId);
                if (roomVoiceSet && roomVoiceSet.has(userId)) {
                    roomVoiceSet.delete(userId);
                    socket.to(socket.data.roomId).emit('room:voice_left', { userId });
                }

                roomPresence.get(socket.data.roomId)?.delete(userId);

                socket.to(socket.data.roomId).emit('room:member_left', { userId });

                const online = Array.from(roomPresence.get(socket.data.roomId) || []);
                io.to(socket.data.roomId).emit('room:presence', {
                    onlineUserIds: online,
                    memberCount: online.length,
                });

                socket.leave(socket.data.roomId);
                delete socket.data.roomId;
                delete socket.data.roomSlug;
            }
        });

        // ─── Voice Channel: Explicit Join ───
        socket.on('room:voice_join', (callback) => {
            if (!socket.data.roomId) return;
            const roomId = socket.data.roomId;

            if (!voicePresence.has(roomId)) {
                voicePresence.set(roomId, new Set());
            }
            const roomVoiceSet = voicePresence.get(roomId)!;
            roomVoiceSet.add(userId);

            socket.to(roomId).emit('room:voice_joined', { userId });

            if (callback) {
                callback({ participants: Array.from(roomVoiceSet) });
            }
        });

        // ─── Voice Channel: Explicit Leave ───
        socket.on('room:voice_leave', () => {
            if (!socket.data.roomId) return;
            const roomId = socket.data.roomId;

            const roomVoiceSet = voicePresence.get(roomId);
            if (roomVoiceSet && roomVoiceSet.has(userId)) {
                roomVoiceSet.delete(userId);
                socket.to(roomId).emit('room:voice_left', { userId });
            }
        });

        // ─── Room: Typing ───
        socket.on('room:typing', async (data) => {
            if (!socket.data.roomId) return;

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { username: true },
            });

            socket.to(socket.data.roomId).emit('room:typing', {
                userId,
                username: user?.username || 'Unknown',
                isTyping: data.isTyping,
            });
        });

        // ─── Chat: Send Message ───
        socket.on('chat:send_message', async (data, callback) => {
            if (!socket.data.roomId) {
                callback({ success: false, error: 'Not in a room' });
                return;
            }

            try {
                const { threadId, parentId, content, requestAiResponse } = data;

                // Create the user's message node
                const userMessage = await dagService.addMessage({
                    threadId,
                    parentId,
                    authorType: 'USER',
                    authorId: userId,
                    modelId: null,
                    content,
                });

                // Fetch author info
                const author = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { id: true, username: true, avatarUrl: true },
                });

                const messageNode = {
                    id: userMessage.id,
                    threadId: userMessage.threadId,
                    parentId: userMessage.parentId,
                    authorType: userMessage.authorType as any,
                    authorId: userMessage.authorId,
                    authorName: author?.username,
                    modelId: userMessage.modelId,
                    content: userMessage.content,
                    metadata: userMessage.metadata as any,
                    createdAt: userMessage.createdAt.toISOString(),
                };

                // Broadcast to room
                io.to(socket.data.roomId).emit('chat:message', messageNode);
                callback({ success: true, message: messageNode });

                if (requestAiResponse) {
                    // Rate limit check
                    const lastReq = aiCooldowns.get(userId) || 0;
                    if (Date.now() - lastReq < COOLDOWN_MS) {
                        callback({ success: false, error: 'AI request too fast. Please wait a moment.' });
                        return;
                    }
                    aiCooldowns.set(userId, Date.now());

                    const thread = await prisma.conversationThread.findUnique({
                        where: { id: threadId },
                    });

                    if (thread) {
                        const modelConfig = thread.modelConfig as any;
                        await handleAIResponse(
                            io,
                            socket,
                            threadId,
                            userMessage.id,
                            modelConfig,
                            userId
                        );
                    }
                }
            } catch (err: any) {
                console.error('Send message error:', err);
                callback({ success: false, error: 'Failed to send message' });
            }
        });

        // ─── Chat: Branch Message ───
        socket.on('chat:branch_message', async (data, callback) => {
            if (!socket.data.roomId) {
                callback({ success: false, error: 'Not in a room' });
                return;
            }

            try {
                const { threadId, branchFromMessageId, content, branchLabel, modelConfig } = data;

                // Create the branch message
                const branchMessage = await dagService.addMessage({
                    threadId,
                    parentId: branchFromMessageId,
                    authorType: 'USER',
                    authorId: userId,
                    modelId: null,
                    content,
                    metadata: { branchLabel: branchLabel || 'New Branch' },
                    edgeType: 'BRANCH',
                });

                const author = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { id: true, username: true, avatarUrl: true },
                });

                const messageNode = {
                    id: branchMessage.id,
                    threadId: branchMessage.threadId,
                    parentId: branchMessage.parentId,
                    authorType: branchMessage.authorType as any,
                    authorId: branchMessage.authorId,
                    authorName: author?.username,
                    modelId: branchMessage.modelId,
                    content: branchMessage.content,
                    metadata: branchMessage.metadata as any,
                    createdAt: branchMessage.createdAt.toISOString(),
                };

                io.to(socket.data.roomId).emit('chat:message', messageNode);
                callback({ success: true, message: messageNode });

                // If model config provided, get AI response on the branch
                if (modelConfig) {
                    // Rate limit check
                    const lastReq = aiCooldowns.get(userId) || 0;
                    if (Date.now() - lastReq < COOLDOWN_MS) {
                        callback({ success: false, error: 'AI request too fast. Please wait a moment.' });
                        return;
                    }
                    aiCooldowns.set(userId, Date.now());

                    await handleAIResponse(
                        io,
                        socket,
                        threadId,
                        branchMessage.id,
                        modelConfig,
                        userId
                    );
                }
            } catch (err: any) {
                console.error('Branch message error:', err);
                callback({ success: false, error: 'Failed to branch message' });
            }
        });

        // ─── Council: Query ───
        socket.on('council:query', async (data, callback) => {
            if (!socket.data.roomId) {
                callback({ queryId: '' });
                return;
            }

            const queryId = uuidv4();

            // Rate limit check
            const lastReq = aiCooldowns.get(userId) || 0;
            if (Date.now() - lastReq < COOLDOWN_MS) {
                callback({ queryId: '' });
                socket.emit('council:error', { queryId: '', error: 'Council request too fast. Please wait a moment.' });
                return;
            }
            aiCooldowns.set(userId, Date.now());

            callback({ queryId });

            try {
                const { threadId, parentId, content, councilConfig } = data;

                // Create the user's query message
                const userMessage = await dagService.addMessage({
                    threadId,
                    parentId,
                    authorType: 'USER',
                    authorId: userId,
                    modelId: null,
                    content,
                });

                // Build context from DAG
                const llmMessages = await dagService.buildLLMContext(userMessage.id);

                // Notify room that council is starting
                io.to(socket.data.roomId!).emit('council:started', {
                    queryId,
                    models: councilConfig.models.map((m) => m.modelId),
                });

                // Run the council
                await runCouncil(userId, llmMessages, councilConfig, {
                    onIndividualResponse: (response) => {
                        io.to(socket.data.roomId!).emit('council:individual_response', { queryId, response });
                    },
                    onAggregationStart: () => {
                        io.to(socket.data.roomId!).emit('council:aggregation_start', { queryId });
                    },
                    onAggregationToken: (token) => {
                        io.to(socket.data.roomId!).emit('council:stream_token', { queryId, token });
                    },
                    onComplete: async (details, finalContent) => {
                        // Store the council response as a DAG node
                        const aiMessage = await dagService.addMessage({
                            threadId,
                            parentId: userMessage.id,
                            authorType: 'AI',
                            authorId: null,
                            modelId: `council:${details.aggregatorModel}`,
                            content: finalContent,
                            metadata: {
                                isCouncilResponse: true,
                                councilDetails: details,
                            },
                        });

                        const messageNode = {
                            id: aiMessage.id,
                            threadId: aiMessage.threadId,
                            parentId: aiMessage.parentId,
                            authorType: aiMessage.authorType as any,
                            authorId: aiMessage.authorId,
                            modelId: aiMessage.modelId,
                            content: aiMessage.content,
                            metadata: aiMessage.metadata as any,
                            createdAt: aiMessage.createdAt.toISOString(),
                        };

                        io.to(socket.data.roomId!).emit('council:complete', { queryId, message: messageNode });
                    },
                    onError: (error) => {
                        io.to(socket.data.roomId!).emit('council:error', { queryId, error });
                    },
                });
            } catch (err: any) {
                console.error('Council query error:', err);
                io.to(socket.data.roomId!).emit('council:error', { queryId, error: err.message });
            }
        });

        // ─── Notes: Create ───
        socket.on('notes:create', async (data, callback) => {
            if (!socket.data.roomId) {
                callback({ note: null as any });
                return;
            }

            try {
                const note = await prisma.note.create({
                    data: {
                        roomId: socket.data.roomId,
                        authorId: userId,
                        title: data.title,
                        content: data.content || {},
                        type: data.type || 'NOTE',
                    },
                    include: {
                        author: { select: { id: true, username: true } },
                        todos: true,
                    },
                });

                const noteData = {
                    id: note.id,
                    roomId: note.roomId,
                    authorId: note.authorId,
                    authorName: note.author.username,
                    title: note.title,
                    content: note.content,
                    type: note.type,
                    isPinned: note.isPinned,
                    createdAt: note.createdAt.toISOString(),
                    updatedAt: note.updatedAt.toISOString(),
                };

                io.to(socket.data.roomId).emit('notes:updated', noteData);
                callback({ note: noteData });
            } catch (err: any) {
                console.error('Create note error:', err);
                callback({ note: null as any });
            }
        });

        // ─── Notes: Update ───
        socket.on('notes:update', async (data, callback) => {
            if (!socket.data.roomId) {
                callback({ note: null as any });
                return;
            }

            try {
                const updateData: any = {};
                if (data.title !== undefined) updateData.title = data.title;
                if (data.content !== undefined) updateData.content = data.content;
                if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;

                const note = await prisma.note.update({
                    where: { id: data.noteId },
                    data: updateData,
                    include: {
                        author: { select: { id: true, username: true } },
                        todos: { orderBy: { order: 'asc' } },
                    },
                });

                const noteData = {
                    id: note.id,
                    roomId: note.roomId,
                    authorId: note.authorId,
                    authorName: note.author.username,
                    title: note.title,
                    content: note.content,
                    type: note.type,
                    isPinned: note.isPinned,
                    createdAt: note.createdAt.toISOString(),
                    updatedAt: note.updatedAt.toISOString(),
                };

                io.to(socket.data.roomId).emit('notes:updated', noteData);
                callback({ note: noteData });
            } catch (err: any) {
                console.error('Update note error:', err);
                callback({ note: null as any });
            }
        });

        // ─── Notes: Delete ───
        socket.on('notes:delete', async (data, callback) => {
            if (!socket.data.roomId) {
                callback({ success: false });
                return;
            }

            try {
                await prisma.note.delete({ where: { id: data.noteId } });
                io.to(socket.data.roomId).emit('notes:deleted', { noteId: data.noteId });
                callback({ success: true });
            } catch (err: any) {
                console.error('Delete note error:', err);
                callback({ success: false });
            }
        });

        // ─── Notes: Toggle Todo ───
        socket.on('notes:toggle_todo', async (data, callback) => {
            if (!socket.data.roomId) {
                callback({ success: false });
                return;
            }

            try {
                const todo = await prisma.todoItem.findUnique({ where: { id: data.todoId } });
                if (!todo) {
                    callback({ success: false });
                    return;
                }

                await prisma.todoItem.update({
                    where: { id: data.todoId },
                    data: { isCompleted: !todo.isCompleted },
                });

                io.to(socket.data.roomId).emit('notes:todo_toggled', {
                    noteId: data.noteId,
                    todoId: data.todoId,
                    isCompleted: !todo.isCompleted,
                });

                callback({ success: true });
            } catch (err: any) {
                console.error('Toggle todo error:', err);
                callback({ success: false });
            }
        });

        // ─── Disconnect ───
        socket.on('disconnect', async () => {
            if (socket.data.roomId) {
                // Clear typing indicator for the disconnected user
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { username: true },
                });
                socket.to(socket.data.roomId).emit('room:typing', {
                    userId,
                    username: user?.username || 'Unknown',
                    isTyping: false,
                });

                // Clean up mediasoup resources
                handleMediaDisconnect(io as any, socket as any, userId, socket.data.roomId);

                // Handle voice channel explicit disconnect
                const roomVoiceSet = voicePresence.get(socket.data.roomId);
                if (roomVoiceSet && roomVoiceSet.has(userId)) {
                    roomVoiceSet.delete(userId);
                    socket.to(socket.data.roomId).emit('room:voice_left', { userId });
                }

                roomPresence.get(socket.data.roomId)?.delete(userId);

                socket.to(socket.data.roomId).emit('room:member_left', { userId });

                const online = Array.from(roomPresence.get(socket.data.roomId) || []);
                io.to(socket.data.roomId).emit('room:presence', {
                    onlineUserIds: online,
                    memberCount: online.length,
                });
            }

            console.log(`⚡ User disconnected: ${userId}`);
        });
    });
}

/**
 * Handle AI response: build context from DAG, stream response, store result.
 */
async function handleAIResponse(
    io: Server,
    socket: AuthenticatedSocket,
    threadId: string,
    parentMessageId: string,
    modelConfig: any,
    userId: string
) {
    const roomId = socket.data.roomId!;
    const aiMessageId = uuidv4();

    // Build context from DAG ancestor path
    const llmMessages = await dagService.buildLLMContext(
        parentMessageId,
        modelConfig.systemPrompt
    );

    // Resolve API key owner (Thread creator > Message sender)
    const thread = await prisma.conversationThread.findUnique({
        where: { id: threadId },
        select: { creatorId: true }
    });
    const keyOwnerId = thread?.creatorId || userId;

    // Notify room that streaming is starting
    io.to(roomId).emit('chat:stream_start', {
        messageId: aiMessageId,
        threadId,
        modelId: modelConfig.modelId || 'default',
    });

    let fullContent = '';

    await streamCompletion(
        {
            model: modelConfig.modelId || 'google/gemini-2.0-flash-exp:free',
            provider: modelConfig.provider || 'openrouter',
            messages: llmMessages,
            temperature: modelConfig.temperature,
            maxTokens: modelConfig.maxTokens,
            userId: keyOwnerId,
        },
        {
            onToken: (token) => {
                fullContent += token;
                io.to(roomId).emit('chat:stream_token', { messageId: aiMessageId, token });
            },
            onDone: async (metadata) => {
                // Store the complete AI message in the DAG
                const aiMessage = await dagService.addMessage({
                    id: aiMessageId,
                    threadId,
                    parentId: parentMessageId,
                    authorType: 'AI',
                    authorId: null,
                    modelId: modelConfig.modelId || 'default',
                    content: fullContent,
                    metadata: {
                        tokensUsed: metadata.tokensUsed,
                        latencyMs: metadata.latencyMs,
                    },
                });

                io.to(roomId).emit('chat:stream_end', {
                    messageId: aiMessage.id,
                    metadata: aiMessage.metadata as any,
                });

                // Also send the complete message
                io.to(roomId).emit('chat:message', {
                    id: aiMessage.id,
                    threadId: aiMessage.threadId,
                    parentId: aiMessage.parentId,
                    authorType: aiMessage.authorType as any,
                    authorId: aiMessage.authorId,
                    modelId: aiMessage.modelId,
                    content: aiMessage.content,
                    metadata: aiMessage.metadata as any,
                    createdAt: aiMessage.createdAt.toISOString(),
                });
            },
            onError: (error) => {
                io.to(roomId).emit('chat:stream_error', {
                    messageId: aiMessageId,
                    error,
                });
            },
        }
    );
}
