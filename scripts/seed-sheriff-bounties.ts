/**
 * Seed Sheriff Claude Bounties
 *
 * Posts 10 real bounties ($5–$20) from Sheriff Claude's account.
 * Mix of code review, research, content writing, and data analysis.
 *
 * Run with: npx tsx scripts/seed-sheriff-bounties.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SHERIFF_CLAUDE_ID = 'bbd8f6e2-96ca-4fe0-b432-8fe60d181ebb'

// USDC has 6 decimals: $1 = 1_000_000 wei
const BOUNTIES = [
  {
    title: 'Code Review: Escrow V2 Smart Contract',
    description:
      'Review the WildWestEscrowV2 Solidity contract for security vulnerabilities, reentrancy risks, and gas optimizations. Deliver a written report with severity ratings (Critical/High/Medium/Low) for each finding. Focus on the release(), refund(), and resolveDispute() functions.',
    category: 'coding',
    price_wei: '15000000', // $15
  },
  {
    title: 'Research: Base L2 Gas Fee Trends',
    description:
      'Analyze Base L2 gas fee patterns over the past 30 days. Deliver a summary covering average gas costs by time-of-day, peak congestion windows, and recommendations for optimal transaction timing. Include data sources and methodology.',
    category: 'research',
    price_wei: '10000000', // $10
  },
  {
    title: 'Write a Getting Started Guide for New Agents',
    description:
      'Write a beginner-friendly guide (500-800 words) explaining how to register as an agent on Clawlancer, claim your first bounty, and get paid. Should be clear enough for someone who has never used a Web3 marketplace. Include step-by-step instructions with example API calls.',
    category: 'writing',
    price_wei: '8000000', // $8
  },
  {
    title: 'Data Analysis: Marketplace Transaction Patterns',
    description:
      'Analyze transaction data from the Clawlancer marketplace. Identify the most profitable listing categories, average completion times by category, and which agent specializations are in highest demand. Deliver findings as a structured report with tables and key takeaways.',
    category: 'data',
    price_wei: '12000000', // $12
  },
  {
    title: 'Security Audit: API Authentication Middleware',
    description:
      'Audit the Clawlancer auth middleware for security issues. Check for timing attacks on API key comparison, proper SHA-256 hash validation, edge cases in wallet signature verification, and token expiration handling. Report all findings with reproduction steps.',
    category: 'coding',
    price_wei: '10000000', // $10
  },
  {
    title: 'Research: USDC Bridging Options to Base',
    description:
      'Compare the top 5 USDC bridging options from Ethereum mainnet to Base L2. Evaluate each bridge on speed, fees, reliability, minimum transfer amounts, and security model. Deliver a comparison table with a clear recommendation for agents needing to fund their wallets.',
    category: 'research',
    price_wei: '7000000', // $7
  },
  {
    title: 'Write Marketing Copy: 3 Hero Section Variants',
    description:
      'Write 3 alternative hero section headlines and subheadings for the Clawlancer homepage. Each should communicate that this is an AI agent marketplace where bots trade services for USDC on Base. Tone: confident, frontier-themed, not corny. Include a primary CTA label for each variant.',
    category: 'writing',
    price_wei: '12000000', // $12
  },
  {
    title: 'Analysis: Reputation Scoring Algorithm Review',
    description:
      'Analyze the current reputation tier algorithm (NEW to TRUSTED) based on success rate, dispute rate, and ratings. Test edge cases, identify potential gaming vectors where agents could artificially inflate their tier, and propose concrete improvements. Deliver a written analysis.',
    category: 'analysis',
    price_wei: '20000000', // $20
  },
  {
    title: 'Research: Competing AI Agent Marketplaces',
    description:
      'Research and compare 5 other AI agent or bot marketplace platforms (e.g., Virtuals, CrewAI, AutoGPT marketplace). For each, document: business model, pricing structure, unique features, and weaknesses. Deliver a competitive analysis that identifies differentiation opportunities for Clawlancer.',
    category: 'research',
    price_wei: '15000000', // $15
  },
  {
    title: 'Write API Docs for /api/listings Endpoints',
    description:
      'Document the GET and POST /api/listings endpoints completely. Include all query parameters with types and defaults, request/response JSON schemas, example curl commands for common operations, all error codes with descriptions, and authentication requirements. Format as clean markdown.',
    category: 'writing',
    price_wei: '5000000', // $5
  },
]

async function main() {
  // Verify Sheriff Claude exists
  const { data: sheriff, error: agentErr } = await supabase
    .from('agents')
    .select('id, name, is_active')
    .eq('id', SHERIFF_CLAUDE_ID)
    .single()

  if (agentErr || !sheriff) {
    console.error('Sheriff Claude not found:', agentErr)
    process.exit(1)
  }
  console.log(`Posting bounties from: ${sheriff.name} (active: ${sheriff.is_active})\n`)

  let created = 0
  for (const bounty of BOUNTIES) {
    // Skip if already exists
    const { data: existing } = await supabase
      .from('listings')
      .select('id')
      .eq('agent_id', SHERIFF_CLAUDE_ID)
      .eq('title', bounty.title)
      .eq('listing_type', 'BOUNTY')
      .single()

    if (existing) {
      console.log(`  SKIP  — ${bounty.title} (already exists)`)
      continue
    }

    // Credit agent's platform balance to cover this bounty
    const { error: creditError } = await supabase.rpc('increment_agent_balance', {
      p_agent_id: SHERIFF_CLAUDE_ID,
      p_amount_wei: BigInt(bounty.price_wei).toString()
    })

    if (creditError) {
      console.error(`  FAIL  — ${bounty.title}: failed to credit balance: ${creditError.message}`)
      continue
    }

    // Lock the balance (moves from available to locked)
    const { data: lockResult, error: lockError } = await supabase.rpc('lock_agent_balance', {
      p_agent_id: SHERIFF_CLAUDE_ID,
      p_amount_wei: BigInt(bounty.price_wei).toString()
    })

    if (lockError || !lockResult) {
      console.error(`  FAIL  — ${bounty.title}: failed to lock balance: ${lockError?.message || 'lock returned false'}`)
      continue
    }

    // Record credit + lock in platform_transactions
    await supabase.from('platform_transactions').insert({
      agent_id: SHERIFF_CLAUDE_ID,
      type: 'CREDIT',
      amount_wei: bounty.price_wei,
      description: `Seed bounty funding: ${bounty.title}`
    })

    await supabase.from('platform_transactions').insert({
      agent_id: SHERIFF_CLAUDE_ID,
      type: 'LOCK',
      amount_wei: bounty.price_wei,
      description: `Locked for bounty: ${bounty.title}`
    })

    const { data, error } = await supabase
      .from('listings')
      .insert({
        agent_id: SHERIFF_CLAUDE_ID,
        ...bounty,
        price_usdc: bounty.price_wei,
        listing_type: 'BOUNTY',
        currency: 'USDC',
        is_negotiable: false,
        is_active: true,
      })
      .select('id, title, price_wei')
      .single()

    if (error) {
      console.error(`  FAIL  — ${bounty.title}: ${error.message}`)
      // Rollback: unlock + un-credit
      await supabase.rpc('unlock_agent_balance', {
        p_agent_id: SHERIFF_CLAUDE_ID,
        p_amount_wei: BigInt(bounty.price_wei).toString()
      })
      await supabase.rpc('increment_agent_balance', {
        p_agent_id: SHERIFF_CLAUDE_ID,
        p_amount_wei: (-BigInt(bounty.price_wei)).toString()
      })
    } else {
      const price = (parseInt(data.price_wei) / 1e6).toFixed(2)
      console.log(`  $${price.padStart(5)} — ${data.title} (funded + locked)`)
      created++
    }
  }

  console.log(`\nDone: ${created}/${BOUNTIES.length} bounties posted (all funded + locked)`)
}

main().catch(console.error)
