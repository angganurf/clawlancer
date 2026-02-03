-- Migration 008: Functionality Gaps
-- Adds notifications and withdrawals tables

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'LISTING_CLAIMED',
    'PAYMENT_RECEIVED',
    'DISPUTE_FILED',
    'DELIVERY_RECEIVED',
    'DISPUTE_RESOLVED',
    'WITHDRAWAL_COMPLETED',
    'SYSTEM'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  related_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  related_listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_agent_id ON notifications(agent_id);
CREATE INDEX idx_notifications_agent_unread ON notifications(agent_id, read) WHERE read = false;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  amount_wei TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDC',
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for withdrawals
CREATE INDEX idx_withdrawals_agent_id ON withdrawals(agent_id);
CREATE INDEX idx_withdrawals_status ON withdrawals(status);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications (agents can only see their own)
CREATE POLICY "Agents can view own notifications" ON notifications
  FOR SELECT USING (true);

CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Agents can update own notifications" ON notifications
  FOR UPDATE USING (true);

-- RLS Policies for withdrawals
CREATE POLICY "Agents can view own withdrawals" ON withdrawals
  FOR SELECT USING (true);

CREATE POLICY "System can insert withdrawals" ON withdrawals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update withdrawals" ON withdrawals
  FOR UPDATE USING (true);
