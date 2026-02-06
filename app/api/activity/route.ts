import { supabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function formatUSDC(wei: number | string | null): string {
  const usdc = parseFloat(String(wei || '0')) / 1e6
  return `$${usdc.toFixed(2)}`
}

// GET /api/activity - Rich activity feed + today's stats
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

  // Fetch recent feed events with agent names
  const { data: events, error } = await supabaseAdmin
    .from('feed_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch activity:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }

  // Build human-readable event strings
  // DB event_types: AGENT_CREATED, LISTING_CREATED, LISTING_UPDATED, TRANSACTION_CREATED, TRANSACTION_RELEASED, MESSAGE_SENT
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const richEvents = (events || []).map((e: any) => {
    let message = ''
    const agentName = e.agent_name || 'An agent'
    const relatedName = e.related_agent_name || 'someone'

    switch (e.event_type) {
      case 'TRANSACTION_RELEASED':
        message = `${relatedName} earned ${formatUSDC(e.amount_wei)} for ${e.description || 'a task'}`
        break
      case 'AGENT_CREATED':
        message = `New agent ${agentName} just registered`
        break
      case 'LISTING_CREATED':
        message = `${agentName} posted: ${e.description || 'a new listing'}`
        break
      case 'LISTING_UPDATED':
        message = `${agentName} updated a listing`
        break
      case 'TRANSACTION_CREATED':
        message = `${agentName} started a new transaction with ${relatedName}`
        break
      case 'MESSAGE_SENT':
        message = `${agentName} sent a message to ${relatedName}`
        break
      default:
        message = e.description || `${agentName} did something`
    }

    return {
      id: e.id,
      message,
      event_type: e.event_type,
      amount_wei: e.amount_wei,
      created_at: e.created_at,
      agent_name: agentName,
      related_agent_name: relatedName,
    }
  })

  // Compute "today" stats
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  // Active agents in last 24 hours (distinct agent_ids with feed events)
  const { data: activeAgentData } = await supabaseAdmin
    .from('feed_events')
    .select('agent_id')
    .gte('created_at', twentyFourHoursAgo)

  const uniqueActiveAgents = new Set((activeAgentData || []).map((e: { agent_id: string }) => e.agent_id).filter(Boolean))

  // Bounties completed today (TRANSACTION_RELEASED events, not bounty_claimed which doesn't exist)
  const { count: bountiesCount } = await supabaseAdmin
    .from('feed_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'TRANSACTION_RELEASED')
    .gte('created_at', todayStart)

  // $ paid today (sum of TRANSACTION_RELEASED amounts from feed_events)
  const { data: releasedToday } = await supabaseAdmin
    .from('feed_events')
    .select('amount_wei')
    .eq('event_type', 'TRANSACTION_RELEASED')
    .gte('created_at', todayStart)

  // Also check transactions table directly for released transactions today
  const { data: releasedTxns } = await supabaseAdmin
    .from('transactions')
    .select('amount_wei')
    .eq('state', 'RELEASED')
    .gte('completed_at', todayStart)

  // Use whichever source has more data
  const feedPaid = (releasedToday || []).reduce((sum: number, e: { amount_wei: number | string | null }) => {
    return sum + (parseFloat(String(e.amount_wei || '0')) / 1e6)
  }, 0)
  const txnPaid = (releasedTxns || []).reduce((sum: number, t: { amount_wei: number | string | null }) => {
    return sum + (parseFloat(String(t.amount_wei || '0')) / 1e6)
  }, 0)
  const paidToday = Math.max(feedPaid, txnPaid)

  // Gas slots remaining
  const { data: gasSetting } = await supabaseAdmin
    .from('platform_settings')
    .select('value')
    .eq('key', 'gas_promo_count')
    .single()

  const gasUsed = parseInt(gasSetting?.value || '0')
  const gasTotal = parseInt(process.env.GAS_PROMO_MAX_AGENTS || '100')
  const gasSlots = Math.max(0, gasTotal - gasUsed)

  return NextResponse.json({
    events: richEvents,
    today: {
      active_agents: uniqueActiveAgents.size,
      bounties_today: bountiesCount || 0,
      paid_today: `$${paidToday.toFixed(2)}`,
      gas_slots: gasSlots,
    },
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}
