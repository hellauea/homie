-- ============================================================
-- Squaad — Initial Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Users (created on first OTP verify)
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  fcm_token   TEXT,
  is_active   BOOLEAN DEFAULT true,
  last_seen   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Whitelist (only these numbers can register)
CREATE TABLE IF NOT EXISTS whitelist (
  phone       TEXT PRIMARY KEY,
  added_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at    TIMESTAMPTZ DEFAULT now()
);

-- Conversations (DMs and Groups)
CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT CHECK (type IN ('dm', 'group')) NOT NULL,
  name        TEXT,
  avatar_url  TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Conversation members
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  role             TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at        TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  type             TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'file', 'voice', 'deleted')),
  content          TEXT,
  reply_to_id      UUID REFERENCES messages(id) ON DELETE SET NULL,
  is_edited        BOOLEAN DEFAULT false,
  edited_at        TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Message read receipts
CREATE TABLE IF NOT EXISTS message_reads (
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- Reactions
CREATE TABLE IF NOT EXISTS reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- Pinned messages (per conversation)
CREATE TABLE IF NOT EXISTS pinned_messages (
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id       UUID REFERENCES messages(id) ON DELETE CASCADE,
  pinned_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  pinned_at        TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (conversation_id, message_id)
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_message_id ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id);

-- ============================================================
-- RPC Functions
-- ============================================================
-- Finds an existing DM between user_a and user_b
CREATE OR REPLACE FUNCTION find_existing_dm(user_a UUID, user_b UUID)
RETURNS SETOF conversations AS $$
BEGIN
  RETURN QUERY
  SELECT c.*
  FROM conversations c
  JOIN conversation_members cm1 ON c.id = cm1.conversation_id
  JOIN conversation_members cm2 ON c.id = cm2.conversation_id
  WHERE c.type = 'dm'
    AND cm1.user_id = user_a
    AND cm2.user_id = user_b;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
