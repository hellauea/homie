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

app.set('io', io);

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

import { db } from './db/client';
import { hashPassword } from './utils/password';

async function seedJoyUser() {
  const joyPhone = '+919606664929';
  const joyPassword = 'JoyX';

  try {
    // 1. Ensure whitelisted
    const { data: whitelistEntry } = await db
      .from('whitelist')
      .select('phone')
      .eq('phone', joyPhone)
      .maybeSingle();

    if (!whitelistEntry) {
      await db.from('whitelist').insert({ phone: joyPhone });
      console.log(`[Seed] Whitelisted ${joyPhone}`);
    }

    // 2. Ensure user exists
    const { data: existingUser } = await db
      .from('users')
      .select('id')
      .eq('phone', joyPhone)
      .maybeSingle();

    if (!existingUser) {
      const passwordHash = hashPassword(joyPassword);
      const { error } = await db
        .from('users')
        .insert({
          phone: joyPhone,
          name: 'Joy',
          password_hash: passwordHash,
          is_active: true
        });

      if (error) {
        console.error('[Seed] Failed to create seed user:', error.message);
      } else {
        console.log(`[Seed] Successfully seeded user Joy (${joyPhone}) with password JoyX`);
      }
    } else {
      const passwordHash = hashPassword(joyPassword);
      await db
        .from('users')
        .update({ password_hash: passwordHash, name: 'Joy' })
        .eq('phone', joyPhone);
      console.log(`[Seed] Enforced password_hash to JoyX for seeded user Joy`);
    }
  } catch (err: any) {
    console.error('[Seed] Pre-seed error:', err.message);
  }
}

httpServer.listen(PORT, async () => {
  console.log(`Homie server running on port ${PORT}`);
  await seedJoyUser();

  // ── Render Free Tier Keep-Alive Ping ──
  // Pings its own public endpoint every 5 minutes to bypass Render's 15-minute inactivity spin-down.
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://homie-backend-kakj.onrender.com';
  if (RENDER_URL) {
    console.log(`[Keep-Alive] Self-ping scheduled for: ${RENDER_URL}/health`);
    setInterval(async () => {
      try {
        const res = await fetch(`${RENDER_URL}/health`);
        const data = await res.json() as { status: string };
        console.log(`[Keep-Alive] Pinged ${RENDER_URL}/health - Status: ${res.status} (${data.status})`);
      } catch (err: any) {
        console.error(`[Keep-Alive] Self-ping failed:`, err.message);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }
});

export { app, httpServer, io };
