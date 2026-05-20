import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// GET /conversations
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const { data, error } = await db
    .from('conversation_members')
    .select(`
      conversation:conversations (
        id, type, name, avatar_url, created_at,
        conversation_members ( user_id, role )
      )
    `)
    .eq('user_id', userId);

  if (error) {
    res.status(500).json({ error: 'db_error', message: 'Failed to fetch conversations' });
    return;
  }

  res.json(data?.map((d) => d.conversation) ?? []);
});

// POST /conversations
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { type, name, memberIds } = req.body as {
    type?: string;
    name?: string;
    memberIds?: string[];
  };

  if (!type || !['dm', 'group'].includes(type)) {
    res.status(400).json({ error: 'invalid_type', message: 'type must be "dm" or "group"' });
    return;
  }

  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    res.status(400).json({ error: 'missing_members', message: 'memberIds array is required' });
    return;
  }

  if (type === 'group' && (!name || name.trim().length < 1)) {
    res.status(400).json({ error: 'missing_name', message: 'Group name is required' });
    return;
  }

  if (type === 'dm' && memberIds.length !== 1) {
    res.status(400).json({ error: 'invalid_dm', message: 'DM requires exactly one other member' });
    return;
  }

  const allMemberIds = [...new Set([userId, ...memberIds])];

  if (type === 'dm') {
    const otherId = memberIds[0];
    const { data: existing } = await db.rpc('find_existing_dm', {
      user_a: userId,
      user_b: otherId,
    });
    if (existing && existing.length > 0) {
      res.json(existing[0]);
      return;
    }
  }

  const { data: conversation, error: convError } = await db
    .from('conversations')
    .insert({ type, name: type === 'group' ? name!.trim() : null, created_by: userId })
    .select()
    .single();

  if (convError || !conversation) {
    res.status(500).json({ error: 'create_failed', message: 'Failed to create conversation' });
    return;
  }

  const members = allMemberIds.map((uid) => ({
    conversation_id: conversation.id,
    user_id: uid,
    role: uid === userId ? 'admin' : 'member',
  }));

  const { error: membersError } = await db.from('conversation_members').insert(members);

  if (membersError) {
    await db.from('conversations').delete().eq('id', conversation.id);
    res.status(500).json({ error: 'members_failed', message: 'Failed to add members' });
    return;
  }

  res.status(201).json(conversation);
});

// GET /conversations/:id
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  const { data: membership } = await db
    .from('conversation_members')
    .select('role')
    .eq('conversation_id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    res.status(403).json({ error: 'not_a_member', message: 'You are not in this conversation' });
    return;
  }

  const { data, error } = await db
    .from('conversations')
    .select(`
      id, type, name, avatar_url, created_at,
      conversation_members (
        user_id, role, joined_at,
        user:users ( id, name, avatar_url, last_seen )
      )
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    res.status(404).json({ error: 'not_found', message: 'Conversation not found' });
    return;
  }

  res.json(data);
});

// PATCH /conversations/:id (admin only)
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { name, avatarUrl } = req.body as { name?: string; avatarUrl?: string };

  const { data: membership } = await db
    .from('conversation_members')
    .select('role')
    .eq('conversation_id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    res.status(403).json({ error: 'not_a_member', message: 'You are not in this conversation' });
    return;
  }

  if (membership.role !== 'admin') {
    res.status(403).json({ error: 'not_admin', message: 'Only admins can update group info' });
    return;
  }

  const updates: Record<string, string> = {};
  if (name !== undefined) updates.name = name.trim();
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'no_updates', message: 'Nothing to update' });
    return;
  }

  const { data: updated, error } = await db
    .from('conversations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !updated) {
    res.status(500).json({ error: 'update_failed', message: 'Failed to update conversation' });
    return;
  }

  res.json(updated);
});

// DELETE /conversations/:id/leave
router.delete('/:id/leave', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  const { error } = await db
    .from('conversation_members')
    .delete()
    .eq('conversation_id', id)
    .eq('user_id', userId);

  if (error) {
    res.status(500).json({ error: 'leave_failed', message: 'Failed to leave conversation' });
    return;
  }

  res.json({ ok: true });
});

// POST /conversations/:id/members (admin only)
router.post('/:id/members', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { userId: targetUserId } = req.body as { userId?: string };

  if (!targetUserId) {
    res.status(400).json({ error: 'missing_user_id', message: 'userId is required' });
    return;
  }

  const { data: membership } = await db
    .from('conversation_members')
    .select('role')
    .eq('conversation_id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership || membership.role !== 'admin') {
    res.status(403).json({ error: 'not_admin', message: 'Only admins can add members' });
    return;
  }

  const { error } = await db
    .from('conversation_members')
    .insert({ conversation_id: id, user_id: targetUserId, role: 'member' });

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'already_member', message: 'User is already in this conversation' });
      return;
    }
    res.status(500).json({ error: 'add_failed', message: 'Failed to add member' });
    return;
  }

  res.status(201).json({ ok: true });
});

// DELETE /conversations/:id/members/:targetUserId (admin only)
router.delete('/:id/members/:targetUserId', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id, targetUserId } = req.params;

  const { data: membership } = await db
    .from('conversation_members')
    .select('role')
    .eq('conversation_id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership || membership.role !== 'admin') {
    res.status(403).json({ error: 'not_admin', message: 'Only admins can remove members' });
    return;
  }

  const { error } = await db
    .from('conversation_members')
    .delete()
    .eq('conversation_id', id)
    .eq('user_id', targetUserId);

  if (error) {
    res.status(500).json({ error: 'remove_failed', message: 'Failed to remove member' });
    return;
  }

  res.json({ ok: true });
});

// GET /conversations/:id/messages (cursor-based, 30 per page)
router.get('/:id/messages', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { cursor } = req.query as { cursor?: string };

  const { data: membership } = await db
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    res.status(403).json({ error: 'not_a_member', message: 'You are not in this conversation' });
    return;
  }

  let query = db
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: messages, error } = await query;

  if (error) {
    res.status(500).json({ error: 'db_error', message: 'Failed to fetch messages' });
    return;
  }

  const nextCursor =
    messages && messages.length === 30
      ? messages[messages.length - 1].created_at
      : null;

  res.json({ messages: messages ?? [], nextCursor });
});

// GET /conversations/:id/pinned
router.get('/:id/pinned', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  const { data: membership } = await db
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    res.status(403).json({ error: 'not_a_member', message: 'You are not in this conversation' });
    return;
  }

  const { data, error } = await db
    .from('pinned_messages')
    .select('*, message:messages(*)')
    .eq('conversation_id', id)
    .order('pinned_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: 'db_error', message: 'Failed to fetch pinned messages' });
    return;
  }

  res.json(data ?? []);
});

export default router;
