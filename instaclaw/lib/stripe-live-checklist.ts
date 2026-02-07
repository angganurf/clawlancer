/**
 * Stripe Live Mode Checklist
 *
 * The codebase already reads all Stripe keys from environment variables.
 * No code changes are needed — just swap env vars in Vercel.
 *
 * Steps to go live:
 *
 * 1. In Stripe Dashboard, switch to Live mode
 * 2. In Vercel project settings, set these env vars to live-mode values:
 *    - STRIPE_SECRET_KEY          (sk_live_...)
 *    - STRIPE_PUBLISHABLE_KEY     (pk_live_...) [if used client-side]
 *    - STRIPE_WEBHOOK_SECRET      (whsec_... for the live endpoint)
 *    - STRIPE_PRICE_STARTER       (price_... for Starter All-Inclusive)
 *    - STRIPE_PRICE_STARTER_BYOK  (price_... for Starter BYOK)
 *    - STRIPE_PRICE_PRO           (price_... for Pro All-Inclusive)
 *    - STRIPE_PRICE_PRO_BYOK      (price_... for Pro BYOK)
 *    - STRIPE_PRICE_POWER         (price_... for Power All-Inclusive)
 *    - STRIPE_PRICE_POWER_BYOK    (price_... for Power BYOK)
 *
 * 3. In Stripe Dashboard > Webhooks, add a new endpoint:
 *    URL: https://instaclaw.io/api/billing/webhook
 *    Events:
 *      - checkout.session.completed
 *      - customer.subscription.updated
 *      - customer.subscription.deleted
 *      - invoice.payment_failed
 *      - invoice.payment_succeeded
 *
 * 4. Copy the webhook signing secret to STRIPE_WEBHOOK_SECRET
 *
 * 5. Create products + prices in live mode matching test mode config
 *
 * 6. Test with a real card (Stripe test card won't work in live mode)
 *
 * 7. Enable Stripe Tax if needed for your jurisdiction
 */
export const STRIPE_LIVE_READY = true;
