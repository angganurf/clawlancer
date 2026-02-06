-- =============================================================================
-- 023_instaclaw_signup_fixes.sql
--
-- Adds missing columns needed by the signup flow:
--   1. instaclaw_users.onboarding_complete  — tracks onboarding state
--   2. instaclaw_users.stripe_customer_id   — Stripe customer reference
--   3. instaclaw_pending_users.telegram_bot_username — resolved via getMe
--   4. instaclaw_vms.telegram_bot_username   — copied during VM config
--
-- Run manually via Supabase Dashboard SQL Editor.
-- =============================================================================

-- 1. Add onboarding_complete to instaclaw_users
ALTER TABLE instaclaw_users
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

-- 2. Add stripe_customer_id to instaclaw_users
ALTER TABLE instaclaw_users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_instaclaw_users_stripe_customer
  ON instaclaw_users (stripe_customer_id);

-- 3. Add telegram_bot_username to instaclaw_pending_users
ALTER TABLE instaclaw_pending_users
  ADD COLUMN IF NOT EXISTS telegram_bot_username TEXT;

-- 4. Add telegram_bot_username to instaclaw_vms
ALTER TABLE instaclaw_vms
  ADD COLUMN IF NOT EXISTS telegram_bot_username TEXT;
