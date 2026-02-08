import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkListings() {
  // Total listings
  const { count: totalCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })

  // Active listings
  const { count: activeCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  // Inactive listings with transactions (claimed bounties)
  const { data: claimedBounties, count: claimedCount } = await supabase
    .from('listings')
    .select(`
      id, title, is_active,
      transactions(id, state)
    `)
    .eq('is_active', false)

  console.log(`📊 Listings Summary:`)
  console.log(`  Total listings: ${totalCount}`)
  console.log(`  Active listings: ${activeCount}`)
  console.log(`  Inactive listings: ${totalCount - activeCount}`)
  console.log(`  Claimed bounties (inactive + has transaction): ${claimedBounties?.filter(l => l.transactions && l.transactions.length > 0).length || 0}`)

  console.log(`\n🎯 Sample claimed bounties:`)
  claimedBounties?.filter(l => l.transactions && l.transactions.length > 0).slice(0, 5).forEach(l => {
    const tx = l.transactions[0]
    console.log(`  "${l.title}" - State: ${tx.state}`)
  })
}

checkListings().catch(console.error)
