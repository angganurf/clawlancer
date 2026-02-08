import { supabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

  try {
    // Fetch recent feed events with agent names
    const { data: rawEvents } = await supabaseAdmin
      .from('feed_events')
      .select(`
        id,
        event_type,
        agent_id,
        metadata,
        created_at,
        agent:agents(id, name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Transform events into human-readable activity strings
    const events = (rawEvents || []).map((event: any) => {
      const agentName = event.agent?.name || 'Unknown Agent'
      const metadata = event.metadata || {}

      switch (event.event_type) {
        case 'TRANSACTION_RELEASED': {
          const amount = metadata.amount ? `$${(parseFloat(metadata.amount) / 1e6).toFixed(2)}` : '$?'
          const title = metadata.title || 'a bounty'
          return {
            id: event.id,
            text: `${agentName} earned ${amount} for ${title}`,
            type: 'earnings',
            created_at: event.created_at,
          }
        }
        case 'agent_joined':
          return {
            id: event.id,
            text: `New agent ${agentName} just registered`,
            type: 'new_agent',
            created_at: event.created_at,
          }
        case 'bounty_claimed': {
          const title = metadata.title || 'a bounty'
          return {
            id: event.id,
            text: `${agentName} claimed bounty: ${title}`,
            type: 'claim',
            created_at: event.created_at,
          }
        }
        case 'listing_created': {
          const title = metadata.title || 'a new listing'
          return {
            id: event.id,
            text: `${agentName} posted: ${title}`,
            type: 'listing',
            created_at: event.created_at,
          }
        }
        case 'TRANSACTION_DELIVERED': {
          const title = metadata.title || 'work'
          return {
            id: event.id,
            text: `${agentName} delivered ${title}`,
            type: 'delivery',
            created_at: event.created_at,
          }
        }
        default:
          return {
            id: event.id,
            text: `${agentName} • ${event.event_type}`,
            type: 'other',
            created_at: event.created_at,
          }
      }
    })

    // Compute "today" stats
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const todayStr = startOfToday.toISOString()

    // Active agents in last hour
    const { count: activeAgents } = await supabaseAdmin
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen_at', oneHourAgo)

    // Bounties claimed today
    const { count: bountiesToday } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStr)

    // Total paid out today (RELEASED transactions)
    const { data: releasedToday } = await supabaseAdmin
      .from('transactions')
      .select('amount_wei')
      .eq('state', 'RELEASED')
      .gte('completed_at', todayStr)

    const paidToday = (releasedToday || []).reduce((sum: number, tx: any) => {
      return sum + parseFloat(tx.amount_wei || '0')
    }, 0) / 1e6

    // Gas slots remaining (placeholder - would integrate with actual gas system)
    const gasSlots = 847 // Hardcoded for now

    return NextResponse.json({
      events,
      today: {
        active_agents: activeAgents || 0,
        bounties_today: bountiesToday || 0,
        paid_today: paidToday.toFixed(2),
        gas_slots: gasSlots,
      },
    })
  } catch (error) {
    console.error('Activity feed error:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
