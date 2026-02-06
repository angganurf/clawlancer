/**
 * Backfill Gas Promo
 *
 * One-time script to send free gas to agents who registered
 * but never received their promo gas (registered via CLI/API
 * before the fix that moved funding into /api/agents/register).
 *
 * Run with: npx tsx scripts/backfill-gas-promo.ts
 */

import { createClient } from '@supabase/supabase-js'
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem'
import { base } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FUND_AMOUNT = '0.00004' // ETH per agent (~$0.10)
const DELAY_BETWEEN_MS = 5000 // 5s between sends to avoid rate issues

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('=== Gas Promo Backfill ===\n')

  // Check prerequisites
  if (process.env.GAS_PROMO_ENABLED !== 'true') {
    console.error('GAS_PROMO_ENABLED is not true. Aborting.')
    process.exit(1)
  }

  const rawKey = process.env.GAS_FAUCET_PRIVATE_KEY
  if (!rawKey) {
    console.error('GAS_FAUCET_PRIVATE_KEY not set. Aborting.')
    process.exit(1)
  }

  const privateKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`
  const account = privateKeyToAccount(privateKey as `0x${string}`)

  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.ALCHEMY_BASE_URL),
  })

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.ALCHEMY_BASE_URL),
  })

  // Check faucet balance
  const balance = await publicClient.getBalance({ address: account.address })
  const balanceEth = parseFloat(formatEther(balance))
  console.log(`Faucet wallet: ${account.address}`)
  console.log(`Faucet balance: ${balanceEth} ETH\n`)

  // Find unfunded agents (skip E2E test bots by filtering created_at > Feb 4)
  const { data: unfundedAgents, error } = await supabase
    .from('agents')
    .select('id, name, wallet_address, created_at')
    .eq('gas_promo_funded', false)
    .gte('created_at', '2026-02-04T18:00:00Z')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to query agents:', error)
    process.exit(1)
  }

  if (!unfundedAgents || unfundedAgents.length === 0) {
    console.log('No unfunded agents found. Nothing to backfill.')
    process.exit(0)
  }

  console.log(`Found ${unfundedAgents.length} unfunded agents:\n`)
  for (const agent of unfundedAgents) {
    console.log(`  - ${agent.name} (${agent.id}) wallet: ${agent.wallet_address}`)
  }

  // Check we have enough balance
  const totalNeeded = unfundedAgents.length * parseFloat(FUND_AMOUNT)
  if (balanceEth < totalNeeded + 0.001) {
    console.error(`\nInsufficient balance. Need ~${totalNeeded} ETH + gas, have ${balanceEth} ETH.`)
    process.exit(1)
  }

  console.log(`\nSending ${FUND_AMOUNT} ETH to each (${unfundedAgents.length} agents)...\n`)

  let funded = 0
  let skipped = 0
  let failed = 0

  for (const agent of unfundedAgents) {
    // Check if wallet was already funded (different agent, same wallet)
    const { data: existingLog } = await supabase
      .from('gas_promo_log')
      .select('id')
      .eq('wallet_address', agent.wallet_address.toLowerCase())
      .eq('status', 'SUCCESS')
      .limit(1)

    if (existingLog && existingLog.length > 0) {
      console.log(`SKIP ${agent.name}: wallet already funded`)
      // Still mark agent as funded since the wallet got gas
      await supabase
        .from('agents')
        .update({ gas_promo_funded: true, gas_promo_funded_at: new Date().toISOString() })
        .eq('id', agent.id)
      skipped++
      continue
    }

    try {
      // Insert pending log
      const { data: logRow } = await supabase
        .from('gas_promo_log')
        .insert({
          agent_id: agent.id,
          wallet_address: agent.wallet_address.toLowerCase(),
          amount_eth: parseFloat(FUND_AMOUNT),
          status: 'PENDING',
        })
        .select('id')
        .single()

      // Send transaction
      const hash = await walletClient.sendTransaction({
        to: agent.wallet_address as `0x${string}`,
        value: parseEther(FUND_AMOUNT),
      })

      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        // Update log
        if (logRow) {
          await supabase
            .from('gas_promo_log')
            .update({ status: 'SUCCESS', tx_hash: hash })
            .eq('id', logRow.id)
        }

        // Mark agent funded
        await supabase
          .from('agents')
          .update({
            gas_promo_funded: true,
            gas_promo_funded_at: new Date().toISOString(),
            gas_promo_tx_hash: hash,
          })
          .eq('id', agent.id)

        // Increment counter
        await supabase.rpc('increment_platform_setting', { setting_key: 'gas_promo_count' })

        console.log(`OK   ${agent.name}: ${hash}`)
        funded++
      } else {
        if (logRow) {
          await supabase
            .from('gas_promo_log')
            .update({ status: 'FAILED', tx_hash: hash, error_message: 'transaction_reverted' })
            .eq('id', logRow.id)
        }
        console.log(`FAIL ${agent.name}: transaction reverted`)
        failed++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      console.log(`FAIL ${agent.name}: ${msg}`)
      failed++
    }

    // Delay between sends
    if (unfundedAgents.indexOf(agent) < unfundedAgents.length - 1) {
      await sleep(DELAY_BETWEEN_MS)
    }
  }

  console.log(`\n=== Results ===`)
  console.log(`Funded: ${funded}`)
  console.log(`Skipped (wallet already funded): ${skipped}`)
  console.log(`Failed: ${failed}`)

  // Show updated counter
  const { data: setting } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'gas_promo_count')
    .single()

  console.log(`\nNew gas_promo_count: ${setting?.value} (${100 - parseInt(setting?.value || '0')} slots remaining)`)
}

main().catch(err => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
