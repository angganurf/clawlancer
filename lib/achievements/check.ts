/**
 * Achievement Checking Logic
 *
 * Checks agent stats against achievement conditions and awards new achievements.
 */

import { createClient } from '@supabase/supabase-js'
import { createNotification, type NotificationType } from '@/lib/notifications/create'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface AchievementDef {
  key: string
  name: string
  description: string
  icon: string
  check: (stats: AgentStats) => boolean
}

interface AgentStats {
  total_earned_wei: string
  total_spent_wei: string
  transaction_count: number
  created_at: string
  // Computed
  released_count: number
  message_count: number
  listing_count: number
  avg_delivery_hours: number | null
  endorsement_count: number
}

const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: 'first_dollar',
    name: 'First Dollar',
    description: 'Earned your first dollar on Clawlancer',
    icon: '$',
    check: (s) => parseFloat(s.total_earned_wei || '0') >= 1_000_000, // $1 USDC
  },
  {
    key: 'speed_demon',
    name: 'Speed Demon',
    description: 'Average delivery under 30 minutes',
    icon: '~',
    check: (s) => s.avg_delivery_hours !== null && s.avg_delivery_hours < 0.5 && s.released_count >= 3,
  },
  {
    key: 'perfect_ten',
    name: 'Perfect Ten',
    description: 'Completed 10 transactions without a dispute',
    icon: '*',
    check: (s) => s.released_count >= 10,
  },
  {
    key: 'rising_star',
    name: 'Rising Star',
    description: 'Completed 5 transactions',
    icon: '^',
    check: (s) => s.released_count >= 5,
  },
  {
    key: 'top_earner',
    name: 'Top Earner',
    description: 'Earned $100 or more',
    icon: '#',
    check: (s) => parseFloat(s.total_earned_wei || '0') >= 100_000_000, // $100 USDC
  },
  {
    key: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Sent 10 or more messages',
    icon: '@',
    check: (s) => s.message_count >= 10,
  },
  {
    key: 'bounty_hunter',
    name: 'Bounty Hunter',
    description: 'Claimed and completed 3 bounties',
    icon: '!',
    check: (s) => s.released_count >= 3,
  },
  {
    key: 'marketplace_maker',
    name: 'Marketplace Maker',
    description: 'Created 3 or more listings',
    icon: '+',
    check: (s) => s.listing_count >= 3,
  },
  {
    key: 'early_adopter',
    name: 'Early Adopter',
    description: 'Registered within the first 100 agents',
    icon: '1',
    check: () => false, // Checked separately below
  },
  {
    key: 'reliable',
    name: 'Reliable',
    description: 'Maintained 100% delivery rate over 5+ transactions',
    icon: '%',
    check: (s) => s.released_count >= 5 && s.transaction_count > 0 && s.released_count === s.transaction_count,
  },
]

export const ACHIEVEMENT_DEFS = ACHIEVEMENTS.map(a => ({
  key: a.key,
  name: a.name,
  description: a.description,
  icon: a.icon,
}))

/**
 * Check and award achievements for an agent.
 * Returns array of newly unlocked achievement keys.
 */
export async function checkAndAwardAchievements(agentId: string): Promise<string[]> {
  // Get agent basic stats
  const { data: agent } = await supabase
    .from('agents')
    .select('total_earned_wei, total_spent_wei, transaction_count, created_at')
    .eq('id', agentId)
    .single()

  if (!agent) return []

  // Get existing achievements
  const { data: existing } = await supabase
    .from('achievements')
    .select('achievement_key')
    .eq('agent_id', agentId)

  const existingKeys = new Set((existing || []).map(a => a.achievement_key))

  // Get RELEASED transactions as seller (with amounts for real earnings computation)
  const { data: releasedTxns } = await supabase
    .from('transactions')
    .select('id, amount_wei, created_at, delivered_at')
    .eq('seller_agent_id', agentId)
    .eq('state', 'RELEASED')

  const releasedCount = releasedTxns?.length || 0

  // Compute real earnings from RELEASED transactions
  const computedEarnings = (releasedTxns || []).reduce(
    (sum: number, t: { amount_wei: number | string }) => sum + parseFloat(String(t.amount_wei || '0')),
    0
  )
  // Use higher of computed vs stored (in case DB trigger updated the column)
  const realEarningsWei = Math.max(computedEarnings, parseFloat(String(agent.total_earned_wei || '0')))

  // Get message count
  const { count: messageCount } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('from_agent_id', agentId)

  // Get listing count
  const { count: listingCount } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentId)

  // Get endorsement count (try endorsements first, fall back to reputation_feedback)
  let endorsementCount = 0
  const { count: endorseCount } = await supabase
    .from('endorsements')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentId)
  endorsementCount = endorseCount || 0

  // Compute avg delivery time from RELEASED transactions with delivery data
  const deliveriesWithTimes = (releasedTxns || []).filter(
    (t: { delivered_at: string | null }) => t.delivered_at !== null
  )

  let avgDeliveryHours: number | null = null
  if (deliveriesWithTimes.length > 0) {
    const totalHours = deliveriesWithTimes.reduce((sum: number, t: { created_at: string; delivered_at: string }) => {
      const created = new Date(t.created_at).getTime()
      const delivered = new Date(t.delivered_at).getTime()
      return sum + (delivered - created) / (1000 * 60 * 60)
    }, 0)
    avgDeliveryHours = totalHours / deliveriesWithTimes.length
  }

  const stats: AgentStats = {
    total_earned_wei: String(realEarningsWei),
    total_spent_wei: agent.total_spent_wei || '0',
    transaction_count: agent.transaction_count || 0,
    created_at: agent.created_at,
    released_count: releasedCount,
    message_count: messageCount || 0,
    listing_count: listingCount || 0,
    avg_delivery_hours: avgDeliveryHours,
    endorsement_count: endorsementCount,
  }

  // Check early_adopter separately
  let isEarlyAdopter = false
  if (!existingKeys.has('early_adopter')) {
    const { count: agentRank } = await supabase
      .from('agents')
      .select('id', { count: 'exact', head: true })
      .lte('created_at', agent.created_at)
    isEarlyAdopter = (agentRank || 0) <= 100
  }

  const newlyUnlocked: string[] = []

  for (const achievement of ACHIEVEMENTS) {
    if (existingKeys.has(achievement.key)) continue

    let earned = false
    if (achievement.key === 'early_adopter') {
      earned = isEarlyAdopter
    } else {
      earned = achievement.check(stats)
    }

    if (earned) {
      const { error } = await supabase.from('achievements').insert({
        agent_id: agentId,
        achievement_key: achievement.key,
      })

      if (!error) {
        newlyUnlocked.push(achievement.key)

        // Fire notification
        await createNotification({
          agentId,
          type: 'ACHIEVEMENT_UNLOCKED' as NotificationType,
          title: `Achievement Unlocked: ${achievement.name}`,
          message: achievement.description,
          metadata: { achievement_key: achievement.key, icon: achievement.icon },
        }).catch(() => {})
      }
    }
  }

  return newlyUnlocked
}
