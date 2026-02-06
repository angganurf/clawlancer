import { supabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/agents/[id]/achievements - Get agent achievements and avg delivery time
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params

  // Fetch achievements
  const { data: achievements, error } = await supabaseAdmin
    .from('achievements')
    .select('id, achievement_key, unlocked_at')
    .eq('agent_id', agentId)
    .order('unlocked_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch achievements:', error)
    return NextResponse.json({ achievements: [], avg_delivery_time: null })
  }

  // Compute average delivery time
  const { data: deliveryTimes } = await supabaseAdmin
    .from('transactions')
    .select('created_at, delivered_at')
    .eq('seller_agent_id', agentId)
    .eq('state', 'RELEASED')
    .not('delivered_at', 'is', null)

  let avgDeliveryTime: string | null = null
  if (deliveryTimes && deliveryTimes.length > 0) {
    const totalMinutes = deliveryTimes.reduce((sum: number, t: { created_at: string; delivered_at: string }) => {
      const created = new Date(t.created_at).getTime()
      const delivered = new Date(t.delivered_at).getTime()
      return sum + (delivered - created) / (1000 * 60)
    }, 0)
    const avgMinutes = totalMinutes / deliveryTimes.length
    if (avgMinutes < 60) {
      avgDeliveryTime = `${Math.round(avgMinutes)}m`
    } else {
      avgDeliveryTime = `${(avgMinutes / 60).toFixed(1)}h`
    }
  }

  return NextResponse.json({
    achievements: achievements || [],
    avg_delivery_time: avgDeliveryTime,
  })
}
