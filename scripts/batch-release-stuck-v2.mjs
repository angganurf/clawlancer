/**
 * Batch Release Stuck DELIVERED Transactions (V2)
 *
 * Oracle-funded transactions never create on-chain escrows (state=NONE).
 * Release is DB-only: update state, credit seller, update stats, notify.
 *
 * Run: node scripts/batch-release-stuck-v2.mjs
 */

import { createClient } from '@supabase/supabase-js'

import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('=== Batch Release Stuck DELIVERED Transactions ===\n')

  // 1. Get all stuck transactions with seller info
  const { data: stuck, error } = await supabase
    .from('transactions')
    .select(`
      id, seller_agent_id, buyer_agent_id, amount_wei, escrow_id,
      oracle_funded, contract_version, listing_title, listing_id, delivered_at, currency,
      seller:agents!seller_agent_id(id, name, total_earned_wei),
      buyer:agents!buyer_agent_id(id, name, total_spent_wei)
    `)
    .eq('state', 'DELIVERED')
    .order('delivered_at', { ascending: true })

  if (error) {
    console.error('Query error:', error)
    process.exit(1)
  }

  console.log(`Found ${stuck.length} stuck DELIVERED transactions\n`)

  if (stuck.length === 0) {
    console.log('Nothing to release!')
    return
  }

  // Group by seller for reporting
  const sellers = {}
  for (const tx of stuck) {
    const name = tx.seller?.name || tx.seller_agent_id.slice(0, 8)
    sellers[name] = (sellers[name] || 0) + 1
  }
  for (const [name, count] of Object.entries(sellers)) {
    console.log(`  ${name}: ${count} transactions`)
  }
  console.log()

  const now = new Date().toISOString()
  let released = 0
  let failed = 0
  let totalWei = BigInt(0)

  for (let i = 0; i < stuck.length; i++) {
    const tx = stuck[i]
    const amountWei = BigInt(tx.amount_wei)
    const feeAmount = (amountWei * BigInt(100)) / BigInt(10000) // 1% fee
    const sellerAmount = amountWei - feeAmount
    const price = (Number(amountWei) / 1e6).toFixed(4)

    process.stdout.write(`[${i + 1}/${stuck.length}] ${tx.id.slice(0, 8)} $${price} "${(tx.listing_title || '').slice(0, 35)}" → `)

    try {
      // Update transaction to RELEASED (DB-only — no on-chain escrow exists)
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          state: 'RELEASED',
          completed_at: now,
          release_tx_hash: 'db-only-oracle-funded',
        })
        .eq('id', tx.id)

      if (updateError) throw new Error(`DB update: ${updateError.message}`)

      // Update seller earnings
      if (tx.seller) {
        const oldEarned = BigInt(tx.seller.total_earned_wei || '0')
        await supabase
          .from('agents')
          .update({ total_earned_wei: (oldEarned + sellerAmount).toString() })
          .eq('id', tx.seller.id)
      }

      // Increment transaction counts
      await supabase.rpc('increment_transaction_count', { agent_id: tx.seller_agent_id }).catch(() => {})
      if (tx.buyer_agent_id) {
        await supabase.rpc('increment_transaction_count', { agent_id: tx.buyer_agent_id }).catch(() => {})
      }

      // Record platform fee
      if (feeAmount > BigInt(0)) {
        await supabase.from('platform_fees').insert({
          transaction_id: tx.id,
          fee_type: 'MARKETPLACE',
          amount_wei: feeAmount.toString(),
          currency: tx.currency || 'USDC',
          buyer_agent_id: tx.buyer_agent_id,
          seller_agent_id: tx.seller_agent_id,
          description: `1% batch-release fee on "${tx.listing_title || 'transaction'}"`,
        }).catch(() => {})
      }

      // Debit locked balance for the buyer (house bot)
      if (tx.buyer_agent_id) {
        await supabase.rpc('debit_locked_agent_balance', {
          p_agent_id: tx.buyer_agent_id,
          p_amount_wei: amountWei.toString(),
        }).catch(() => {})
      }

      console.log(`RELEASED (seller +$${(Number(sellerAmount) / 1e6).toFixed(4)})`)
      released++
      totalWei += amountWei
    } catch (err) {
      console.log(`FAIL: ${err.message?.slice(0, 80)}`)
      failed++
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`Released: ${released}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total value: $${(Number(totalWei) / 1e6).toFixed(4)} USDC`)

  // Check remaining stuck
  const { data: remaining } = await supabase
    .from('transactions')
    .select('id')
    .eq('state', 'DELIVERED')
  console.log(`Remaining DELIVERED: ${remaining?.length || 0}`)

  // Show updated seller balances
  console.log('\n=== Updated Seller Earnings ===')
  const sellerIds = [...new Set(stuck.map(t => t.seller_agent_id))]
  for (const sid of sellerIds) {
    const { data: agent } = await supabase
      .from('agents')
      .select('name, total_earned_wei, transaction_count')
      .eq('id', sid)
      .single()
    if (agent) {
      console.log(`  ${agent.name}: $${(Number(agent.total_earned_wei) / 1e6).toFixed(4)} earned, ${agent.transaction_count} transactions`)
    }
  }
}

main().catch(console.error)
