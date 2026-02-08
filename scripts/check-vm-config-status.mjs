#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const email = process.argv[2] || 'coopergrantwrenn@gmail.com';

// Find the user
const { data: user } = await supabase
  .from('instaclaw_users')
  .select('id, email')
  .eq('email', email)
  .single();

if (!user) {
  console.log('❌ User not found');
  process.exit(0);
}

// Get their VM
const { data: vm } = await supabase
  .from('instaclaw_vms')
  .select('*')
  .eq('assigned_to', user.id)
  .single();

if (!vm) {
  console.log('❌ No VM assigned');
  process.exit(0);
}

console.log('🖥️  VM Status for', user.email);
console.log('');
console.log('IP:', vm.ip_address);
console.log('Status:', vm.status);
console.log('Health:', vm.health_status);
console.log('Configure attempts:', vm.configure_attempts ?? 0);
console.log('Gateway URL:', vm.gateway_url ?? 'not set');
console.log('Control UI URL:', vm.control_ui_url ?? 'not set');
console.log('Last health check:', vm.last_health_check ?? 'never');
console.log('');
console.log('Telegram bot username:', vm.telegram_bot_username ?? 'not set');
console.log('Channels enabled:', vm.channels_enabled ?? []);
console.log('API mode:', vm.api_mode ?? 'not set');
console.log('Model:', vm.default_model ?? 'not set');
console.log('');

if (vm.health_status === 'configure_failed') {
  console.log('⚠️  Configuration has failed!');
  console.log('');
  console.log('💡 To retry configuration:');
  console.log(`   1. Check VM is accessible: curl http://${vm.ip_address}:18789/health`);
  console.log(`   2. Trigger manual configure: node scripts/manual-configure.mjs ${user.email}`);
}

if (vm.gateway_url) {
  console.log('✅ Configuration appears successful!');
  console.log('Gateway:', vm.gateway_url);
}
