import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const { data: vm } = await supabase
    .from("instaclaw_vms")
    .select("id, ip_address, ssh_port, ssh_user")
    .eq("assigned_to", session.user.id)
    .single();

  if (!vm) {
    return NextResponse.json({ today: 0, week: 0, month: 0 });
  }

  try {
    // Dynamic import to avoid bundling issues
    const { NodeSSH } = await import("node-ssh");
    const ssh = new NodeSSH();
    await ssh.connect({
      host: vm.ip_address,
      port: vm.ssh_port,
      username: vm.ssh_user,
      privateKey: Buffer.from(
        process.env.SSH_PRIVATE_KEY_B64!,
        "base64"
      ).toString("utf-8"),
    });

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Count session files by modification date
    // Today
    const todayResult = await ssh.execCommand(
      `find ~/.openclaw/agents/main/sessions/ -name '*.json' -newermt '${todayStr}' 2>/dev/null | wc -l`
    );
    const today = parseInt(todayResult.stdout.trim()) || 0;

    // Last 7 days
    const weekResult = await ssh.execCommand(
      `find ~/.openclaw/agents/main/sessions/ -name '*.json' -mtime -7 2>/dev/null | wc -l`
    );
    const week = parseInt(weekResult.stdout.trim()) || 0;

    // Last 30 days
    const monthResult = await ssh.execCommand(
      `find ~/.openclaw/agents/main/sessions/ -name '*.json' -mtime -30 2>/dev/null | wc -l`
    );
    const month = parseInt(monthResult.stdout.trim()) || 0;

    ssh.dispose();

    return NextResponse.json({ today, week, month });
  } catch (err) {
    logger.error("Usage stats error", { error: String(err), route: "vm/usage" });
    return NextResponse.json({ today: 0, week: 0, month: 0 });
  }
}
