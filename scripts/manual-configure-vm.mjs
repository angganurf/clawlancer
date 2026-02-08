#!/usr/bin/env node
/**
 * Manually trigger VM configuration
 */

const email = process.argv[2] || 'coopergrantwrenn@gmail.com';

async function manualConfigure() {
  console.log('🔧 Manually triggering VM configuration for:', email);
  console.log('');

  // Call the configure endpoint
  const configRes = await fetch('http://localhost:3000/api/vm/configure', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': process.env.ADMIN_API_KEY || 'dev-secret-admin-key-123',
    },
    body: JSON.stringify({ userId: email }),
  });

  if (configRes.ok) {
    const data = await configRes.json();
    console.log('✅ Configuration triggered successfully');
    console.log('   Configured:', data.configured);
    console.log('   Healthy:', data.healthy);
  } else {
    const error = await configRes.json();
    console.log('❌ Configuration failed:',error.error);
    if (error.detail) {
      console.log('   Detail:', error.detail);
    }
  }
}

manualConfigure().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
