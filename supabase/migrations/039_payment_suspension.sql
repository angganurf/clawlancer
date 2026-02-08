-- Add past_due_since column to track when payment became past_due
-- Used for grace period calculation before suspending VM

ALTER TABLE instaclaw_subscriptions
ADD COLUMN IF NOT EXISTS past_due_since TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_instaclaw_subscriptions_past_due_since
  ON instaclaw_subscriptions (past_due_since)
  WHERE past_due_since IS NOT NULL;

COMMENT ON COLUMN instaclaw_subscriptions.past_due_since IS
  'Timestamp when payment_status first became past_due. Used for 7-day grace period before VM suspension.';
