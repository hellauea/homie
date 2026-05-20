import { Server, Socket } from 'socket.io';
import { db } from '../db/client';
import { SocketData } from '../types';
import { sendPushToConversationMembers } from '../utils/fcm';

// Online users tracker: userId -> Set of socket IDs
const onlineUsers = new Map<string, Set<string>>();

function getUserId(socket: Socket): string {
  return (socket.data as SocketData).userId;
}

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    const userId = getUserId(socket);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
      // Broadcast online status (first connection for this user)
      socket.broadcast.emit('user_online', { userId });
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Update last_seen
    db.from('users')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', userId)
      .then();

    // ── Join Conversation ──
    socket.on('join_conversation', async (data: { conversationId: string }) => {
      const { conversationId } = data;
      if (!conversationId) return;

      // Verify membership
      const { data: membership } = await db
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!membership) return;

      socket.join(`conv:${conversationId}`);
    });

    // ── Leave Conversation ──
    socket.on('leave_conversation', (data: { conversationId: string }) => {
      const { conversationId } = data;
      if (!conversationId) return;
      socket.leave(`conv:${conversationId}`);
    });

    // ── Send Message ──
    socket.on('send_message', async (data: {
      conversationId: string;
      type?: string;
      content: string;
      replyToId?: string;
    }) => {
      const { conversationId, type, content, replyToId } = data;
      if (!conversationId || !content) return;

      // Verify membership
      const { data: membership } = await db
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!membership) return;

      const validTypes = ['text', 'image', 'video', 'file', 'voice'];
      const msgType = type && validTypes.includes(type) ? type : 'text';

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

      if (error || !message) return;

      // Broadcast to all in the conversation room
      io.to(`conv:${conversationId}`).emit('new_message', message);

      // Send push notifications to offline members
      const { data: sender } = await db
        .from('users')
        .select('name')
        .eq('id', userId)
        .single();

      const senderName = sender?.name ?? 'Someone';
      const pushBody = msgType === 'text'
        ? content.slice(0, 100)
        : `Sent a ${msgType}`;

      sendPushToConversationMembers(conversationId, userId, {
        title: senderName,
        body: pushBody,
        data: { conversationId, messageId: message.id },
      }).catch(() => { /* silent */ });
    });

    // ── Typing Start ──
    socket.on('typing_start', async (data: { conversationId: string }) => {
      const { conversationId } = data;
      if (!conversationId) return;

      const { data: user } = await db
        .from('users')
        .select('name')
        .eq('id', userId)
        .single();

      socket.to(`conv:${conversationId}`).emit('user_typing', {
        conversationId,
        userId,
        name: user?.name ?? 'Someone',
      });
    });

    // ── Typing Stop ──
    socket.on('typing_stop', (data: { conversationId: string }) => {
      const { conversationId } = data;
      if (!conversationId) return;

      socket.to(`conv:${conversationId}`).emit('user_stopped_typing', {
        conversationId,
        userId,
      });
    });

    // ── Mark Read ──
    socket.on('mark_read', async (data: { conversationId: string; messageId: string }) => {
      const { conversationId, messageId } = data;
      if (!conversationId || !messageId) return;

      const readAt = new Date().toISOString();

      const { error } = await db
        .from('message_reads')
        .upsert({ message_id: messageId, user_id: userId, read_at: readAt });

      if (!error) {
        io.to(`conv:${conversationId}`).emit('read_receipt', {
          messageId,
          userId,
          readAt,
        });
      }
    });

    // ── Update Presence ──
    socket.on('update_presence', (data: { status: 'online' | 'offline' }) => {
      if (data.status === 'offline') {
        const lastSeen = new Date().toISOString();
        db.from('users')
          .update({ last_seen: lastSeen })
          .eq('id', userId)
          .then();

        socket.broadcast.emit('user_offline', { userId, lastSeen });
      } else {
        socket.broadcast.emit('user_online', { userId });
      }
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          const lastSeen = new Date().toISOString();

          db.from('users')
            .update({ last_seen: lastSeen })
            .eq('id', userId)
            .then();

          socket.broadcast.emit('user_offline', { userId, lastSeen });
        }
      }
    });
  });
}
