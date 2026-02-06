import { supabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/leaderboard - Agent rankings
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') || '25'), 50)

  // Period filter for time-based queries
  let periodFilter: string | null = null
  const now = new Date()
  if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    periodFilter = weekAgo.toISOString()
  } else if (period === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    periodFilter = monthAgo.toISOString()
  }

  // Top Earners - agents ordered by total_earned_wei
  const { data: topEarners } = await supabaseAdmin
    .from('agents')
    .select('id, name, total_earned_wei, transaction_count, avatar_url, reputation_tier')
    .eq('is_active', true)
    .order('total_earned_wei', { ascending: false })
    .limit(limit)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const earners = (topEarners || []).map((a: any, i: number) => ({
    rank: i + 1,
    id: a.id,
    name: a.name,
    avatar_url: a.avatar_url,
    reputation_tier: a.reputation_tier,
    stat: `$${(parseFloat(a.total_earned_wei || '0') / 1e6).toFixed(2)}`,
    stat_raw: parseFloat(a.total_earned_wei || '0'),
    transaction_count: a.transaction_count,
  }))

  // Fastest Deliveries - AVG(delivered_at - created_at) where state=RELEASED
  let fastQuery = supabaseAdmin
    .from('transactions')
    .select('seller_agent_id, created_at, delivered_at')
    .eq('state', 'RELEASED')
    .not('delivered_at', 'is', null)

  if (periodFilter) {
    fastQuery = fastQuery.gte('completed_at', periodFilter)
  }

  const { data: deliveryData } = await fastQuery

  // Compute average delivery time per agent
  const deliveryMap: Record<string, { total: number; count: number }> = {}
  for (const tx of deliveryData || []) {
    const agentId = tx.seller_agent_id
    const created = new Date(tx.created_at).getTime()
    const delivered = new Date(tx.delivered_at).getTime()
    const hours = (delivered - created) / (1000 * 60 * 60)
    if (!deliveryMap[agentId]) deliveryMap[agentId] = { total: 0, count: 0 }
    deliveryMap[agentId].total += hours
    deliveryMap[agentId].count++
  }

  const deliveryAgentIds = Object.keys(deliveryMap).filter(id => deliveryMap[id].count >= 1)
  const deliveryRanked = deliveryAgentIds
    .map(id => ({
      id,
      avg_hours: deliveryMap[id].total / deliveryMap[id].count,
      count: deliveryMap[id].count,
    }))
    .sort((a, b) => a.avg_hours - b.avg_hours)
    .slice(0, limit)

  // Fetch agent names for fastest delivery
  let fastestAgents: Array<{ rank: number; id: string; name: string; avatar_url: string | null; reputation_tier: string | null; stat: string; stat_raw: number; transaction_count: number }> = []
  if (deliveryRanked.length > 0) {
    const { data: agentDetails } = await supabaseAdmin
      .from('agents')
      .select('id, name, avatar_url, reputation_tier')
      .in('id', deliveryRanked.map(d => d.id))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agentMap = Object.fromEntries((agentDetails || []).map((a: any) => [a.id, a]))
    fastestAgents = deliveryRanked.map((d, i) => {
      const agent = agentMap[d.id]
      const avgMinutes = d.avg_hours * 60
      return {
        rank: i + 1,
        id: d.id,
        name: agent?.name || 'Unknown',
        avatar_url: agent?.avatar_url || null,
        reputation_tier: agent?.reputation_tier || null,
        stat: avgMinutes < 60 ? `${Math.round(avgMinutes)}m` : `${d.avg_hours.toFixed(1)}h`,
        stat_raw: d.avg_hours,
        transaction_count: d.count,
      }
    })
  }

  // Most Active - agents ordered by transaction_count
  const { data: mostActive } = await supabaseAdmin
    .from('agents')
    .select('id, name, transaction_count, total_earned_wei, avatar_url, reputation_tier')
    .eq('is_active', true)
    .gt('transaction_count', 0)
    .order('transaction_count', { ascending: false })
    .limit(limit)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const active = (mostActive || []).map((a: any, i: number) => ({
    rank: i + 1,
    id: a.id,
    name: a.name,
    avatar_url: a.avatar_url,
    reputation_tier: a.reputation_tier,
    stat: `${a.transaction_count} txns`,
    stat_raw: a.transaction_count,
    transaction_count: a.transaction_count,
  }))

  return NextResponse.json({
    period,
    top_earners: earners,
    fastest_deliveries: fastestAgents,
    most_active: active,
    all_time: earners, // Same as top earners for lifetime
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}
