import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { isValidE164, normalizePhone } from '../utils/whitelist';

const router = Router();
router.use(requireAuth);

// GET /admin/whitelist — list all whitelisted numbers
router.get('/whitelist', async (req: Request, res: Response): Promise<void> => {
  const { data, error } = await db
    .from('whitelist')
    .select('phone, added_by, added_at')
    .order('added_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: 'db_error', message: 'Failed to fetch whitelist' });
    return;
  }

  res.json(data ?? []);
});

// POST /admin/whitelist — add a phone number
router.post('/whitelist', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { phone } = req.body as { phone?: string };

  if (!phone || typeof phone !== 'string') {
    res.status(400).json({ error: 'missing_phone', message: 'phone is required' });
    return;
  }

  let normalized: string;
  try {
    normalized = normalizePhone(phone);
  } catch {
    res.status(400).json({ error: 'invalid_phone', message: 'Phone must be in E.164 format' });
    return;
  }

  if (!isValidE164(normalized)) {
    res.status(400).json({ error: 'invalid_phone', message: 'Phone must be valid E.164 format' });
    return;
  }

  const { error } = await db
    .from('whitelist')
    .insert({ phone: normalized, added_by: userId });

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'already_whitelisted', message: 'This number is already on the list' });
      return;
    }
    res.status(500).json({ error: 'db_error', message: 'Failed to add to whitelist' });
    return;
  }

  res.status(201).json({ ok: true, phone: normalized });
});

// DELETE /admin/whitelist/:phone — remove a phone number
router.delete('/whitelist/:phone', async (req: Request, res: Response): Promise<void> => {
  const { phone } = req.params;

  const decoded = decodeURIComponent(phone);

  const { error, count } = await db
    .from('whitelist')
    .delete()
    .eq('phone', decoded);

  if (error) {
    res.status(500).json({ error: 'db_error', message: 'Failed to remove from whitelist' });
    return;
  }

  if (count === 0) {
    res.status(404).json({ error: 'not_found', message: 'Phone not found in whitelist' });
    return;
  }

  res.json({ ok: true });
});

export default router;
