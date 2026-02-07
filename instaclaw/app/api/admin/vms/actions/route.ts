import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, vmId, userId } = await req.json();
  const supabase = getSupabase();

  switch (action) {
    case "destroy": {
      // Delete VM record (Hetzner deletion is separate)
      await supabase.from("instaclaw_vms").delete().eq("id", vmId);
      return NextResponse.json({ success: true });
    }

    case "reclaim": {
      // Unassign VM from user
      await supabase
        .from("instaclaw_vms")
        .update({
          assigned_to: null,
          status: "ready",
          gateway_url: null,
          control_ui_url: null,
          telegram_bot_username: null,
          health_status: "unknown",
        })
        .eq("id", vmId);
      return NextResponse.json({ success: true });
    }

    case "reconfigure": {
      // Trigger reconfigure for the VM
      const { data: vm } = await supabase
        .from("instaclaw_vms")
        .select("assigned_to")
        .eq("id", vmId)
        .single();

      if (!vm?.assigned_to) {
        return NextResponse.json(
          { error: "VM not assigned" },
          { status: 400 }
        );
      }

      const configRes = await fetch(
        `${process.env.NEXTAUTH_URL}/api/vm/configure`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Key": process.env.ADMIN_API_KEY ?? "",
          },
          body: JSON.stringify({ userId: vm.assigned_to }),
        }
      );

      return NextResponse.json({ success: configRes.ok });
    }

    case "cancel_subscription": {
      if (!userId)
        return NextResponse.json(
          { error: "userId required" },
          { status: 400 }
        );

      const { data: sub } = await supabase
        .from("instaclaw_subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", userId)
        .single();

      if (sub?.stripe_subscription_id) {
        const { getStripe } = await import("@/lib/stripe");
        const stripe = getStripe();
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      }

      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
