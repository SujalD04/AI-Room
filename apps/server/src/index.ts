import express, { Express } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';

import { env, validateEnv } from './config/env';
import { apiRateLimiter } from './middleware/rateLimit';
import { setupSocketHandlers } from './socket/handlers';
import { initMediasoup } from './services/media';

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
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── Socket.IO ───
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
        origin: env.CLIENT_URL,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e7, // 10MB
});

setupSocketHandlers(io);

// ─── Start Server ───
async function startServer() {
    // Initialize mediasoup workers (gracefully — don't crash if mediasoup not installed)
    try {
        await initMediasoup();
        console.log('🎥 mediasoup initialized successfully');
    } catch (err: any) {
        console.warn('⚠️  mediasoup unavailable (audio/video/screenshare disabled):', err.message);
        console.warn('   Install mediasoup native dependencies to enable WebRTC features.');
    }

    server.listen(env.PORT, () => {
        console.log(`
             AIRoom Server Running        
    HTTP:     http://localhost:${env.PORT}  
    Socket:   ws://localhost:${env.PORT}          
    Mode:     ${env.NODE_ENV.padEnd(28)}
    `);
    });
}

startServer();

export { app, server, io };
