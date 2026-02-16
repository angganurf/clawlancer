import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { resetAgentMemory } from "@/lib/ssh";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabase();

    const { data: vm } = await supabase
      .from("instaclaw_vms")
      .select("*")
      .eq("assigned_to", session.user.id)
      .single();

    if (!vm) {
      return NextResponse.json({ error: "No VM assigned" }, { status: 404 });
    }

    const result = await resetAgentMemory(vm);

    if (result.success) {
      await supabase
        .from("instaclaw_vms")
        .update({
          health_status: "unknown",
          last_health_check: new Date().toISOString(),
        })
        .eq("id", vm.id);
    }

    return NextResponse.json(result);
  } catch (err) {
    logger.error("Agent reset error", { error: String(err), route: "vm/reset-agent" });
    return NextResponse.json(
      { error: "Failed to reset agent memory" },
      { status: 500 }
    );
  }
}
