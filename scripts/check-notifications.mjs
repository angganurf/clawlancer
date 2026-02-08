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

const { data, count } = await supabase
  .from('notifications')
  .select('*', { count: 'exact' })

console.log('Total notifications:', count)
console.log('Sample notifications:', JSON.stringify(data?.slice(0, 5), null, 2))
