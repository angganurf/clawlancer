import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const checks: Record<string, unknown> = {};
  let healthy = true;

  // Database check
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("instaclaw_users")
      .select("id", { count: "exact", head: true });
    checks.database = error
      ? { status: "unhealthy", error: error.message }
      : { status: "healthy" };
    if (error) healthy = false;
  } catch (err) {
    checks.database = { status: "unhealthy", error: String(err) };
    healthy = false;
  }

  // VM pool stats
  try {
    const supabase = getSupabase();
    const { data } = await supabase.rpc("instaclaw_get_pool_stats");
    checks.vm_pool = data ?? { status: "unknown" };
  } catch {
    checks.vm_pool = { status: "unknown" };
  }

  // Stripe check (just verify key is set)
  checks.stripe = {
    status: process.env.STRIPE_SECRET_KEY ? "configured" : "not_configured",
  };

  // Hetzner check (just verify key is set)
  checks.hetzner = {
    status: process.env.HETZNER_API_TOKEN ? "configured" : "not_configured",
  };

  // Sentry check
  checks.sentry = {
    status: process.env.SENTRY_DSN ? "configured" : "not_configured",
  };

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}
