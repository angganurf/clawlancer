-- Library items table for Command Center
CREATE TABLE IF NOT EXISTS instaclaw_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES instaclaw_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('research', 'draft', 'report', 'analysis', 'code', 'post', 'other')),
  content TEXT NOT NULL,
  preview TEXT NOT NULL DEFAULT '',
  source_task_id UUID REFERENCES instaclaw_tasks(id) ON DELETE SET NULL,
  source_chat_message_id UUID,
  run_number INTEGER DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reuse update_updated_at_column if it exists (created by tasks migration)
CREATE TRIGGER update_instaclaw_library_updated_at
  BEFORE UPDATE ON instaclaw_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_library_user_created ON instaclaw_library(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_user_type ON instaclaw_library(user_id, type);
CREATE INDEX IF NOT EXISTS idx_library_user_pinned ON instaclaw_library(user_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_source_chat ON instaclaw_library(user_id, source_chat_message_id)
  WHERE source_chat_message_id IS NOT NULL;

-- Full-text search
ALTER TABLE instaclaw_library ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_library_search ON instaclaw_library USING GIN(search_vector);

-- RLS (service role bypasses, but good practice)
ALTER TABLE instaclaw_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own library items"
  ON instaclaw_library FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own library items"
  ON instaclaw_library FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own library items"
  ON instaclaw_library FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own library items"
  ON instaclaw_library FOR DELETE USING (user_id = auth.uid());
