# TLS/HTTPS Setup for InstaClaw VMs

## Overview
InstaClaw VMs use **Caddy** as a reverse proxy with automatic Let's Encrypt certificates. Each VM gets a subdomain like `<vm-id>.vm.instaclaw.io` that proxies to the OpenClaw gateway on port 18789.

## Prerequisites

### 1. Cloudflare Account
- Domain: `instaclaw.io` managed in Cloudflare
- Zone ID for instaclaw.io
- API token with DNS edit permissions

### 2. DNS Wildcard Record
Create a wildcard DNS record in Cloudflare DNS:
```
Type: A
Name: *.vm.instaclaw.io
Content: (can be any IP, individual records will be created)
TTL: Auto
Proxy: OFF (must be DNS only, not proxied)
```

### 3. Required Environment Variables

Add these to your Vercel/production environment:

```bash
# Cloudflare API credentials
CLOUDFLARE_ZONE_ID="your_zone_id_here"
CLOUDFLARE_API_TOKEN="your_api_token_here"
```

#### Finding Your Zone ID:
1. Go to Cloudflare Dashboard
2. Select your domain (instaclaw.io)
3. Zone ID is on the right sidebar under "API"

#### Creating an API Token:
1. Cloudflare Dashboard → My Profile → API Tokens
2. Click "Create Token"
3. Use template: "Edit zone DNS"
4. Zone Resources: Include → Specific zone → instaclaw.io
5. Copy the token (you'll only see it once!)

## How It Works

### Automatic TLS Flow (lib/ssh.ts:239-267)

When a VM is configured:

1. **DNS Record Creation** (`lib/hetzner.ts:209-247`)
   - Creates A record: `<vm-id>.vm.instaclaw.io` → `<vm-ip>`
   - TTL: 300 seconds
   - Proxied: false (DNS only)

2. **Caddy Installation** (`lib/ssh.ts:648-691`)
   - Installs Caddy if not present
   - Creates Caddyfile: `<vm-id>.vm.instaclaw.io { reverse_proxy localhost:18789 }`
   - Caddy automatically provisions Let's Encrypt cert via HTTP-01 challenge
   - Restarts Caddy with new config

3. **Database Update**
   - Gateway URL updated: `http://IP:18789` → `https://<vm-id>.vm.instaclaw.io`
   - Control UI URL updated similarly

### Fallback Behavior

If `CLOUDFLARE_ZONE_ID` or `CLOUDFLARE_API_TOKEN` are not set:
- **VMs use HTTP** (current production state)
- TLS setup is skipped (non-blocking)
- Gateway URLs remain: `http://<ip>:18789`

## Testing TLS Setup

After setting env vars and redeploying:

1. **Deploy a new VM** via onboarding flow
2. **Check DNS**: `dig <vm-id>.vm.instaclaw.io` should resolve to VM IP
3. **Check HTTPS**: `curl https://<vm-id>.vm.instaclaw.io/health`
4. **Verify cert**: Browser should show valid Let's Encrypt certificate

## Troubleshooting

### DNS Not Resolving
- Check CLOUDFLARE_ZONE_ID matches your domain's zone
- Verify API token has DNS edit permissions
- Check Cloudflare API logs in application logs

### Certificate Not Provisioning
- Ensure port 80 is open on VM (required for HTTP-01 challenge)
- Check Caddy logs: SSH to VM, run `sudo journalctl -u caddy -f`
- Verify DNS record is not proxied (must be DNS only)

### Mixed HTTP/HTTPS Content
- Old VMs will still use HTTP until reconfigured
- Run migration script to update existing VMs (create if needed)

## Security Benefits

Once TLS is enabled:
- ✅ Bot tokens encrypted in transit
- ✅ API keys protected from network sniffers
- ✅ User credentials secured
- ✅ Meets browser security requirements
- ✅ Can be embedded in HTTPS sites

## Production Deployment Checklist

- [ ] Set `CLOUDFLARE_ZONE_ID` in Vercel production environment
- [ ] Set `CLOUDFLARE_API_TOKEN` in Vercel production environment
- [ ] Create wildcard DNS record `*.vm.instaclaw.io`
- [ ] Deploy updated code to production
- [ ] Test with new VM signup
- [ ] Verify HTTPS works
- [ ] (Optional) Migrate existing VMs to HTTPS
