-- 030_platform_build.sql
-- Platform build: schema additions for phases 1-5

-- Payment status tracking (Phase 1)
ALTER TABLE instaclaw_subscriptions
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'current';

-- Bot personality (Phase 2)
ALTER TABLE instaclaw_vms
  ADD COLUMN IF NOT EXISTS system_prompt TEXT;

-- Health monitoring (Phase 4)
ALTER TABLE instaclaw_vms
  ADD COLUMN IF NOT EXISTS health_fail_count INT DEFAULT 0;

-- Discord support (Phase 3)
ALTER TABLE instaclaw_pending_users
  ADD COLUMN IF NOT EXISTS discord_bot_token TEXT;
ALTER TABLE instaclaw_vms
  ADD COLUMN IF NOT EXISTS discord_bot_token TEXT;

-- Multi-channel tracking (Phase 3)
ALTER TABLE instaclaw_vms
  ADD COLUMN IF NOT EXISTS channels_enabled TEXT[] DEFAULT '{telegram}';

-- Brave web search (Phase 3)
ALTER TABLE instaclaw_vms
  ADD COLUMN IF NOT EXISTS brave_api_key TEXT;

-- Trial tracking (Phase 3)
ALTER TABLE instaclaw_subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Backups (Phase 4)
CREATE TABLE IF NOT EXISTS instaclaw_vm_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vm_id UUID REFERENCES instaclaw_vms(id),
  backup_path TEXT NOT NULL,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Environment variables (Item 29)
CREATE TABLE IF NOT EXISTS instaclaw_env_vars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES instaclaw_users(id) ON DELETE CASCADE,
  var_name TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, var_name)
);

-- Audit log for env var operations (Item 29)
CREATE TABLE IF NOT EXISTS instaclaw_env_var_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES instaclaw_users(id) ON DELETE CASCADE,
  var_name TEXT NOT NULL,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'reveal'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for env vars
ALTER TABLE instaclaw_env_vars ENABLE ROW LEVEL SECURITY;
ALTER TABLE instaclaw_env_var_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on env_vars" ON instaclaw_env_vars;
CREATE POLICY "Service role full access on env_vars"
  ON instaclaw_env_vars FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access on env_var_audit" ON instaclaw_env_var_audit;
CREATE POLICY "Service role full access on env_var_audit"
  ON instaclaw_env_var_audit FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RLS for backups
ALTER TABLE instaclaw_vm_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on vm_backups" ON instaclaw_vm_backups;
CREATE POLICY "Service role full access on vm_backups"
  ON instaclaw_vm_backups FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- FK indexes for query performance
CREATE INDEX IF NOT EXISTS idx_instaclaw_vm_backups_vm_id
  ON instaclaw_vm_backups(vm_id);
CREATE INDEX IF NOT EXISTS idx_instaclaw_env_vars_user_id
  ON instaclaw_env_vars(user_id);
CREATE INDEX IF NOT EXISTS idx_instaclaw_env_var_audit_user_id
  ON instaclaw_env_var_audit(user_id);

-- Trigger for env_vars updated_at
CREATE OR REPLACE FUNCTION instaclaw_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS instaclaw_env_vars_updated_at ON instaclaw_env_vars;
CREATE TRIGGER instaclaw_env_vars_updated_at
  BEFORE UPDATE ON instaclaw_env_vars
  FOR EACH ROW EXECUTE FUNCTION instaclaw_set_updated_at();

-- Drop unused tables (Phase 1)
DROP TABLE IF EXISTS instaclaw_messages;
DROP TABLE IF EXISTS instaclaw_credits;
DROP TABLE IF EXISTS instaclaw_bots;
