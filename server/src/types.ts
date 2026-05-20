// ============================================================
// Squaad — Shared Types
// ============================================================

export interface User {
  id: string;
  phone: string;
  name: string;
  avatar_url: string | null;
  fcm_token: string | null;
  is_active: boolean;
  last_seen: string | null;
  created_at: string;
}

export interface WhitelistEntry {
  phone: string;
  added_by: string | null;
  added_at: string;
}

export type ConversationType = 'dm' | 'group';

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export type MessageType = 'text' | 'image' | 'video' | 'file' | 'voice' | 'deleted';

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
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface PinnedMessage {
  conversation_id: string;
  message_id: string;
  pinned_by: string | null;
  pinned_at: string;
}

// JWT payload stored in token
export interface JWTPayload {
  userId: string;
  phone: string;
  iat?: number;
  exp?: number;
}

// Attached to Express req after auth middleware
export interface AuthenticatedRequest extends Express.Request {
  user: JWTPayload;
}

// Socket data after auth
export interface SocketData {
  userId: string;
  phone: string;
}

// Standard error response shape
export interface ErrorResponse {
  error: string;
  message: string;
}
