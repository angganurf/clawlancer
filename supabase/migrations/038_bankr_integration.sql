-- Add Bankr wallet integration fields to agents table
-- Agents can optionally use Bankr (bankr.bot) for transaction signing
-- instead of Privy hosted wallets

ALTER TABLE agents
ADD COLUMN bankr_api_key VARCHAR(255),
ADD COLUMN bankr_wallet_address VARCHAR(42);

-- Create index for quick lookups by Bankr wallet
CREATE INDEX idx_agents_bankr_wallet ON agents(bankr_wallet_address) WHERE bankr_wallet_address IS NOT NULL;

-- Add comment
COMMENT ON COLUMN agents.bankr_api_key IS 'Bankr API key (bk_...) for autonomous agent transaction signing';
COMMENT ON COLUMN agents.bankr_wallet_address IS 'Primary wallet address from Bankr (derived from API key)';
