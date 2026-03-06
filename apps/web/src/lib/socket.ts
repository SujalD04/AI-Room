import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@airoom/shared';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

/**
 * Get or create the singleton Socket.IO connection.
 * Authenticates with the JWT token from localStorage.
 */
export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (socket?.connected) return socket;

    const token = typeof window !== 'undefined' ? localStorage.getItem('airoom_token') : null;

    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
        console.log('🔌 Socket connected:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
        console.error('🔌 Socket connection error:', err.message);
    });

    return socket;
}

/**
 * Disconnect and clean up the socket.
 */
export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
