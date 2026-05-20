import { Socket } from 'socket.io-client';
import { useChatStore } from '../store/chatStore';
import { useUIStore } from '../store/uiStore';
import { Message } from '../types';

export function setupSocketListeners(socket: Socket): void {
  // Clear any existing listeners to prevent duplicates
  socket.off('new_message');
  socket.off('message_edited');
  socket.off('message_deleted');
  socket.off('reaction_added');
  socket.off('reaction_removed');
  socket.off('user_typing');
  socket.off('user_stopped_typing');
  socket.off('user_online');
  socket.off('user_offline');

  console.log('[Socket] Setting up real-time event listeners');

  // ── Message Events ──
  socket.on('new_message', (message: Message) => {
    console.log('[Socket] New message received:', message.id);
    useChatStore.getState().appendMessage(message);
  });

  socket.on('message_edited', (message: Message) => {
    console.log('[Socket] Message edited:', message.id);
    useChatStore.getState().updateMessage(message);
  });

  socket.on('message_deleted', (data: { conversationId: string; messageId: string }) => {
    console.log('[Socket] Message deleted:', data.messageId);
    useChatStore.getState().removeMessage(data.conversationId, data.messageId);
  });

  // ── Reaction Events ──
  socket.on('reaction_added', (data: { conversationId: string; messageId: string; reaction: { emoji: string; user_id: string } }) => {
    console.log('[Socket] Reaction added:', data.messageId, data.reaction.emoji);
    useChatStore.getState().addLocalReaction(data.messageId, data.reaction.user_id, data.reaction.emoji);
  });

  socket.on('reaction_removed', (data: { conversationId: string; messageId: string; emoji: string; user_id: string }) => {
    console.log('[Socket] Reaction removed:', data.messageId, data.emoji);
    useChatStore.getState().removeLocalReaction(data.messageId, data.user_id, data.emoji);
  });

  // ── Typing Events ──
  socket.on('user_typing', (data: { conversationId: string; userId: string; name: string }) => {
    console.log('[Socket] User typing:', data.name);
    useUIStore.getState().setTyping(data.conversationId, data.userId, data.name, true);
  });

  socket.on('user_stopped_typing', (data: { conversationId: string; userId: string }) => {
    console.log('[Socket] User stopped typing:', data.userId);
    useUIStore.getState().setTyping(data.conversationId, data.userId, '', false);
  });

  // ── Presence Events ──
  socket.on('user_online', (data: { userId: string }) => {
    console.log('[Socket] User online:', data.userId);
    useUIStore.getState().setOnline(data.userId, true);
  });

  socket.on('user_offline', (data: { userId: string }) => {
    console.log('[Socket] User offline:', data.userId);
    useUIStore.getState().setOnline(data.userId, false);
  });
}
