/**
 * ERC-8004 Metadata Endpoint
 *
 * GET /api/agents/[id]/erc8004/metadata
 * Returns ERC-8004 compliant metadata for on-chain registration
 *
 * This endpoint is referenced by the agentURI stored on-chain,
 * allowing the IdentityRegistry to fetch current metadata
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAgentERC8004 } from '@/lib/erc8004/storage'
import { toCanonicalMetadata, formatGlobalAgentId } from '@/lib/erc8004/onchain'
import { buildERC8004Identity } from '@/lib/erc8004/identity'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    // Get agent data
    const { data: agent, error } = await supabaseAdmin
      .from('agents')
      .select(`
        id,
        name,
        owner_address,
        wallet_address,
        is_hosted,
        is_active,
        personality,
        transaction_count,
        total_earned_wei,
        total_spent_wei,
        reputation_score,
        reputation_tier,
        reputation_transactions,
        reputation_success_rate,
        erc8004_token_id,
        erc8004_chain,
        created_at
      `)
      .eq('id', agentId)
      .single()

    if (error || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Build ERC-8004 identity
    const identity = buildERC8004Identity({
      id: agent.id,
      name: agent.name,
      description: agent.personality || `AI Agent ${agent.name}`,
      wallet_address: agent.wallet_address,
      category: 'trader',
      capabilities: [],
      created_at: agent.created_at,
      reputation_score: agent.reputation_score || undefined,
      reputation_tier: agent.reputation_tier || undefined,
    })

    // Convert to canonical ERC-8004 metadata format
    const metadata = toCanonicalMetadata(identity)

    // Add registration info if available
    const enrichedMetadata = {
      ...metadata,
      // ERC-8004 standard fields
      agentId: agent.id,
      globalAgentId: agent.erc8004_token_id
        ? formatGlobalAgentId(agent.erc8004_token_id)
        : null,
      // Statistics
      statistics: {
        transactionCount: agent.transaction_count || 0,
        totalEarnedUSDC: (parseFloat(agent.total_earned_wei || '0') / 1e6).toFixed(2),
        totalSpentUSDC: (parseFloat(agent.total_spent_wei || '0') / 1e6).toFixed(2),
        registeredAt: agent.created_at,
      },
      // Verification links
      verification: {
        basescan: agent.wallet_address
          ? `https://basescan.org/address/${agent.wallet_address}`
          : null,
        registry: agent.erc8004_token_id
          ? `https://basescan.org/token/0x8004A818BFB912233c491871b3d84c89A494BD9e?a=${agent.erc8004_token_id}`
          : null,
      },
    }

    // Return with proper content type for JSON-LD
    return new NextResponse(JSON.stringify(enrichedMetadata, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        'Access-Control-Allow-Origin': '*', // Allow cross-origin for on-chain queries
      },
    })
  } catch (error) {
    console.error('ERC-8004 metadata endpoint error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
