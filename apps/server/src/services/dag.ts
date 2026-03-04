import { prisma } from '../lib/prisma';
import type { MessageNode as MessageNodeType, MessageMetadata } from '@airoom/shared';

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

        // Create the edge if there's a parent
        if (parentId) {
            await prisma.messageEdge.create({
                data: {
                    parentId,
                    childId: node.id,
                    edgeType: edgeType || 'REPLY',
                },
            });
        }

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
     * Converts our DAG nodes into the standard role/content format.
     */
    async buildLLMContext(messageId: string, systemPrompt?: string): Promise<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>> {
        const path = await this.getAncestorPath(messageId);
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

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
     */
    async getThreadTree(threadId: string) {
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

        return { messages, edges };
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
     * Get the latest messages in a thread (leaf nodes for the active branch).
     */
    async getThreadMessages(threadId: string, limit = 50) {
        return prisma.messageNode.findMany({
            where: { threadId },
            include: {
                author: { select: { id: true, username: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });
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

        return edges.map((e) => ({ ...e.child, edgeType: e.edgeType }));
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

        return result.count;
    }
}

// Singleton instance
export const dagService = new DAGService();
