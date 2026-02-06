import { supabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/leaderboard - Agent rankings computed from real transaction data
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

  // --- Top Earners: compute from actual RELEASED transactions ---
  let earnerQuery = supabaseAdmin
    .from('transactions')
    .select('seller_agent_id, amount_wei')
    .eq('state', 'RELEASED')

  if (periodFilter) {
    earnerQuery = earnerQuery.gte('completed_at', periodFilter)
  }

  const { data: earnerTxns } = await earnerQuery

  // Sum earnings per agent from transactions
  const earningsMap: Record<string, { total: number; count: number }> = {}
  for (const tx of earnerTxns || []) {
    const agentId = tx.seller_agent_id
    const amount = parseFloat(String(tx.amount_wei || '0'))
    if (!earningsMap[agentId]) earningsMap[agentId] = { total: 0, count: 0 }
    earningsMap[agentId].total += amount
    earningsMap[agentId].count++
  }

  // Also include agents with transaction_count > 0 but no RELEASED txns as sellers
  // (they participated as buyers)
  const { data: activeAgentsData } = await supabaseAdmin
    .from('agents')
    .select('id, name, avatar_url, reputation_tier, transaction_count, total_earned_wei')
    .eq('is_active', true)
    .gt('transaction_count', 0)

  // Merge: use computed earnings from transactions, falling back to agent.total_earned_wei
  const allAgentIds = new Set([
    ...Object.keys(earningsMap),
    ...(activeAgentsData || []).map((a: { id: string }) => a.id),
  ])

  // Fetch agent details for all relevant agents
  const agentIds = [...allAgentIds]
  let agentDetailsMap: Record<string, { name: string; avatar_url: string | null; reputation_tier: string | null; transaction_count: number; total_earned_wei: number }> = {}
  if (agentIds.length > 0) {
    const { data: details } = await supabaseAdmin
      .from('agents')
      .select('id, name, avatar_url, reputation_tier, transaction_count, total_earned_wei')
      .in('id', agentIds)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    agentDetailsMap = Object.fromEntries((details || []).map((a: any) => [a.id, a]))
  }

  // Build earners list — prefer transaction-computed earnings, fall back to agent column
  const earnerEntries = agentIds.map(id => {
    const fromTxns = earningsMap[id]
    const agent = agentDetailsMap[id]
    const computedEarnings = fromTxns ? fromTxns.total : parseFloat(String(agent?.total_earned_wei || '0'))
    const txnCount = fromTxns ? fromTxns.count : (agent?.transaction_count || 0)
    return { id, earnings: computedEarnings, txnCount, agent }
  })
    .filter(e => e.earnings > 0 || e.txnCount > 0) // Only agents with activity
    .sort((a, b) => b.earnings - a.earnings)
    .slice(0, limit)

  const earners = earnerEntries.map((e, i) => ({
    rank: i + 1,
    id: e.id,
    name: e.agent?.name || 'Unknown',
    avatar_url: e.agent?.avatar_url || null,
    reputation_tier: e.agent?.reputation_tier || null,
    stat: `$${(e.earnings / 1e6).toFixed(2)}`,
    stat_raw: e.earnings,
    transaction_count: e.txnCount,
  }))

  // --- Fastest Deliveries: AVG(delivered_at - created_at) where state=RELEASED ---
  let fastQuery = supabaseAdmin
    .from('transactions')
    .select('seller_agent_id, created_at, delivered_at')
    .eq('state', 'RELEASED')
    .not('delivered_at', 'is', null)

  if (periodFilter) {
    fastQuery = fastQuery.gte('completed_at', periodFilter)
  }

  const { data: deliveryData } = await fastQuery

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

  const deliveryRanked = Object.keys(deliveryMap)
    .filter(id => deliveryMap[id].count >= 1)
    .map(id => ({
      id,
      avg_hours: deliveryMap[id].total / deliveryMap[id].count,
      count: deliveryMap[id].count,
    }))
    .sort((a, b) => a.avg_hours - b.avg_hours)
    .slice(0, limit)

  const fastestAgents = deliveryRanked.map((d, i) => {
    const agent = agentDetailsMap[d.id]
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

  // --- Most Active: agents with highest transaction_count ---
  // Compute from actual transactions (both as buyer and seller)
  const { data: allTxns } = await supabaseAdmin
    .from('transactions')
    .select('seller_agent_id, buyer_agent_id')

  const activityMap: Record<string, number> = {}
  for (const tx of allTxns || []) {
    if (tx.seller_agent_id) {
      activityMap[tx.seller_agent_id] = (activityMap[tx.seller_agent_id] || 0) + 1
    }
    if (tx.buyer_agent_id) {
      activityMap[tx.buyer_agent_id] = (activityMap[tx.buyer_agent_id] || 0) + 1
    }
  }

  const activeRanked = Object.entries(activityMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)

  const active = activeRanked.map(([id, count], i) => {
    const agent = agentDetailsMap[id]
    return {
      rank: i + 1,
      id,
      name: agent?.name || 'Unknown',
      avatar_url: agent?.avatar_url || null,
      reputation_tier: agent?.reputation_tier || null,
      stat: `${count} txns`,
      stat_raw: count,
      transaction_count: count,
    }
  })

  // Fetch names for any agents in active list but not in agentDetailsMap
  const missingIds = activeRanked
    .map(([id]) => id)
    .filter(id => !agentDetailsMap[id])
  if (missingIds.length > 0) {
    const { data: extra } = await supabaseAdmin
      .from('agents')
      .select('id, name, avatar_url, reputation_tier')
      .in('id', missingIds)
    for (const a of extra || []) {
      // Update the active entries with real names
      const entry = active.find(e => e.id === a.id)
      if (entry) {
        entry.name = a.name
        entry.avatar_url = a.avatar_url
        entry.reputation_tier = a.reputation_tier
      }
    }
  }

  return NextResponse.json({
    period,
    top_earners: earners,
    fastest_deliveries: fastestAgents,
    most_active: active,
    all_time: earners,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}
