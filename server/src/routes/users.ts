import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /users/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const { data: user, error } = await db
    .from('users')
    .select('id, name, avatar_url, last_seen')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !user) {
    res.status(404).json({ error: 'user_not_found', message: 'User not found' });
    return;
  }

  res.json(user);
});

// PATCH /users/me
router.patch('/me', async (req: Request, res: Response): Promise<void> => {
  const { name, avatarUrl, fcmToken } = req.body as {
    name?: string;
    avatarUrl?: string;
    fcmToken?: string;
  };

  const updates: Record<string, string> = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
      res.status(400).json({ error: 'invalid_name', message: 'Name must be 1-50 characters' });
      return;
    }
    updates.name = name.trim();
  }

  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
  if (fcmToken !== undefined) updates.fcm_token = fcmToken;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'no_updates', message: 'Provide at least one field to update' });
    return;
  }

  const { data: updated, error } = await db
    .from('users')
    .update(updates)
    .eq('id', req.user!.userId)
    .select('id, name, avatar_url, last_seen')
    .single();

  if (error || !updated) {
    res.status(500).json({ error: 'update_failed', message: 'Failed to update profile' });
    return;
  }

  res.json(updated);
});

export default router;
