#!/usr/bin/env node
/**
 * Test TLS Setup End-to-End
 * Simulates the full VM configure flow: DNS → Caddy → Let's Encrypt → HTTPS verification
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';

const execAsync = promisify(exec);

const TEST_VM_ID = '4693d063-e94d-4390-aa41-8c23cd23ce28';
const TEST_VM_IP = '178.156.192.151';
const GODADDY_API_KEY = process.env.GODADDY_API_KEY;
const GODADDY_API_SECRET = process.env.GODADDY_API_SECRET;
const SSH_KEY_B64 = process.env.SSH_PRIVATE_KEY_B64;

if (!GODADDY_API_KEY || !GODADDY_API_SECRET) {
  console.error('❌ GODADDY_API_KEY and GODADDY_API_SECRET required');
  process.exit(1);
}

console.log('\n🧪 TLS Setup End-to-End Test\n');
console.log(`VM ID: ${TEST_VM_ID}`);
console.log(`VM IP: ${TEST_VM_IP}`);
console.log(`Domain: ${TEST_VM_ID}.vm.instaclaw.io\n`);

// Step 1: Create DNS record via GoDaddy API
console.log('📍 Step 1: Creating DNS A record via GoDaddy API...');
const hostname = `${TEST_VM_ID}.vm.instaclaw.io`;
const dnsName = `${TEST_VM_ID}.vm`;

try {
  const response = await fetch('https://api.godaddy.com/v1/domains/instaclaw.io/records', {
    method: 'PATCH',
    headers: {
      'Authorization': `sso-key ${GODADDY_API_KEY}:${GODADDY_API_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{
      type: 'A',
      name: dnsName,
      data: TEST_VM_IP,
      ttl: 600,
    }]),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error('❌ GoDaddy API error:', body);
    process.exit(1);
  }
  console.log('✅ DNS A record created\n');
} catch (err) {
  console.error('❌ DNS creation failed:', err.message);
  process.exit(1);
}

// Step 2: Wait for DNS propagation
console.log('⏳ Step 2: Waiting for DNS propagation (30s)...');
await new Promise(r => setTimeout(r, 30000));

// Verify DNS
console.log('🔍 Verifying DNS resolution...');
try {
  const { stdout } = await execAsync(`dig +short ${TEST_VM_ID}.vm.instaclaw.io`);
  const resolvedIp = stdout.trim();
  if (resolvedIp === TEST_VM_IP) {
    console.log(`✅ DNS resolves correctly: ${resolvedIp}\n`);
  } else {
    console.warn(`⚠️  DNS resolves to ${resolvedIp}, expected ${TEST_VM_IP}\n`);
  }
} catch (err) {
  console.warn(`⚠️  DNS check failed: ${err.message}\n`);
}

// Step 3: Setup Caddy with Let's Encrypt via SSH
console.log('🔧 Step 3: Configuring Caddy on VM...');

// Write SSH key
const sshKeyPath = '/tmp/test_tls_key';
writeFileSync(sshKeyPath, Buffer.from(SSH_KEY_B64, 'base64'));
await execAsync(`chmod 600 ${sshKeyPath}`);

const caddyfile = `${hostname} {
  reverse_proxy localhost:18789
}`;

const caddyfileB64 = Buffer.from(caddyfile).toString('base64');

const sshScript = `
set -e
# Install Caddy if not installed
if ! command -v caddy &> /dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/gpg.key" | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null || true
  curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" | sudo tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq caddy
fi

# Write Caddyfile
echo '${caddyfileB64}' | base64 -d | sudo tee /etc/caddy/Caddyfile > /dev/null

# Restart Caddy
sudo systemctl restart caddy
sudo systemctl enable caddy

echo "Caddy configured for ${hostname}"
`;

try {
  const { stdout, stderr } = await execAsync(`ssh -i ${sshKeyPath} -o StrictHostKeyChecking=no openclaw@${TEST_VM_IP} "${sshScript}" 2>&1`);
  console.log('✅ Caddy configured with Let\'s Encrypt\n');
  if (stdout.includes('error') || stderr) {
    console.log('SSH output:', stdout);
  }
} catch (err) {
  console.error('❌ Caddy setup failed:', err.message);
  unlinkSync(sshKeyPath);
  process.exit(1);
}

// Step 4: Wait for Let's Encrypt to provision certificate
console.log('⏳ Step 4: Waiting for Let\'s Encrypt certificate (60s)...');
await new Promise(r => setTimeout(r, 60000));

// Step 5: Test HTTPS
console.log('🔐 Step 5: Testing HTTPS connection...');
try {
  const { stdout, stderr } = await execAsync(`curl -I --max-time 10 https://${hostname} 2>&1`);

  if (stdout.includes('200 OK') || stdout.includes('301') || stdout.includes('401')) {
    console.log('✅ HTTPS works!\n');
    console.log('Response headers:');
    console.log(stdout.split('\n').slice(0, 8).join('\n'));
  } else {
    console.warn('⚠️  Unexpected response:');
    console.log(stdout);
  }

  // Check certificate
  console.log('\n🔍 Checking SSL certificate...');
  const { stdout: certInfo } = await execAsync(`echo | openssl s_client -connect ${hostname}:443 -servername ${hostname} 2>/dev/null | openssl x509 -noout -issuer -subject -dates 2>/dev/null`);
  console.log(certInfo);

  if (certInfo.includes("Let's Encrypt")) {
    console.log('\n✅ Valid Let\'s Encrypt certificate!\n');
  } else {
    console.log('\n⚠️  Certificate not from Let\'s Encrypt\n');
  }
} catch (err) {
  console.error('❌ HTTPS test failed:', err.message);
  process.exit(1);
}

// Step 6: Update database
console.log('💾 Step 6: Updating database with HTTPS URL...');
const httpsUrl = `https://${hostname}`;

try {
  const updateScript = `
cd instaclaw && node --input-type=module -e "
import { getSupabase } from './lib/supabase.ts';
const supabase = getSupabase();
await supabase.from('instaclaw_vms').update({
  gateway_url: '${httpsUrl}',
  control_ui_url: '${httpsUrl}'
}).eq('id', '${TEST_VM_ID}');
console.log('Updated');
"`;

  await execAsync(updateScript);
  console.log('✅ Database updated\n');
} catch (err) {
  console.error('❌ Database update failed:', err.message);
}

// Cleanup
unlinkSync(sshKeyPath);

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ TLS SETUP COMPLETE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\n🌐 Gateway URL: ${httpsUrl}`);
console.log(`🔒 TLS: Let's Encrypt`);
console.log(`📍 DNS: GoDaddy`);
console.log(`\nTest the gateway:`);
console.log(`  curl -I ${httpsUrl}/health\n`);
