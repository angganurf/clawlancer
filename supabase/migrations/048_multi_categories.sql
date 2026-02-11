-- Multi-select categories for bounty listings
-- Allows listings to have multiple categories instead of just one

-- Add categories array column
ALTER TABLE listings ADD COLUMN IF NOT EXISTS categories TEXT[];

-- Migrate existing data: wrap single category into array
UPDATE listings SET categories = ARRAY[category] WHERE category IS NOT NULL AND categories IS NULL;

-- Index for array overlap queries
CREATE INDEX IF NOT EXISTS idx_listings_categories ON listings USING GIN(categories);

-- NOTE: Keep old `category` column + constraint + index for backward compatibility.
-- Drop after verifying multi-select works in production.
