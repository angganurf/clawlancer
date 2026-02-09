#!/bin/bash
#
# open-spots.sh — Open new spots by provisioning Hetzner VMs
#
# Usage:
#   ./scripts/open-spots.sh 3     # Provision 3 new VMs (max 10)
#   ./scripts/open-spots.sh       # Default: provision 2 new VMs
#
# Reads credentials from .env.local automatically.
# No dependency on the web app — talks to Hetzner + Supabase directly.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env.local not found at $ENV_FILE"
  exit 1
fi

# Load env vars (handle quoted values)
load_env() {
  local key="$1"
  grep "^${key}=" "$ENV_FILE" | head -1 | sed 's/^[^=]*=//' | tr -d '"' | tr -d "'" | tr -d '\n'
}

HETZNER_TOKEN=$(load_env "HETZNER_API_TOKEN")
SNAPSHOT_ID=$(load_env "HETZNER_SNAPSHOT_ID")
SUPABASE_URL=$(load_env "NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY=$(load_env "SUPABASE_SERVICE_ROLE_KEY")

if [ -z "$HETZNER_TOKEN" ]; then echo "Error: HETZNER_API_TOKEN not found in .env.local"; exit 1; fi
if [ -z "$SUPABASE_URL" ]; then echo "Error: NEXT_PUBLIC_SUPABASE_URL not found in .env.local"; exit 1; fi
if [ -z "$SUPABASE_KEY" ]; then echo "Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local"; exit 1; fi

COUNT="${1:-2}"
IMAGE="${SNAPSHOT_ID:-ubuntu-24.04}"
SERVER_TYPE="cpx21"
LOCATION="ash"

if [ "$COUNT" -lt 1 ] || [ "$COUNT" -gt 10 ]; then
  echo "Error: Count must be between 1 and 10"
  exit 1
fi

# --- Show current status ---
echo "=== Current spots ==="
curl -s "${SUPABASE_URL}/rest/v1/instaclaw_vms?status=eq.ready&assigned_to=is.null&select=id,name,status" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | python3 -m json.tool 2>/dev/null
echo ""

# --- Get SSH key and firewall IDs ---
echo "Resolving Hetzner resources..."
SSH_KEY_ID=$(curl -s 'https://api.hetzner.cloud/v1/ssh_keys' \
  -H "Authorization: Bearer ${HETZNER_TOKEN}" \
  | python3 -c "import json,sys; keys=json.load(sys.stdin)['ssh_keys']; print(next((k['id'] for k in keys if k['name']=='instaclaw-deploy'), ''))")

FIREWALL_ID=$(curl -s 'https://api.hetzner.cloud/v1/firewalls' \
  -H "Authorization: Bearer ${HETZNER_TOKEN}" \
  | python3 -c "import json,sys; fws=json.load(sys.stdin)['firewalls']; print(next((f['id'] for f in fws if f['name']=='instaclaw-firewall'), ''))")

if [ -z "$SSH_KEY_ID" ]; then echo "Error: SSH key 'instaclaw-deploy' not found on Hetzner"; exit 1; fi
if [ -z "$FIREWALL_ID" ]; then echo "Error: Firewall 'instaclaw-firewall' not found on Hetzner"; exit 1; fi
echo "  SSH Key ID: $SSH_KEY_ID"
echo "  Firewall ID: $FIREWALL_ID"
echo ""

# --- Get next VM number ---
HIGHEST=$(curl -s "${SUPABASE_URL}/rest/v1/instaclaw_vms?select=name&order=created_at.desc&limit=50" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  | python3 -c "
import json,sys,re
vms=json.load(sys.stdin)
nums=[int(m.group(1)) for v in vms if v.get('name') and (m:=re.search(r'instaclaw-vm-(\d+)',v['name']))]
print(max(nums) if nums else 0)
")
NEXT_NUM=$((HIGHEST + 1))

# --- Cloud-init user_data for snapshot VMs ---
if [ -n "$SNAPSHOT_ID" ]; then
  USER_DATA=$(cat <<'CLOUDINIT' | base64
#!/bin/bash
set -euo pipefail
OPENCLAW_USER="openclaw"
CONFIG_DIR="/home/${OPENCLAW_USER}/.openclaw"
rm -f /etc/ssh/ssh_host_* 2>/dev/null || true
dpkg-reconfigure openssh-server 2>/dev/null || ssh-keygen -A
systemd-machine-id-setup
mkdir -p "${CONFIG_DIR}"
chown "${OPENCLAW_USER}:${OPENCLAW_USER}" "${CONFIG_DIR}"
cat > "${CONFIG_DIR}/openclaw.json" <<'EOF'
{"_placeholder":true,"gateway":{"mode":"local","port":18789,"bind":"lan"}}
EOF
chown "${OPENCLAW_USER}:${OPENCLAW_USER}" "${CONFIG_DIR}/openclaw.json"
chmod 600 "${CONFIG_DIR}/openclaw.json"
rm -f /var/lib/fail2ban/fail2ban.sqlite3 2>/dev/null || true
systemctl restart fail2ban 2>/dev/null || true
if systemctl is-active ssh.service &>/dev/null; then systemctl restart ssh; fi
touch /tmp/.instaclaw-personalized
CLOUDINIT
fi

echo "=== Provisioning $COUNT VM(s) from ${SNAPSHOT_ID:+snapshot $SNAPSHOT_ID}${SNAPSHOT_ID:-ubuntu-24.04} ==="
echo ""

SUCCESS=0
for i in $(seq 1 "$COUNT"); do
  VM_NUM=$((NEXT_NUM + i - 1))
  VM_NAME=$(printf "instaclaw-vm-%02d" "$VM_NUM")

  echo "[$i/$COUNT] Creating $VM_NAME..."

  # Build request body
  BODY="{\"name\":\"${VM_NAME}\",\"server_type\":\"${SERVER_TYPE}\",\"image\":\"${IMAGE}\",\"location\":\"${LOCATION}\",\"ssh_keys\":[${SSH_KEY_ID}],\"firewalls\":[{\"firewall\":${FIREWALL_ID}}]"
  if [ -n "${USER_DATA:-}" ]; then
    BODY="${BODY},\"user_data\":\"${USER_DATA}\""
  fi
  BODY="${BODY}}"

  # Create server on Hetzner
  CREATE_RESULT=$(curl -s -X POST 'https://api.hetzner.cloud/v1/servers' \
    -H "Authorization: Bearer ${HETZNER_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$BODY")

  SERVER_ID=$(echo "$CREATE_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('server',{}).get('id',''))" 2>/dev/null)

  if [ -z "$SERVER_ID" ]; then
    echo "  ERROR: Failed to create server"
    echo "$CREATE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESULT"
    continue
  fi

  echo "  Hetzner server ID: $SERVER_ID — waiting for IP..."

  # Poll until running (max 2 minutes)
  IP=""
  for attempt in $(seq 1 24); do
    sleep 5
    SERVER_DATA=$(curl -s "https://api.hetzner.cloud/v1/servers/${SERVER_ID}" \
      -H "Authorization: Bearer ${HETZNER_TOKEN}")
    STATUS=$(echo "$SERVER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['server']['status'])" 2>/dev/null)
    IP=$(echo "$SERVER_DATA" | python3 -c "import json,sys; print(json.load(sys.stdin)['server']['public_net']['ipv4']['ip'])" 2>/dev/null)

    if [ "$STATUS" = "running" ] && [ -n "$IP" ] && [ "$IP" != "0.0.0.0" ]; then
      break
    fi
    printf "."
  done
  echo ""

  if [ -z "$IP" ] || [ "$IP" = "0.0.0.0" ]; then
    echo "  ERROR: Server $SERVER_ID did not get an IP in time"
    continue
  fi

  echo "  IP: $IP"

  # Insert into Supabase as "ready"
  VM_STATUS="ready"
  if [ -z "$SNAPSHOT_ID" ]; then VM_STATUS="provisioning"; fi

  INSERT_RESULT=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/instaclaw_vms" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{\"ip_address\":\"${IP}\",\"name\":\"${VM_NAME}\",\"hetzner_server_id\":\"${SERVER_ID}\",\"ssh_port\":22,\"ssh_user\":\"openclaw\",\"status\":\"${VM_STATUS}\",\"region\":\"us-east\",\"server_type\":\"${SERVER_TYPE}\"}")

  echo "  Inserted into DB: status=$VM_STATUS"
  SUCCESS=$((SUCCESS + 1))
  echo ""
done

echo "=== Done! $SUCCESS/$COUNT VM(s) provisioned ==="
echo ""

# Show updated spots
echo "=== Updated spots ==="
SPOTS=$(curl -s "${SUPABASE_URL}/rest/v1/instaclaw_vms?status=eq.ready&assigned_to=is.null&select=id,name,status" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")
echo "$SPOTS" | python3 -m json.tool 2>/dev/null
SPOT_COUNT=$(echo "$SPOTS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null)
echo ""
echo "Total spots open: $SPOT_COUNT"
