import { prisma } from '../lib/prisma';
import type { MessageNode as MessageNodeType, MessageMetadata } from '@airoom/shared';
import Redis from 'ioredis';
import { env } from '../config/env';
import { generateEmbedding } from './llm/vector';

const redis = new Redis(env.REDIS_URL);

/**
 * DAG Conversation Engine
 *
 * Manages the directed acyclic graph of messages within conversation threads.
 * Key operations:
 * - Create message nodes with parent references
 * - Branch from any existing message
 * - Walk ancestor path for LLM context construction
 * - Retrieve tree structure for visualization
 */
export class DAGService {
    /**
     * Create a new conversation thread in a room.
     */
    async createThread(roomId: string, creatorId: string, title: string, modelConfig: Record<string, any> = {}) {
        return prisma.conversationThread.create({
            data: { roomId, creatorId, title, modelConfig },
        });
    }

    /**
     * Add a message node to the DAG.
     * If parentId is provided, also creates an edge.
     */
    async addMessage(params: {
        id?: string;
        threadId: string;
        parentId: string | null;
        authorType: 'USER' | 'AI' | 'SYSTEM';
        authorId: string | null;
        modelId: string | null;
        content: string;
        metadata?: MessageMetadata;
        edgeType?: 'REPLY' | 'BRANCH';
    }) {
        const { id, threadId, parentId, authorType, authorId, modelId, content, metadata, edgeType } = params;

        let vectorStr: string | null = null;
        try {
            const vec = await generateEmbedding(content);
            vectorStr = `[${vec.join(',')}]`;
        } catch (err: any) {
            console.warn(`Failed to generate embedding for message ${id || '(new)'}:`, err.message);
        }

        // Create the message node
        const node = await prisma.messageNode.create({
            data: {
                id,
                threadId,
                parentId,
                authorType,
                authorId,
                modelId,
                content,
                metadata: (metadata as any) || {},
            },
            include: {
                author: { select: { id: true, username: true, avatarUrl: true } },
            },
        });

        // Save embedding vector via raw query
        if (vectorStr) {
            try {
                await prisma.$executeRawUnsafe(`UPDATE "MessageNode" SET embedding = '${vectorStr}'::vector WHERE id = '${node.id}'`);
            } catch (err: any) {
                console.error(`Failed to save embedding for message ${node.id}:`, err.message);
            }
        }

        // Create the edge if there's a parent
        if (parentId) {
            await prisma.messageEdge.create({
                data: {
                    parentId,
                    childId: node.id,
                    // @ts-ignore
                    edgeType: edgeType || 'REPLY',
                },
            });
        }

        // Invalidate tree cache
        await redis.del(`thread:tree:${threadId}`);

        return node;
    }

    /**
     * Get the full ancestor path from root to a given message.
     * This is used to construct the LLM context — only the direct lineage,
     * no sibling branches, preventing context pollution.
     */
    async getAncestorPath(messageId: string): Promise<any[]> {
        const path: any[] = [];
        let currentId: string | null = messageId;

        // Walk up the tree
        while (currentId) {
            const node: any = await prisma.messageNode.findUnique({
                where: { id: currentId },
                include: {
                    author: { select: { id: true, username: true } },
                },
            });

            if (!node) break;

            path.unshift(node); // prepend to maintain chronological order
            currentId = node.parentId;
        }

        return path;
    }

    /**
     * Build an LLM-ready message array from the ancestor path.
     * Uses pgvector to retrieve semantic memories from OTHER branches
     * and injects them into the system prompt without polluting the main context.
     */
    async buildLLMContext(messageId: string, systemPrompt?: string): Promise<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>> {
        const path = await this.getAncestorPath(messageId);
        if (path.length === 0) return [];

        const pathIds = path.map((n) => n.id);
        const threadId = path[0].threadId;
        const latestQuery = path[path.length - 1]?.content;

        let ragContext = '';
        if (latestQuery) {
            try {
                const queryVector = await generateEmbedding(latestQuery);
                const vectorStr = `[${queryVector.join(',')}]`;

                // Exclude the current path IDs so we only search OTHER branches
                const pathInClause = pathIds.map(id => `'${id}'`).join(',');

                const similarDocs: any[] = await prisma.$queryRawUnsafe(`
                    SELECT content, 1 - (embedding <=> '${vectorStr}'::vector) as similarity
                    FROM "MessageNode"
                    WHERE "threadId" = '${threadId}'
                      AND id NOT IN (${pathInClause})
                      AND embedding IS NOT NULL
                    ORDER BY embedding <=> '${vectorStr}'::vector
                    LIMIT 3;
                `);

                // Only include strongly relevant memories (e.g., sim > 0.7) depending on model, but we'll just take top 3
                if (similarDocs && similarDocs.length > 0) {
                    ragContext = "\n\n[Context from other branches you may find useful]:\n" +
                        similarDocs.map(d => `- ${d.content}`).join('\n');
                }
            } catch (err: any) {
                console.warn('Vector search failed (skipping RAG):', err.message);
            }
        }

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

        const finalSystemPrompt = (systemPrompt || 'You are a helpful AI assistant.') + ragContext;
        messages.push({ role: 'system', content: finalSystemPrompt });

        for (const node of path) {
            if (node.authorType === 'USER') {
                messages.push({ role: 'user', content: node.content });
            } else if (node.authorType === 'AI') {
                messages.push({ role: 'assistant', content: node.content });
            } else if (node.authorType === 'SYSTEM') {
                messages.push({ role: 'system', content: node.content });
            }
        }

        return messages;
    }

    /**
     * Get the tree structure of a thread for visualization.
     * Returns all nodes with their edges, organized for ReactFlow rendering.
     * Uses Redis caching since this can be heavy for large threads.
     */
    async getThreadTree(threadId: string) {
        const cacheKey = `thread:tree:${threadId}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        const [messages, edges] = await Promise.all([
            prisma.messageNode.findMany({
                where: { threadId },
                include: {
                    author: { select: { id: true, username: true, avatarUrl: true } },
                },
                orderBy: { createdAt: 'asc' },
            }),
            prisma.messageEdge.findMany({
                where: {
                    parent: { threadId },
                },
            }),
        ]);

        const result = { messages, edges };
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600); // cache for 1 hour
        return result;
    }

    /**
     * Get all threads for a room.
     */
    async getRoomThreads(roomId: string) {
        return prisma.conversationThread.findMany({
            where: { roomId },
            include: {
                _count: { select: { messages: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    /**
     * Get the latest messages in a thread, supporting cursor pagination.
     */
    async getThreadMessages(threadId: string, limit = 50, cursor?: string) {
        const query: any = {
            where: { threadId },
            include: {
                author: { select: { id: true, username: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        };

        if (cursor) {
            query.cursor = { id: cursor };
            query.skip = 1;
        }

        const messages = await prisma.messageNode.findMany(query);
        return messages.reverse();
    }

    /**
     * Get children of a specific message node (for branch exploration).
     */
    async getChildren(messageId: string) {
        const edges = await prisma.messageEdge.findMany({
            where: { parentId: messageId },
            include: {
                child: {
                    include: {
                        author: { select: { id: true, username: true, avatarUrl: true } },
                    },
                },
            },
        });

        return edges.map((e) => ({ ...e.child, edgeType: (e as any).edgeType }));
    }

    /**
     * Delete a branch starting from a specific node (and all descendants).
     * Host-only operation.
     */
    async deleteBranch(messageId: string): Promise<number> {
        // Get all descendant IDs via recursive CTE (PostgreSQL)
        const descendants = await prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE descendant_tree AS (
        SELECT id FROM "MessageNode" WHERE id = ${messageId}
        UNION ALL
        SELECT mn.id FROM "MessageNode" mn
        INNER JOIN "MessageEdge" me ON mn.id = me."childId"
        INNER JOIN descendant_tree dt ON me."parentId" = dt.id
      )
      SELECT id FROM descendant_tree
    `;

        const ids = descendants.map((d) => d.id);

        if (ids.length === 0) return 0;

        // Delete edges first, then nodes
        await prisma.messageEdge.deleteMany({
            where: {
                OR: [
                    { parentId: { in: ids } },
                    { childId: { in: ids } },
                ],
            },
        });

        const result = await prisma.messageNode.deleteMany({
            where: { id: { in: ids } },
        });

        // Invalidate tree cache after branch deletion
        const node = await prisma.messageNode.findUnique({ where: { id: messageId }, select: { threadId: true } });
        if (node?.threadId) {
            await redis.del(`thread:tree:${node.threadId}`);
        }

        return result.count;
    }
}

// Singleton instance
export const dagService = new DAGService();
