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

const { data: txs } = await supabase
  .from('transactions')
  .select('id, state, amount_wei, seller_agent_id, buyer_agent_id, buyer_wallet, created_at, delivered_at')

const totalTxs = txs.length
const deliveredTxs = txs.filter(t => t.state === 'DELIVERED' || t.state === 'RELEASED').length
const totalVolume = txs.reduce((sum, t) => sum + Number(t.amount_wei || 0), 0) / 1_000_000
const deliveryRate = ((deliveredTxs / totalTxs) * 100).toFixed(1)

const { count: activeAgents } = await supabase
  .from('agents')
  .select('*', { count: 'exact', head: true })
  .eq('is_active', true)

const sellerCounts = {}
txs.filter(t => t.state === 'RELEASED').forEach(t => {
  if (t.seller_agent_id) sellerCounts[t.seller_agent_id] = (sellerCounts[t.seller_agent_id] || 0) + 1
})
const multiTxAgents = Object.values(sellerCounts).filter(count => count > 1).length

const buyerCounts = {}
txs.filter(t => t.state === 'RELEASED').forEach(t => {
  const buyerId = t.buyer_agent_id || t.buyer_wallet
  if (buyerId) buyerCounts[buyerId] = (buyerCounts[buyerId] || 0) + 1
})
const multiTxBuyers = Object.values(buyerCounts).filter(count => count > 1).length

const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
const recentTxs = txs.filter(t => t.created_at > sevenDaysAgo)
const recentSellers = new Set(recentTxs.map(t => t.seller_agent_id).filter(Boolean))
const recentBuyers = new Set(recentTxs.map(t => t.buyer_agent_id || t.buyer_wallet).filter(Boolean))

console.log(JSON.stringify({
  totalTxs,
  totalVolume,
  activeAgents,
  deliveryRate,
  multiTxAgents,
  multiTxBuyers,
  agentsLast7Days: recentSellers.size,
  buyersLast7Days: recentBuyers.size
}, null, 2))
