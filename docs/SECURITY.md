# InstaClaw Security Model

This document describes the security measures implemented across the InstaClaw platform. Every user gets a dedicated VM running their own OpenClaw instance — this architecture isolates tenants by default, but each VM still needs hardening to prevent unauthorized access.

---

## Architecture Overview

```
User (browser) ──HTTPS──> InstaClaw.io (Next.js on Vercel)
                                │
                                ├── Supabase (data, RLS-protected)
                                ├── Stripe (billing, webhook-verified)
                                └── SSH ──> Hetzner VM (per-user)
                                              │
                                              ├── Caddy (TLS termination, reverse proxy)
                                              │     ├── /api/gateway/* → 127.0.0.1:8080 (token-gated)
                                              │     ├── /health        → 127.0.0.1:8080 (open)
                                              │     └── /*             → 127.0.0.1:3000 (control UI)
                                              │
                                              ├── OpenClaw Gateway (127.0.0.1:8080)
                                              └── OpenClaw Control UI (127.0.0.1:3000)
```

All external traffic enters through Caddy over HTTPS. The OpenClaw services bind to `127.0.0.1` only and are never directly reachable from the internet.

---

## VM Security (scripts/install-openclaw.sh)

### SSH Hardening

The install script writes a drop-in config at `/etc/ssh/sshd_config.d/99-instaclaw-hardened.conf`:

| Setting | Value | Why |
|---------|-------|-----|
| `PasswordAuthentication` | `no` | Only SSH keys accepted |
| `PermitRootLogin` | `no` | Root cannot SSH in at all |
| `PubkeyAuthentication` | `yes` | Key-based auth required |
| `AuthenticationMethods` | `publickey` | No other methods allowed |
| `MaxAuthTries` | `3` | Limits brute-force per connection |
| `AllowUsers` | `openclaw` | Only the service user can log in |
| `X11Forwarding` | `no` | No GUI forwarding (headless) |
| `AllowAgentForwarding` | `no` | Prevents agent hijacking |
| `ClientAliveInterval` | `300` | Drops idle connections after 10 min |

The config is validated with `sshd -t` before applying. If validation fails, the hardened config is removed and the script exits — this prevents lockouts.

### fail2ban

Installed and configured with a local jail:

- **Trigger:** 5 failed SSH login attempts within 10 minutes
- **Action:** IP banned via UFW for 10 minutes
- **Log source:** `/var/log/auth.log`
- **Ban action:** `ufw` (integrates directly with the firewall)

This stops automated brute-force attacks against SSH even though password auth is disabled (defense in depth).

### Firewall (UFW)

| Port | Protocol | Direction | Rule |
|------|----------|-----------|------|
| 22 | TCP | Inbound | Allow (SSH) |
| 80 | TCP | Inbound | Allow (HTTP redirect to HTTPS) |
| 443 | TCP | Inbound | Allow (HTTPS via Caddy) |
| 3000 | TCP | Inbound | **Deny** (localhost only) |
| 8080 | TCP | Inbound | **Deny** (localhost only) |
| * | * | Outbound | Allow |

Default inbound policy is `deny`. Only SSH and Caddy's HTTP/HTTPS ports are open to the internet.

---

## HTTPS / TLS (Caddy)

Caddy serves as the sole entry point for HTTP traffic:

- **Automatic TLS:** When a `--domain` is provided to `install-openclaw.sh`, Caddy provisions a Let's Encrypt certificate automatically. No manual cert management.
- **HTTP redirect:** Port 80 redirects all traffic to HTTPS permanently.
- **Security headers:** Every response includes:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - The `Server` header is stripped.

### Gateway Auth at Proxy Level

Caddy validates the `X-Gateway-Token` header on all `/api/gateway/*` requests before proxying to the backend. Requests without the header receive a `401` response from Caddy itself — the gateway container never sees them.

The `/health` endpoint is exempted from auth so the InstaClaw cron job can monitor VMs.

---

## Credential Encryption

API keys and tokens are never stored in plaintext on VM disks.

### On-VM Encryption (scripts/configure-vm.sh)

Each VM has a per-VM encryption key generated at provisioning time:

```
~/.openclaw/.vault_key    (0400, openclaw user only)
```

Credentials are encrypted using **AES-256-CBC with PBKDF2 key derivation** (100,000 iterations):

```
~/.openclaw/creds/telegram_token.enc
~/.openclaw/creds/api_key.enc
~/.openclaw/creds/gateway_token.enc
```

The `openclaw.json` config references these encrypted files. At container startup, `configure-vm.sh` decrypts them into environment variables that exist only in the container's process memory. The plaintext values are `unset` from the shell immediately after the container starts.

### In-Database Encryption (instaclaw/lib/security.ts)

For BYOK users, Anthropic API keys stored in Supabase are encrypted with **AES-256-GCM** before insertion:

- Key derivation: PBKDF2 with 100,000 iterations and a random 16-byte salt
- Each encryption uses a unique random IV (96-bit)
- Storage format: `base64(salt + iv + ciphertext)`
- Encryption key: `CREDENTIAL_ENCRYPTION_KEY` env var (server-side only, never exposed to client)

The key is decrypted only when pushing configuration to a VM over SSH.

---

## Authentication & Authorization

### User Auth (NextAuth)

- Google OAuth 2.0 via NextAuth v5
- JWT-based sessions (no server-side session store)
- Invite code required before OAuth (controlled rollout)
- Invite codes use a confusion-free alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no `0/O`, `1/I`)

### Admin Auth

Admin routes check the user's email against the `ADMIN_EMAILS` environment variable. Admin API routes use `isAdmin()` from `lib/admin.ts`.

### Token Validation

All token comparisons use constant-time comparison (`timingSafeEqual` in `lib/security.ts`) to prevent timing side-channel attacks:

```typescript
// XOR every byte — if any differ, result will be non-zero
for (let i = 0; i < maxLen; i++) {
  result |= aPadded[i] ^ bPadded[i];
}
result |= aBuf.length ^ bBuf.length;
```

### Stripe Webhooks

Stripe webhook signatures are verified using `stripe.webhooks.constructEvent()` with the `STRIPE_WEBHOOK_SECRET`. Invalid signatures result in a `400` response before any processing.

### Cron Jobs

Cron endpoints require `Authorization: Bearer <CRON_SECRET>` header. On Vercel, this is set via environment variables and the cron scheduler includes it automatically.

---

## Prompt Injection Risk

Because each user gets a full OpenClaw instance with shell access and browser automation, the platform has inherent exposure to prompt injection attacks. This is a known and accepted risk that comes with the product's value proposition.

### What Prompt Injection Means Here

OpenClaw instances process user messages (via Telegram) and can execute arbitrary actions — running shell commands, browsing the web, reading/writing files. A malicious actor could craft Telegram messages designed to manipulate the AI into:

1. **Exfiltrating secrets:** Convincing the AI to read `~/.openclaw/openclaw.json` or environment variables and send them somewhere
2. **Modifying its own configuration:** Asking the AI to edit its config file to change behavior
3. **Abusing the API key:** Triggering excessive API usage to run up costs (all-inclusive) or abuse the user's key (BYOK)
4. **Network attacks:** Using the VM as a proxy for malicious traffic

### Mitigations

| Risk | Mitigation |
|------|------------|
| Secret exfiltration via config files | Config references encrypted files; plaintext only in container memory |
| Direct API key theft | Keys encrypted at rest with AES-256; vault key is 0400 permissions |
| Network abuse | UFW restricts outbound to necessary ports; monitoring via health cron |
| Cross-tenant access | Full VM isolation — each user has their own VM, no shared resources |
| Excessive API usage | Stripe billing with subscription limits; tier-based resource allocation |
| Config tampering | Config dir mounted read-only (`:ro`) in Docker container |

### What We Don't Mitigate (By Design)

Users have full control over their OpenClaw instance. They can:

- Send any message to their bot and it will process it
- The AI may execute shell commands if asked (this is a feature)
- The AI has access to the file system inside the container

This is intentional — InstaClaw provides **hosting**, not **sandboxing**. The security boundary is between users (VM isolation), not between a user and their own instance. This is the same trust model as any VPS provider.

---

## Environment Variables

All secrets are stored as environment variables in Vercel (server-side only):

| Variable | Purpose | Never Exposed To |
|----------|---------|-----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Full DB access | Client |
| `STRIPE_SECRET_KEY` | Stripe API | Client |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | Client |
| `GOOGLE_CLIENT_SECRET` | OAuth | Client |
| `NEXTAUTH_SECRET` | JWT signing | Client |
| `SSH_PRIVATE_KEY` | VM access | Client, logs |
| `ANTHROPIC_API_KEY` | All-inclusive users | Client |
| `CREDENTIAL_ENCRYPTION_KEY` | DB-level API key encryption | Client |
| `RESEND_API_KEY` | Transactional email | Client |
| `CRON_SECRET` | Cron auth | Client |
| `ADMIN_API_KEY` | Internal service calls | Client |

No secrets have the `NEXT_PUBLIC_` prefix. The only public env vars are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

---

## Database Security (Supabase)

- **Row Level Security (RLS)** enabled on all tables
- Users can only read their own data (`assigned_to = auth.uid()`, `user_id = auth.uid()`)
- Service role key used only on the server — never exposed to the client
- VM assignment uses `FOR UPDATE SKIP LOCKED` for atomic, race-condition-free allocation
- Waitlist IP addresses are SHA-256 hashed with a salt before storage

---

## Summary

| Layer | Protection |
|-------|-----------|
| Network | UFW firewall, only 22/80/443 open |
| Transport | Caddy auto-TLS, HSTS, HTTP→HTTPS redirect |
| SSH | Key-only, no root, fail2ban, max 3 attempts |
| Proxy | Token validation at Caddy level before backend |
| Credentials (VM) | AES-256-CBC encrypted at rest, decrypted to memory only |
| Credentials (DB) | AES-256-GCM encrypted before storage in Supabase |
| Auth | Google OAuth + invite codes, JWT sessions |
| Tokens | Constant-time comparison, crypto.getRandomValues() |
| Isolation | One VM per user, no shared resources |
| Monitoring | 5-minute health check cron, fail2ban logging |
