import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// POST /messages — REST fallback for sending messages
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { conversationId, type, content, replyToId } = req.body as {
    conversationId?: string;
    type?: string;
    content?: string;
    replyToId?: string;
  };

  if (!conversationId) {
    res.status(400).json({ error: 'missing_conversation_id', message: 'conversationId is required' });
    return;
  }

  if (!content || typeof content !== 'string') {
    res.status(400).json({ error: 'missing_content', message: 'content is required' });
    return;
  }

  const validTypes = ['text', 'image', 'video', 'file', 'voice'];
  const msgType = type ?? 'text';
  if (!validTypes.includes(msgType)) {
    res.status(400).json({ error: 'invalid_type', message: `type must be one of: ${validTypes.join(', ')}` });
    return;
  }

  // Verify membership
  const { data: membership } = await db
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    res.status(403).json({ error: 'not_a_member', message: 'You are not in this conversation' });
    return;
  }

  // Validate replyToId if provided
  if (replyToId) {
    const { data: replyMsg } = await db
      .from('messages')
      .select('id')
      .eq('id', replyToId)
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (!replyMsg) {
      res.status(400).json({ error: 'invalid_reply', message: 'Reply target message not found in this conversation' });
      return;
    }
  }

  const { data: message, error } = await db
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      type: msgType,
      content,
      reply_to_id: replyToId ?? null,
    })
    .select()
    .single();

  if (error || !message) {
    res.status(500).json({ error: 'send_failed', message: 'Failed to send message' });
    return;
  }

  res.status(201).json(message);
});

// PATCH /messages/:id — edit message (within 5-minute window)
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { content } = req.body as { content?: string };

  if (!content || typeof content !== 'string') {
    res.status(400).json({ error: 'missing_content', message: 'content is required' });
    return;
  }

  const { data: message } = await db
    .from('messages')
    .select('id, sender_id, created_at, type')
    .eq('id', id)
    .maybeSingle();

  if (!message) {
    res.status(404).json({ error: 'not_found', message: 'Message not found' });
    return;
  }

  if (message.sender_id !== userId) {
    res.status(403).json({ error: 'not_sender', message: 'You can only edit your own messages' });
    return;
  }

  if (message.type === 'deleted') {
    res.status(400).json({ error: 'already_deleted', message: 'Cannot edit a deleted message' });
    return;
  }

  // 5-minute edit window
  const createdAt = new Date(message.created_at).getTime();
  const fiveMinutes = 5 * 60 * 1000;
  if (Date.now() - createdAt > fiveMinutes) {
    res.status(403).json({ error: 'edit_window_expired', message: 'Messages can only be edited within 5 minutes' });
    return;
  }

  const { data: updated, error } = await db
    .from('messages')
    .update({ content, is_edited: true, edited_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error || !updated) {
    res.status(500).json({ error: 'edit_failed', message: 'Failed to edit message' });
    return;
  }

  res.json(updated);
});

// DELETE /messages/:id — delete for everyone
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  const { data: message } = await db
    .from('messages')
    .select('id, sender_id')
    .eq('id', id)
    .maybeSingle();

  if (!message) {
    res.status(404).json({ error: 'not_found', message: 'Message not found' });
    return;
  }

  if (message.sender_id !== userId) {
    res.status(403).json({ error: 'not_sender', message: 'You can only delete your own messages' });
    return;
  }

  const { error } = await db
    .from('messages')
    .update({ type: 'deleted', content: null })
    .eq('id', id);

  if (error) {
    res.status(500).json({ error: 'delete_failed', message: 'Failed to delete message' });
    return;
  }

  res.json({ ok: true });
});

// POST /messages/:id/pin
router.post('/:id/pin', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  const { data: message } = await db
    .from('messages')
    .select('id, conversation_id')
    .eq('id', id)
    .maybeSingle();

  if (!message) {
    res.status(404).json({ error: 'not_found', message: 'Message not found' });
    return;
  }

  // Verify membership
  const { data: membership } = await db
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', message.conversation_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    res.status(403).json({ error: 'not_a_member', message: 'You are not in this conversation' });
    return;
  }

  const { error } = await db
    .from('pinned_messages')
    .insert({
      conversation_id: message.conversation_id,
      message_id: id,
      pinned_by: userId,
    });

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'already_pinned', message: 'Message is already pinned' });
      return;
    }
    res.status(500).json({ error: 'pin_failed', message: 'Failed to pin message' });
    return;
  }

  res.status(201).json({ ok: true });
});

// DELETE /messages/:id/pin
router.delete('/:id/pin', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;

  const { data: pinned } = await db
    .from('pinned_messages')
    .select('conversation_id')
    .eq('message_id', id)
    .maybeSingle();

  if (!pinned) {
    res.status(404).json({ error: 'not_pinned', message: 'Message is not pinned' });
    return;
  }

  const { data: membership } = await db
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', pinned.conversation_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    res.status(403).json({ error: 'not_a_member', message: 'You are not in this conversation' });
    return;
  }

  const { error } = await db
    .from('pinned_messages')
    .delete()
    .eq('message_id', id);

  if (error) {
    res.status(500).json({ error: 'unpin_failed', message: 'Failed to unpin message' });
    return;
  }

  res.json({ ok: true });
});

// POST /messages/:id/reactions
router.post('/:id/reactions', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const { emoji } = req.body as { emoji?: string };

  if (!emoji || typeof emoji !== 'string') {
    res.status(400).json({ error: 'missing_emoji', message: 'emoji is required' });
    return;
  }

  const { data: message } = await db
    .from('messages')
    .select('id, conversation_id')
    .eq('id', id)
    .maybeSingle();

  if (!message) {
    res.status(404).json({ error: 'not_found', message: 'Message not found' });
    return;
  }

  const { data: membership } = await db
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', message.conversation_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) {
    res.status(403).json({ error: 'not_a_member', message: 'You are not in this conversation' });
    return;
  }

  const { error } = await db
    .from('reactions')
    .insert({ message_id: id, user_id: userId, emoji });

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'already_reacted', message: 'You already reacted with this emoji' });
      return;
    }
    res.status(500).json({ error: 'reaction_failed', message: 'Failed to add reaction' });
    return;
  }

  res.status(201).json({ ok: true });
});

// DELETE /messages/:id/reactions/:emoji
router.delete('/:id/reactions/:emoji', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { id, emoji } = req.params;

  const { error } = await db
    .from('reactions')
    .delete()
    .eq('message_id', id)
    .eq('user_id', userId)
    .eq('emoji', emoji);

  if (error) {
    res.status(500).json({ error: 'remove_reaction_failed', message: 'Failed to remove reaction' });
    return;
  }

  res.json({ ok: true });
});

export default router;
