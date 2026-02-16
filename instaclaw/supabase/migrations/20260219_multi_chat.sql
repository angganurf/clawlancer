-- Multi-chat: conversations table + alter messages + backfill

-- 1. Conversations table
CREATE TABLE IF NOT EXISTS instaclaw_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES instaclaw_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  last_message_preview TEXT DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_conversations_user_updated ON instaclaw_conversations(user_id, updated_at DESC);
ALTER TABLE instaclaw_conversations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_instaclaw_conversations_updated_at
  BEFORE UPDATE ON instaclaw_conversations FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Add conversation_id to messages (nullable for backfill)
ALTER TABLE instaclaw_chat_messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES instaclaw_conversations(id) ON DELETE CASCADE;
CREATE INDEX idx_chat_messages_conversation ON instaclaw_chat_messages(conversation_id, created_at ASC);

-- 3. Backfill: create "First Chat" per user with messages
INSERT INTO instaclaw_conversations (id, user_id, title, created_at, updated_at, message_count, last_message_preview)
SELECT gen_random_uuid(), m.user_id, 'First Chat', MIN(m.created_at), MAX(m.created_at), COUNT(*),
  LEFT((SELECT content FROM instaclaw_chat_messages WHERE user_id = m.user_id ORDER BY created_at DESC LIMIT 1), 100)
FROM instaclaw_chat_messages m WHERE m.conversation_id IS NULL GROUP BY m.user_id;

-- 4. Assign orphaned messages
UPDATE instaclaw_chat_messages msg SET conversation_id = c.id
FROM instaclaw_conversations c
WHERE msg.user_id = c.user_id AND c.title = 'First Chat' AND msg.conversation_id IS NULL;

-- 5. Make NOT NULL after backfill
ALTER TABLE instaclaw_chat_messages ALTER COLUMN conversation_id SET NOT NULL;
