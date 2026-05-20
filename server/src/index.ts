import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import admin from 'firebase-admin';

import { apiRateLimit } from './middleware/rateLimit';
import { socketAuthMiddleware } from './socket/middleware';
import { registerSocketHandlers } from './socket/handlers';

// Route imports
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import conversationsRoutes from './routes/groups';
import messagesRoutes from './routes/messages';
import mediaRoutes from './routes/media';
import adminRoutes from './routes/admin';

// ── Firebase Admin Init ──
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey) {
  console.error('Missing Firebase Admin SDK env vars');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: firebaseProjectId,
    clientEmail: firebaseClientEmail,
    privateKey: firebasePrivateKey,
  }),
});

// ── Express + HTTP Server ──
const app = express();
const httpServer = createServer(app);

// ── Socket.io ──
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 25000,
  pingTimeout: 20000,
});

// Socket auth + handlers
io.use(socketAuthMiddleware);
registerSocketHandlers(io);

// ── Middleware ──
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(apiRateLimit);

// ── Health Check ──
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ──
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/conversations', conversationsRoutes);
app.use('/messages', messagesRoutes);
app.use('/media', mediaRoutes);
app.use('/admin', adminRoutes);

// ── 404 Handler ──
app.use((_req, res) => {
  res.status(404).json({ error: 'not_found', message: 'Route not found' });
});

// ── Start Server ──
const PORT = parseInt(process.env.PORT ?? '3000', 10);

httpServer.listen(PORT, () => {
  console.log(`Squaad server running on port ${PORT}`);
});

export { app, httpServer, io };
