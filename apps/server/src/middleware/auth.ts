import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';

export interface AuthPayload {
    userId: string;
    email: string;
}

// Extend Express Request with user info
declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}

/**
 * Express middleware: verifies JWT from Authorization header.
 * Attaches `req.user` on success, returns 401 on failure.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid authorization header' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
        req.user = payload;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/**
 * Middleware: checks that the current user is the host of the specified room.
 * Expects `req.params.roomId` or `req.params.slug`.
 */
export async function hostOnlyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    const roomId = req.params.roomId;
    const roomSlug = req.params.slug; // Renamed from 'slug' to 'roomSlug' for clarity

    try {
        let room;
        if (roomId) {
            room = await prisma.room.findUnique({ where: { id: roomId as string } });
        } else if (roomSlug) {
            room = await prisma.room.findUnique({ where: { slug: roomSlug as string } });
        }

        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }

        if (room.hostId !== req.user.userId) {
            res.status(403).json({ error: 'Only the room host can perform this action' });
            return;
        }

        next();
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Generates a JWT token for a user.
 */
export function generateToken(payload: AuthPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verifies a JWT token (used for Socket.IO auth).
 */
export function verifyToken(token: string): AuthPayload | null {
    try {
        return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    } catch {
        return null;
    }
}
