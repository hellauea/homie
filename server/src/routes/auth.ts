import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/client';
import { signToken, requireAuth } from '../middleware/auth';
import { otpRateLimit } from '../middleware/rateLimit';
import { isPhoneWhitelisted, isValidE164 } from '../utils/whitelist';
import { hashPassword, verifyPassword } from '../utils/password';

const router = Router();

// POST /auth/login
router.post('/login', otpRateLimit, async (req: Request, res: Response): Promise<void> => {
  const { phone } = req.body as { phone?: string };

  if (!phone || typeof phone !== 'string') {
    res.status(400).json({ error: 'missing_fields', message: 'Phone number is required' });
    return;
  }

  const normalized = phone.trim();
  if (!isValidE164(normalized)) {
    res.status(400).json({ error: 'invalid_phone_format', message: 'Phone must be in E.164 format (+XXXXXXXXXXXX)' });
    return;
  }

  try {
    // 1. Check if user already exists
    const { data: existingUser } = await db
      .from('users')
      .select('id, phone, name, is_active')
      .eq('phone', normalized)
      .maybeSingle();

    if (existingUser) {
      if (!existingUser.is_active) {
        res.status(403).json({ error: 'account_deactivated', message: 'Your account has been deactivated' });
        return;
      }

      // Password-less login: Generate JWT immediately
      const token = signToken({ userId: existingUser.id, phone: existingUser.phone });
      res.json({
        status: 'ok',
        token,
        user: {
          id: existingUser.id,
          phone: existingUser.phone,
          name: existingUser.name,
          avatar_url: (existingUser as any).avatar_url ?? null
        }
      });
      return;
    }

    // 2. User does not exist, check if whitelisted
    const whitelisted = await isPhoneWhitelisted(normalized);
    if (!whitelisted) {
      res.status(403).json({ error: 'not_invited', message: 'This number is not on the invite list' });
      return;
    }

    // Whitelisted but not registered. Create setup token.
    const setupToken = signToken({ userId: 'pending', phone: normalized });
    res.json({ status: 'needs_registration', phone: normalized, setupToken });
  } catch (err: any) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'server_error', message: 'Internal server error' });
  }
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

  try {
    const whitelisted = await isPhoneWhitelisted(phone);
    if (!whitelisted) {
      res.status(403).json({ error: 'not_invited', message: 'Phone not on the invite list' });
      return;
    }

    // Set a default placeholder password hash since authentication is removed
    const passwordHash = hashPassword('no_password');

    // If user already exists but had no password, update it
    const { data: existingUser } = await db
      .from('users')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    let newUser;
    if (existingUser) {
      const { data: updated, error: updateError } = await db
        .from('users')
        .update({
          name: name.trim(),
          password_hash: passwordHash,
          avatar_url: avatarUrl ?? null
        })
        .eq('id', existingUser.id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      newUser = updated;
    } else {
      const { data: created, error: createError } = await db
        .from('users')
        .insert({
          phone,
          name: name.trim(),
          password_hash: passwordHash,
          avatar_url: avatarUrl ?? null
        })
        .select()
        .single();

      if (createError) {
        if (createError.code === '23505') {
          res.status(409).json({ error: 'already_registered', message: 'This phone is already registered' });
          return;
        }
        throw createError;
      }
      newUser = created;
    }

    const token = signToken({ userId: newUser.id, phone: newUser.phone });
    res.status(201).json({ token, user: newUser });
  } catch (err: any) {
    console.error('[Auth] Registration error:', err.message);
    res.status(500).json({ error: 'server_error', message: 'Failed to complete registration' });
  }
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
