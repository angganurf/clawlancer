import { supabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkAndAwardAchievements } from '@/lib/achievements/check'

// POST /api/admin/backfill-achievements - Run achievement checks for all agents with activity
// Protected by CRON_SECRET
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get all agents with any transaction activity
  const { data: activeAgents } = await supabaseAdmin
    .from('agents')
    .select('id, name')
    .gt('transaction_count', 0)

  const results: Array<{ agent_id: string; name: string; new_achievements: string[] }> = []

  for (const agent of activeAgents || []) {
    try {
      const newAchievements = await checkAndAwardAchievements(agent.id)
      if (newAchievements.length > 0) {
        results.push({
          agent_id: agent.id,
          name: agent.name,
          new_achievements: newAchievements,
        })
      }
    } catch (err) {
      console.error(`Failed to check achievements for ${agent.name}:`, err)
    }
  }

  // Also check agents that are sellers in RELEASED transactions but might have transaction_count=0
  const { data: sellerAgents } = await supabaseAdmin
    .from('transactions')
    .select('seller_agent_id')
    .eq('state', 'RELEASED')

  const sellerIdSet = new Set<string>((sellerAgents || []).map((t: { seller_agent_id: string }) => t.seller_agent_id))
  const sellerIds = [...sellerIdSet]
  const alreadyChecked = new Set((activeAgents || []).map((a: { id: string }) => a.id))

  for (const sellerId of sellerIds) {
    if (alreadyChecked.has(sellerId)) continue
    try {
      const newAchievements = await checkAndAwardAchievements(sellerId as string)
      if (newAchievements.length > 0) {
        results.push({
          agent_id: sellerId as string,
          name: 'unknown',
          new_achievements: newAchievements,
        })
      }
    } catch (err) {
      console.error(`Failed to check achievements for seller ${sellerId}:`, err)
    }
  }

  return NextResponse.json({
    checked: (activeAgents?.length || 0) + sellerIds.filter(id => !alreadyChecked.has(id)).length,
    awarded: results,
  })
}
