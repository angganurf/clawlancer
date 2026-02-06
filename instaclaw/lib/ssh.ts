import { getSupabase } from "./supabase";
import { generateGatewayToken, encryptApiKey } from "./security";

interface VMRecord {
  id: string;
  ip_address: string;
  ssh_port: number;
  ssh_user: string;
  assigned_to?: string;
}

interface UserConfig {
  telegramBotToken: string;
  apiMode: "all_inclusive" | "byok";
  apiKey?: string;
  tier: string;
  model?: string;
}

// Strict input validation to prevent shell injection
function assertSafeShellArg(value: string, label: string): void {
  // Only allow alphanumeric, dashes, underscores, colons, dots, and slashes
  if (!/^[A-Za-z0-9_:.\-\/]+$/.test(value)) {
    throw new Error(`Invalid characters in ${label}`);
  }
}

// Dynamic import to avoid Turbopack bundling issues with ssh2's native crypto
async function connectSSH(vm: VMRecord) {
  if (!process.env.SSH_PRIVATE_KEY_B64) {
    throw new Error("SSH_PRIVATE_KEY_B64 not set");
  }
  const { NodeSSH } = await import("node-ssh");
  const ssh = new NodeSSH();
  await ssh.connect({
    host: vm.ip_address,
    port: vm.ssh_port,
    username: vm.ssh_user,
    privateKey: Buffer.from(process.env.SSH_PRIVATE_KEY_B64, 'base64').toString('utf-8'),
  });
  return ssh;
}

export async function configureOpenClaw(
  vm: VMRecord,
  config: UserConfig
): Promise<{ gatewayUrl: string; gatewayToken: string; controlUiUrl: string }> {
  // Validate BYOK mode has an API key
  if (config.apiMode === "byok" && !config.apiKey) {
    throw new Error("API key required for BYOK mode");
  }

  const ssh = await connectSSH(vm);

  try {
    const gatewayToken = generateGatewayToken();

    // Validate all inputs before building the shell command
    assertSafeShellArg(config.telegramBotToken, "telegramBotToken");
    assertSafeShellArg(gatewayToken, "gatewayToken");

    const apiArg =
      config.apiMode === "byok" ? config.apiKey! : "ALL_INCLUSIVE";
    assertSafeShellArg(apiArg, "apiKey");

    const modelArg = config.model || "claude-sonnet-4-5-20250929";
    assertSafeShellArg(modelArg, "model");

    // For all-inclusive mode, pass proxy URL instead of raw API key.
    // The VM gateway calls our proxy which holds the real API key and enforces rate limits.
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
    const proxyEnv =
      config.apiMode === "all_inclusive" && appUrl
        ? (() => {
            const proxyUrl = `${appUrl.startsWith("http") ? appUrl : `https://${appUrl}`}/api/gateway/proxy`;
            assertSafeShellArg(proxyUrl.replace(/[:/]/g, "_"), "proxyUrl"); // validate sans URL chars
            return `ANTHROPIC_PROXY_URL='${proxyUrl}' `;
          })()
        : "";

    // For all-inclusive: pass a placeholder API key (the proxy holds the real one).
    // For BYOK: ANTHROPIC_API_KEY env var is not needed (key is in the apiArg).
    const envPrefix =
      config.apiMode === "all_inclusive" && process.env.ANTHROPIC_API_KEY
        ? (() => {
            assertSafeShellArg(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY");
            return `ANTHROPIC_API_KEY='${process.env.ANTHROPIC_API_KEY}' `;
          })()
        : "";

    const result = await ssh.execCommand(
      `${envPrefix}${proxyEnv}bash ~/openclaw/scripts/configure-vm.sh '${config.telegramBotToken}' '${apiArg}' '${gatewayToken}' '${modelArg}'`
    );

    if (result.code !== 0) {
      console.error("configure-vm.sh failed:", result.stderr);
      throw new Error(`VM configuration failed: ${result.stderr}`);
    }

    // External URLs go through Caddy (HTTPS on 443)
    const gatewayUrl = `https://${vm.ip_address}`;
    const controlUiUrl = `https://${vm.ip_address}`;

    // Encrypt the BYOK API key before storing in the database
    const encryptedApiKey =
      config.apiMode === "byok" && config.apiKey
        ? await encryptApiKey(config.apiKey)
        : null;

    // Update VM record in Supabase
    const supabase = getSupabase();
    const { error: vmError } = await supabase
      .from("instaclaw_vms")
      .update({
        gateway_url: gatewayUrl,
        gateway_token: gatewayToken,
        control_ui_url: controlUiUrl,
        default_model: modelArg,
      })
      .eq("id", vm.id);

    if (vmError) {
      console.error("Failed to update VM record:", vmError);
      throw new Error("Failed to update VM record in database");
    }

    return { gatewayUrl, gatewayToken, controlUiUrl };
  } finally {
    ssh.dispose();
  }
}

export async function waitForHealth(
  vm: VMRecord,
  maxAttempts = 15,
  intervalMs = 2000
): Promise<boolean> {
  // Health check via SSH + localhost avoids self-signed TLS cert issues.
  const ssh = await connectSSH(vm);
  try {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = await ssh.execCommand(
          "curl -sf http://127.0.0.1:8080/health"
        );
        if (result.code === 0) return true;
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  } finally {
    ssh.dispose();
  }
}

export async function updateModel(vm: VMRecord, model: string): Promise<boolean> {
  assertSafeShellArg(model, "model");
  const ssh = await connectSSH(vm);
  try {
    const result = await ssh.execCommand(
      `bash ~/openclaw/scripts/update-model.sh '${model}'`
    );
    return result.code === 0;
  } finally {
    ssh.dispose();
  }
}

export async function restartGateway(vm: VMRecord): Promise<boolean> {
  const ssh = await connectSSH(vm);
  try {
    const result = await ssh.execCommand(
      "docker restart openclaw-gateway 2>/dev/null || docker compose -f ~/openclaw/docker-compose.yml restart"
    );
    return result.code === 0;
  } finally {
    ssh.dispose();
  }
}
