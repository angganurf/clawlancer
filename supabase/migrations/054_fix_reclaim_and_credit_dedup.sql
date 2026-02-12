-- 054: Fix credit pack idempotency + clean VM reclaim
--
-- BUG 1: Add UNIQUE constraint on stripe_payment_intent to prevent
-- double-crediting when Stripe retries a webhook delivery.
--
-- BUG 3: Update instaclaw_reclaim_vm to also null out tier, api_mode,
-- and credit_balance so reclaimed VMs don't carry stale config.

-- Deduplicate any existing rows before adding constraint (safety)
DELETE FROM instaclaw_credit_purchases a
USING instaclaw_credit_purchases b
WHERE a.id > b.id
  AND a.stripe_payment_intent = b.stripe_payment_intent
  AND a.stripe_payment_intent IS NOT NULL;

ALTER TABLE instaclaw_credit_purchases
  ADD CONSTRAINT uq_credit_purchases_payment_intent
  UNIQUE (stripe_payment_intent);

-- Updated reclaim function: clears tier, api_mode, credit_balance
CREATE OR REPLACE FUNCTION instaclaw_reclaim_vm(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  vm_id UUID;
BEGIN
  SELECT id INTO vm_id FROM instaclaw_vms WHERE assigned_to = p_user_id;

  IF vm_id IS NULL THEN RETURN FALSE; END IF;

  UPDATE instaclaw_vms
  SET
    status = 'provisioning',
    assigned_to = NULL,
    assigned_at = NULL,
    gateway_token = NULL,
    gateway_url = NULL,
    control_ui_url = NULL,
    tier = NULL,
    api_mode = NULL,
    credit_balance = 0,
    updated_at = NOW()
  WHERE id = vm_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
