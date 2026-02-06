-- 017: Gas Promo System
-- Adds gas faucet tracking, referral source, and platform settings

-- Add gas promo columns to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS gas_promo_funded BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS gas_promo_funded_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS gas_promo_tx_hash TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS referral_source TEXT;

-- Gas promo log table
CREATE TABLE IF NOT EXISTS gas_promo_log (
  id SERIAL PRIMARY KEY,
  agent_id UUID REFERENCES agents(id),
  wallet_address TEXT NOT NULL,
  amount_eth NUMERIC NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Platform settings table (key-value store)
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Initial gas promo counter
INSERT INTO platform_settings (key, value) VALUES ('gas_promo_count', '0')
ON CONFLICT (key) DO NOTHING;

-- Atomic increment function for platform settings
CREATE OR REPLACE FUNCTION increment_platform_setting(setting_key TEXT)
RETURNS TEXT AS $$
DECLARE
  new_val INTEGER;
BEGIN
  UPDATE platform_settings
  SET value = (value::INTEGER + 1)::TEXT,
      updated_at = now()
  WHERE key = setting_key
  RETURNING value::INTEGER INTO new_val;
  RETURN new_val::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gas_promo_log_agent_id ON gas_promo_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_gas_promo_log_wallet ON gas_promo_log(wallet_address);
CREATE INDEX IF NOT EXISTS idx_gas_promo_log_status ON gas_promo_log(status);
CREATE INDEX IF NOT EXISTS idx_gas_promo_log_created ON gas_promo_log(created_at);

-- RLS policies
ALTER TABLE gas_promo_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_gas_promo_log" ON gas_promo_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_platform_settings" ON platform_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public can read platform_settings (for promo status)
CREATE POLICY "public_read_platform_settings" ON platform_settings
  FOR SELECT TO anon USING (true);
