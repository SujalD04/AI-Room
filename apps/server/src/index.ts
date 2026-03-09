import express, { Express } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

import { env, validateEnv } from './config/env';
import { apiRateLimiter } from './middleware/rateLimit';
import { setupSocketHandlers } from './socket/handlers';
import { initMediasoup } from './services/media';
import { logger, httpLogger } from './lib/logger';

// Routes
import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import keyRoutes from './routes/keys';
import noteRoutes from './routes/notes';
import threadRoutes from './routes/threads';
import modelRoutes from './routes/models';
import uploadRoutes from './routes/upload';
import path from 'path';

import type { ServerToClientEvents, ClientToServerEvents } from '@airoom/shared';

// Validate environment
validateEnv();

// ─── Express App ───
const app: Express = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

// ─── Security Middleware ───
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
    origin: env.CLIENT_URL,
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(apiRateLimiter);
app.use(httpLogger);

// ─── Health Check ───
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Static file serving for uploads ───
app.use('/uploads', express.static(path.resolve(__dirname, '../public/uploads')));

// ─── API Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/upload', uploadRoutes);

// ─── 404 Handler ───
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ─── Error Handler ───
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── Socket.IO ───
const pubClient = new Redis(env.REDIS_URL);
const subClient = pubClient.duplicate();

const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
        origin: env.CLIENT_URL,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    adapter: createAdapter(pubClient, subClient),
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e7, // 10MB
});

setupSocketHandlers(io);

// ─── Start Server ───
async function startServer() {
    try {
        await initMediasoup();
        logger.info('🎥 mediasoup initialized successfully');
    } catch (err: any) {
        logger.warn(`⚠️ mediasoup unavailable: ${err.message}`);
    }

    server.listen(env.PORT, () => {
        logger.info(`AIRoom Server Running | HTTP: ${env.PORT} | Mode: ${env.NODE_ENV}`);
    });
}

startServer();

export { app, server, io };
