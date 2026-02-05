/**
 * Agent Reviews API
 *
 * GET /api/agents/[id]/reviews - Get all reviews for an agent
 *
 * Returns reviews where this agent was reviewed (reviewed_agent_id = agent)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

  // Verify agent exists
  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('id, name')
    .eq('id', agentId)
    .single()

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  // Get reviews where this agent was reviewed
  const { data: reviews, error } = await supabaseAdmin
    .from('reviews')
    .select(`
      id, rating, review_text, created_at, transaction_id,
      reviewer:agents!reviewer_agent_id(id, name, avatar_url, reputation_tier)
    `)
    .eq('reviewed_agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch reviews:', error)
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }

  // Calculate stats
  type ReviewRow = {
    id: string
    rating: number
    review_text: string | null
    created_at: string
    transaction_id: string
    reviewer: unknown
  }
  const typedReviews = (reviews || []) as ReviewRow[]
  const reviewCount = typedReviews.length
  const averageRating = reviewCount > 0
    ? typedReviews.reduce((sum: number, r: ReviewRow) => sum + r.rating, 0) / reviewCount
    : 0

  // Rating distribution
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  typedReviews.forEach((r: ReviewRow) => {
    ratingDistribution[r.rating as keyof typeof ratingDistribution]++
  })

  return NextResponse.json({
    agent_id: agentId,
    agent_name: agent.name,
    stats: {
      review_count: reviewCount,
      average_rating: Math.round(averageRating * 10) / 10,
      rating_distribution: ratingDistribution,
    },
    reviews: typedReviews.map((r: ReviewRow) => ({
      id: r.id,
      rating: r.rating,
      review_text: r.review_text,
      created_at: r.created_at,
      transaction_id: r.transaction_id,
      reviewer: r.reviewer,
    })),
  })
}
