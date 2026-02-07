import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { encryptApiKey } from "@/lib/security";
import { updateSystemPrompt, updateApiKey } from "@/lib/ssh";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    const supabase = getSupabase();

    // Get user's VM
    const { data: vm } = await supabase
      .from("instaclaw_vms")
      .select("*")
      .eq("assigned_to", session.user.id)
      .single();

    if (!vm) {
      return NextResponse.json({ error: "No VM assigned" }, { status: 404 });
    }

    switch (action) {
      case "update_system_prompt": {
        const { systemPrompt } = body;
        if (typeof systemPrompt !== "string") {
          return NextResponse.json(
            { error: "systemPrompt must be a string" },
            { status: 400 }
          );
        }
        if (systemPrompt.length > 2000) {
          return NextResponse.json(
            { error: "System prompt must be 2000 characters or less" },
            { status: 400 }
          );
        }

        // SSH to VM and update system prompt file
        await updateSystemPrompt(vm, systemPrompt);

        // Update DB
        await supabase
          .from("instaclaw_vms")
          .update({ system_prompt: systemPrompt || null })
          .eq("id", vm.id);

        return NextResponse.json({ updated: true });
      }

      case "rotate_api_key": {
        const { apiKey } = body;
        if (!apiKey || typeof apiKey !== "string") {
          return NextResponse.json(
            { error: "apiKey is required" },
            { status: 400 }
          );
        }

        if (vm.api_mode !== "byok") {
          return NextResponse.json(
            { error: "API key rotation is only available for BYOK mode" },
            { status: 400 }
          );
        }

        // SSH to VM and update the API key
        await updateApiKey(vm, apiKey);

        // Re-encrypt and store in pending_users (in case of re-configure)
        const encrypted = await encryptApiKey(apiKey);
        await supabase
          .from("instaclaw_pending_users")
          .update({ api_key: encrypted })
          .eq("user_id", session.user.id);

        return NextResponse.json({ updated: true });
      }

      case "update_discord_token": {
        const { discordToken } = body;
        if (!discordToken || typeof discordToken !== "string") {
          return NextResponse.json(
            { error: "discordToken is required" },
            { status: 400 }
          );
        }

        // SSH to VM and configure Discord channel
        const { NodeSSH } = await import("node-ssh");
        const ssh = new NodeSSH();
        await ssh.connect({
          host: vm.ip_address,
          port: vm.ssh_port,
          username: vm.ssh_user,
          privateKey: Buffer.from(process.env.SSH_PRIVATE_KEY_B64!, "base64").toString("utf-8"),
        });

        const NVM = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';
        const script = [
          '#!/bin/bash',
          NVM,
          `openclaw config set channels.discord.botToken '${discordToken}'`,
          `openclaw config set channels.discord.allowFrom '["*"]'`,
          'pkill -f "openclaw gateway" 2>/dev/null || true',
          'sleep 2',
          'nohup openclaw gateway run --bind lan --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &',
          'sleep 3',
        ].join('\n');

        await ssh.execCommand(`cat > /tmp/ic-discord.sh << 'ICEOF'\n${script}\nICEOF`);
        await ssh.execCommand('bash /tmp/ic-discord.sh; rm -f /tmp/ic-discord.sh');
        ssh.dispose();

        // Update DB
        const currentChannels: string[] = vm.channels_enabled ?? ["telegram"];
        if (!currentChannels.includes("discord")) {
          currentChannels.push("discord");
        }

        await supabase
          .from("instaclaw_vms")
          .update({
            discord_bot_token: discordToken,
            channels_enabled: currentChannels,
          })
          .eq("id", vm.id);

        return NextResponse.json({ updated: true });
      }

      case "update_slack_token": {
        const { slackToken, slackSigningSecret } = body;
        if (!slackToken || typeof slackToken !== "string") {
          return NextResponse.json(
            { error: "slackToken is required" },
            { status: 400 }
          );
        }

        const { NodeSSH: SSH2 } = await import("node-ssh");
        const sshSlack = new SSH2();
        await sshSlack.connect({
          host: vm.ip_address,
          port: vm.ssh_port,
          username: vm.ssh_user,
          privateKey: Buffer.from(process.env.SSH_PRIVATE_KEY_B64!, "base64").toString("utf-8"),
        });

        const NVM2 = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';
        const slackScript = [
          '#!/bin/bash',
          NVM2,
          `openclaw config set channels.slack.botToken '${slackToken}'`,
          ...(slackSigningSecret ? [`openclaw config set channels.slack.signingSecret '${slackSigningSecret}'`] : []),
          'pkill -f "openclaw gateway" 2>/dev/null || true',
          'sleep 2',
          'nohup openclaw gateway run --bind lan --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &',
          'sleep 3',
        ].join('\n');

        await sshSlack.execCommand(`cat > /tmp/ic-slack.sh << 'ICEOF'\n${slackScript}\nICEOF`);
        await sshSlack.execCommand('bash /tmp/ic-slack.sh; rm -f /tmp/ic-slack.sh');
        sshSlack.dispose();

        const slackChannels: string[] = vm.channels_enabled ?? ["telegram"];
        if (!slackChannels.includes("slack")) {
          slackChannels.push("slack");
        }

        await supabase
          .from("instaclaw_vms")
          .update({ channels_enabled: slackChannels })
          .eq("id", vm.id);

        return NextResponse.json({ updated: true });
      }

      case "update_whatsapp_token": {
        const { whatsappToken, whatsappPhoneId } = body;
        if (!whatsappToken || typeof whatsappToken !== "string") {
          return NextResponse.json(
            { error: "whatsappToken is required" },
            { status: 400 }
          );
        }

        const { NodeSSH: SSH3 } = await import("node-ssh");
        const sshWa = new SSH3();
        await sshWa.connect({
          host: vm.ip_address,
          port: vm.ssh_port,
          username: vm.ssh_user,
          privateKey: Buffer.from(process.env.SSH_PRIVATE_KEY_B64!, "base64").toString("utf-8"),
        });

        const NVM3 = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';
        const waScript = [
          '#!/bin/bash',
          NVM3,
          `openclaw config set channels.whatsapp.accessToken '${whatsappToken}'`,
          ...(whatsappPhoneId ? [`openclaw config set channels.whatsapp.phoneNumberId '${whatsappPhoneId}'`] : []),
          'pkill -f "openclaw gateway" 2>/dev/null || true',
          'sleep 2',
          'nohup openclaw gateway run --bind lan --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &',
          'sleep 3',
        ].join('\n');

        await sshWa.execCommand(`cat > /tmp/ic-wa.sh << 'ICEOF'\n${waScript}\nICEOF`);
        await sshWa.execCommand('bash /tmp/ic-wa.sh; rm -f /tmp/ic-wa.sh');
        sshWa.dispose();

        const waChannels: string[] = vm.channels_enabled ?? ["telegram"];
        if (!waChannels.includes("whatsapp")) {
          waChannels.push("whatsapp");
        }

        await supabase
          .from("instaclaw_vms")
          .update({ channels_enabled: waChannels })
          .eq("id", vm.id);

        return NextResponse.json({ updated: true });
      }

      case "update_tool_permissions": {
        const { tools } = body;
        if (!tools || typeof tools !== "object") {
          return NextResponse.json(
            { error: "tools object is required" },
            { status: 400 }
          );
        }

        const { updateToolPermissions } = await import("@/lib/ssh");
        await updateToolPermissions(vm, tools);
        return NextResponse.json({ updated: true });
      }

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (err) {
    logger.error("Settings update error", { error: String(err), route: "settings/update" });
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
