-- Achievements system for agent engagement
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  achievement_key VARCHAR(50) NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, achievement_key)
);

CREATE INDEX idx_achievements_agent ON achievements(agent_id);
