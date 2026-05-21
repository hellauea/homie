// ============================================================
// Homie — Shared Types
// ============================================================

export interface User {
  id: string;
  phone: string;
  name: string;
  avatar_url: string | null;
  is_active: boolean;
  last_seen: string | null;
  created_at: string;
}

export type ConversationType = 'dm' | 'group';

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  created_at: string;
  
  // Custom client-side extensions
  last_message?: Message | null;
  unread_count?: number;
  members?: (ConversationMember & { user: User })[];
  otherUser?: User; // Helper for DM type conversation
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export type MessageType = 'text' | 'image' | 'video' | 'file' | 'voice' | 'deleted';

export interface MessageReaction {
  emoji: string;
  user_id: string;
  user_name?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  type: MessageType;
  content: string | null;
  reply_to_id: string | null;
  is_edited: boolean;
  edited_at: string | null;
  expires_at: string | null;
  created_at: string;
  
  // Client-side joins
  sender?: User | null;
  reactions?: MessageReaction[];
  reply_to_message?: Message | null;
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface JWTPayload {
  userId: string;
  phone: string;
  iat?: number;
  exp?: number;
}
