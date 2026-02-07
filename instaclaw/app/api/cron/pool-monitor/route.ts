import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import {
  createServer,
  waitForServer,
  resolveHetznerIds,
  getNextVmNumber,
  formatVmName,
  getImage,
  getSnapshotUserData,
  HETZNER_DEFAULTS,
} from "@/lib/hetzner";
import { sendAdminAlertEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

export const maxDuration = 120;

const MIN_POOL_SIZE = 2;
const MAX_AUTO_PROVISION = 3;
const MAX_TOTAL_VMS = parseInt(process.env.MAX_TOTAL_VMS ?? "20", 10);

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  // Count total VMs — cost ceiling check
  const { count: totalCount } = await supabase
    .from("instaclaw_vms")
    .select("*", { count: "exact", head: true });

  const total = totalCount ?? 0;

  if (total >= MAX_TOTAL_VMS) {
    logger.warn("Cost ceiling reached, skipping provisioning", { route: "cron/pool-monitor", total, maxTotalVms: MAX_TOTAL_VMS });

    // Alert admin that cost ceiling is blocking provisioning
    try {
      await sendAdminAlertEmail(
        "Cost Ceiling Reached",
        `VM provisioning blocked: ${total} VMs at ceiling of ${MAX_TOTAL_VMS}.\nReady VMs in pool may be depleted. Increase MAX_TOTAL_VMS or manually reclaim unused VMs.`
      );
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      ready: 0,
      needed: 0,
      provisioned: 0,
      total,
      message: `Cost ceiling reached: ${total} VMs. MAX_TOTAL_VMS=${MAX_TOTAL_VMS}`,
    });
  }

  // Count ready (unassigned) VMs
  const { count: readyCount } = await supabase
    .from("instaclaw_vms")
    .select("*", { count: "exact", head: true })
    .eq("status", "ready");

  const ready = readyCount ?? 0;

  if (ready >= MIN_POOL_SIZE) {
    return NextResponse.json({
      ready,
      needed: 0,
      provisioned: 0,
      message: `Pool healthy: ${ready} ready VMs`,
    });
  }

  const needed = MIN_POOL_SIZE - ready;
  const remaining = MAX_TOTAL_VMS - total;
  const toProvision = Math.min(needed, MAX_AUTO_PROVISION, remaining);

  if (toProvision <= 0) {
    logger.warn("Cannot provision: cost ceiling prevents it", { route: "cron/pool-monitor", remaining, needed });
    return NextResponse.json({
      ready,
      needed,
      provisioned: 0,
      total,
      message: `Cost ceiling prevents provisioning. ${remaining} slots remaining.`,
    });
  }

  logger.info("Pool low, provisioning VMs", { route: "cron/pool-monitor", ready, needed, toProvision });

  // Get existing VM names for numbering
  const { data: existingVms } = await supabase
    .from("instaclaw_vms")
    .select("name")
    .order("created_at", { ascending: false })
    .limit(200);

  const existingNames = (existingVms ?? []).map(
    (v: { name: string | null }) => v.name
  );
  const startNum = getNextVmNumber(existingNames);

  let sshKeyId: number;
  let firewallId: number;
  try {
    const ids = await resolveHetznerIds();
    sshKeyId = ids.sshKeyId;
    firewallId = ids.firewallId;
  } catch (err) {
    logger.error("Failed to resolve Hetzner IDs", { error: String(err), route: "cron/pool-monitor" });
    return NextResponse.json(
      { error: "Failed to resolve Hetzner resource IDs" },
      { status: 500 }
    );
  }

  const image = getImage();
  const userData = getSnapshotUserData();
  const isSnapshot = !!process.env.HETZNER_SNAPSHOT_ID;

  const provisioned: { name: string; ip: string }[] = [];

  for (let i = 0; i < toProvision; i++) {
    const vmName = formatVmName(startNum + i);

    try {
      const server = await createServer({
        name: vmName,
        image,
        sshKeyId,
        firewallId,
        userData,
      });

      const readyServer = await waitForServer(server.id);
      const ip = readyServer.public_net.ipv4.ip;

      const { error } = await supabase.from("instaclaw_vms").insert({
        ip_address: ip,
        name: vmName,
        hetzner_server_id: String(server.id),
        ssh_port: 22,
        ssh_user: "openclaw",
        status: isSnapshot ? "ready" : "provisioning",
        region: HETZNER_DEFAULTS.region,
        server_type: HETZNER_DEFAULTS.serverType,
      });

      if (error) {
        logger.error("DB insert failed for VM", { error: error.message, route: "cron/pool-monitor", vmName });
        continue;
      }

      provisioned.push({ name: vmName, ip });
      logger.info("Created VM", { route: "cron/pool-monitor", vmName, ip });
    } catch (err) {
      logger.error("Failed to provision VM", { error: String(err), route: "cron/pool-monitor", vmName });
    }
  }

  return NextResponse.json({
    ready,
    needed,
    provisioned: provisioned.length,
    vms: provisioned,
    mode: isSnapshot ? "snapshot" : "fresh",
    note: isSnapshot
      ? "VMs created from snapshot with cloud-init. Status: ready."
      : 'New VMs are in "provisioning" status. Run install-openclaw.sh to finalize.',
  });
}
