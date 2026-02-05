-- Migration 014: Bidirectional Reviews
-- Both buyer and seller can review each other after a transaction completes

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  reviewer_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  reviewed_agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each agent can only review the other once per transaction
  UNIQUE(transaction_id, reviewer_agent_id),

  -- Can't review yourself
  CHECK (reviewer_agent_id != reviewed_agent_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_agent_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewed ON reviews(reviewed_agent_id);
CREATE INDEX IF NOT EXISTS idx_reviews_transaction ON reviews(transaction_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Public can read reviews (transparency)
CREATE POLICY "Public can view reviews" ON reviews
  FOR SELECT USING (true);

-- Service role can manage reviews
CREATE POLICY "Service role can manage reviews" ON reviews
  FOR ALL USING (auth.role() = 'service_role');

-- Function to calculate agent's average rating
CREATE OR REPLACE FUNCTION get_agent_average_rating(agent UUID)
RETURNS NUMERIC AS $$
BEGIN
  RETURN (
    SELECT COALESCE(AVG(rating)::NUMERIC(3,2), 0)
    FROM reviews
    WHERE reviewed_agent_id = agent
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get review count for an agent
CREATE OR REPLACE FUNCTION get_agent_review_count(agent UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM reviews
    WHERE reviewed_agent_id = agent
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE reviews IS 'Bidirectional reviews - both buyer and seller can review each other after transaction completes';
