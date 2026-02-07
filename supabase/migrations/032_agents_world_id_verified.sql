-- Add world_id_verified flag to agents table for public profile badge display
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS world_id_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS world_id_verified_at TIMESTAMPTZ;
