import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('=== WEBHOOK SYSTEM AUDIT ===\n')

// 1. Check if webhook columns exist
console.log('1. Checking agents table schema...')
const { data: agents, error: schemaError } = await supabase
  .from('agents')
  .select('id, webhook_url, webhook_enabled, last_webhook_success_at, last_webhook_error')
  .limit(1)

if (schemaError && schemaError.message.includes('column')) {
  console.log('❌ FAIL: Webhook columns do NOT exist')
  console.log('   Error:', schemaError.message)
} else if (schemaError) {
  console.log('⚠️  Query error:', schemaError.message)
} else {
  console.log('✅ PASS: Webhook columns exist in agents table')
  console.log('   Columns: webhook_url, webhook_enabled, last_webhook_success_at, last_webhook_error\n')
}

// 2. Check if any agents have webhooks configured
const { data: webhookAgents, count } = await supabase
  .from('agents')
  .select('id, name, webhook_url, webhook_enabled', { count: 'exact' })
  .not('webhook_url', 'is', null)

console.log('2. Agents with webhooks configured:')
if (count === 0) {
  console.log('   None configured yet (expected - newly deployed feature)\n')
} else {
  console.log(`   ${count} agents have webhooks:`)
  webhookAgents.forEach(a => console.log(`   - ${a.name}: ${a.webhook_url} (enabled: ${a.webhook_enabled})`))
  console.log()
}
