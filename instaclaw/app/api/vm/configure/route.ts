import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { configureOpenClaw, waitForHealth } from "@/lib/ssh";
import { validateAdminKey } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    // This endpoint is called internally by the billing webhook and cron jobs.
    // Require an admin API key for authentication.
    if (!validateAdminKey(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await req.json();
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get user's VM
    const { data: vm } = await supabase
      .from("instaclaw_vms")
      .select("*")
      .eq("assigned_to", userId)
      .single();

    if (!vm) {
      return NextResponse.json({ error: "No VM assigned" }, { status: 404 });
    }

    // Get pending user config
    const { data: pending } = await supabase
      .from("instaclaw_pending_users")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!pending) {
      return NextResponse.json(
        { error: "No pending configuration" },
        { status: 404 }
      );
    }

    // Configure OpenClaw on the VM
    const result = await configureOpenClaw(vm, {
      telegramBotToken: pending.telegram_bot_token,
      apiMode: pending.api_mode,
      apiKey: pending.api_key,
      tier: pending.tier,
    });

    // Wait for health check
    const healthy = await waitForHealth(result.gatewayUrl);

    // Update VM health status
    await supabase
      .from("instaclaw_vms")
      .update({
        health_status: healthy ? "healthy" : "unhealthy",
        last_health_check: new Date().toISOString(),
      })
      .eq("id", vm.id);

    // Mark user as onboarding complete BEFORE deleting pending record
    await supabase
      .from("instaclaw_users")
      .update({ onboarding_complete: true })
      .eq("id", userId);

    // Remove from pending
    await supabase
      .from("instaclaw_pending_users")
      .delete()
      .eq("user_id", userId);

    return NextResponse.json({
      configured: true,
      healthy,
    });
  } catch (err) {
    console.error("VM configure error:", err);
    return NextResponse.json(
      { error: "Failed to configure VM" },
      { status: 500 }
    );
  }
}
