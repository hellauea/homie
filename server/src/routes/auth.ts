import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import { db } from '../db/client';
import { signToken, requireAuth } from '../middleware/auth';
import { otpRateLimit } from '../middleware/rateLimit';
import { isPhoneWhitelisted, isValidE164 } from '../utils/whitelist';

const router = Router();

// POST /auth/verify-token
router.post('/verify-token', otpRateLimit, async (req: Request, res: Response): Promise<void> => {
  const { idToken } = req.body as { idToken?: string };

  if (!idToken || typeof idToken !== 'string') {
    res.status(400).json({ error: 'missing_id_token', message: 'idToken is required' });
    return;
  }

  let firebasePhone: string;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded.phone_number) {
      res.status(400).json({ error: 'no_phone', message: 'Token does not contain a phone number' });
      return;
    }
    firebasePhone = decoded.phone_number;
  } catch {
    res.status(401).json({ error: 'invalid_firebase_token', message: 'Firebase token verification failed' });
    return;
  }

  if (!isValidE164(firebasePhone)) {
    res.status(400).json({ error: 'invalid_phone_format', message: 'Phone must be E.164 format' });
    return;
  }

  const whitelisted = await isPhoneWhitelisted(firebasePhone);
  if (!whitelisted) {
    res.status(403).json({ error: 'not_invited', message: 'This number is not on the invite list' });
    return;
  }

  const { data: existingUser } = await db
    .from('users')
    .select('id, phone, name, is_active')
    .eq('phone', firebasePhone)
    .maybeSingle();

  if (existingUser && !existingUser.is_active) {
    res.status(403).json({ error: 'account_deactivated', message: 'Your account has been deactivated' });
    return;
  }

  if (!existingUser) {
    const token = signToken({ userId: 'pending', phone: firebasePhone });
    res.json({ status: 'needs_registration', phone: firebasePhone, setupToken: token });
    return;
  }

  const token = signToken({ userId: existingUser.id, phone: existingUser.phone });
  res.json({ status: 'ok', token, user: existingUser });
});

// POST /auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { setupToken, name, avatarUrl } = req.body as {
    setupToken?: string;
    name?: string;
    avatarUrl?: string;
  };

  if (!setupToken || !name) {
    res.status(400).json({ error: 'missing_fields', message: 'setupToken and name are required' });
    return;
  }

  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
    res.status(400).json({ error: 'invalid_name', message: 'Name must be 1-50 characters' });
    return;
  }

  let phone: string;
  try {
    const secret = process.env.JWT_SECRET!;
    const payload = jwt.verify(setupToken, secret) as { phone: string; userId: string };
    if (payload.userId !== 'pending') {
      res.status(400).json({ error: 'invalid_setup_token', message: 'Not a registration token' });
      return;
    }
    phone = payload.phone;
  } catch {
    res.status(401).json({ error: 'invalid_setup_token', message: 'Setup token is invalid or expired' });
    return;
  }

  const whitelisted = await isPhoneWhitelisted(phone);
  if (!whitelisted) {
    res.status(403).json({ error: 'not_invited', message: 'Phone not on the invite list' });
    return;
  }

  const { data: newUser, error } = await db
    .from('users')
    .insert({ phone, name: name.trim(), avatar_url: avatarUrl ?? null })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'already_registered', message: 'This phone is already registered' });
      return;
    }
    res.status(500).json({ error: 'db_error', message: 'Failed to create account' });
    return;
  }

  const token = signToken({ userId: newUser.id, phone: newUser.phone });
  res.status(201).json({ token, user: newUser });
});

// GET /auth/me
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { data: user, error } = await db
    .from('users')
    .select('id, phone, name, avatar_url, last_seen, created_at')
    .eq('id', req.user!.userId)
    .single();

  if (error || !user) {
    res.status(404).json({ error: 'user_not_found', message: 'User not found' });
    return;
  }

  res.json(user);
});

export default router;
