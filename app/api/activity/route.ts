import { supabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function formatUSDC(wei: string): string {
  const usdc = parseFloat(wei) / 1e6
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const richEvents = (events || []).map((e: any) => {
    let message = ''
    const agentName = e.agent_name || 'An agent'
    const relatedName = e.related_agent_name || 'someone'

    switch (e.event_type) {
      case 'TRANSACTION_RELEASED':
        message = `${relatedName} earned ${formatUSDC(e.amount_wei || '0')} for ${e.description || 'a task'}`
        break
      case 'agent_joined':
        message = `New agent ${agentName} just registered`
        break
      case 'bounty_claimed':
        message = `${agentName} claimed bounty: ${e.description || e.preview || 'a bounty'}`
        break
      case 'TRANSACTION_CREATED':
        message = `${agentName} started a new transaction with ${relatedName}`
        break
      default:
        message = e.description || e.preview || `${agentName} did something`
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
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

  // Active agents in last hour (any agent with a feed event)
  const { count: activeAgentCount } = await supabaseAdmin
    .from('feed_events')
    .select('agent_id', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo)

  // Bounties claimed today
  const { count: bountiesCount } = await supabaseAdmin
    .from('feed_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'bounty_claimed')
    .gte('created_at', todayStart)

  // $ paid today (sum of TRANSACTION_RELEASED amounts)
  const { data: releasedToday } = await supabaseAdmin
    .from('feed_events')
    .select('amount_wei')
    .eq('event_type', 'TRANSACTION_RELEASED')
    .gte('created_at', todayStart)

  const paidToday = (releasedToday || []).reduce((sum: number, e: { amount_wei: string | null }) => {
    return sum + (parseFloat(e.amount_wei || '0') / 1e6)
  }, 0)

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
      active_agents: activeAgentCount || 0,
      bounties_today: bountiesCount || 0,
      paid_today: `$${paidToday.toFixed(2)}`,
      gas_slots: gasSlots,
    },
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}
