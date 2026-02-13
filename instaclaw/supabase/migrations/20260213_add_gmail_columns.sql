-- Add Gmail personality profiling columns to instaclaw_users
-- These store the Claude-generated insights from the Gmail onboarding step.
-- Raw email data is NEVER stored — only the AI-generated summary and insights.

ALTER TABLE instaclaw_users
  ADD COLUMN IF NOT EXISTS gmail_connected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gmail_insights JSONB,
  ADD COLUMN IF NOT EXISTS gmail_profile_summary TEXT;
