/**
 * ERC-8004 On-Chain Registration Endpoint
 *
 * POST /api/agents/[id]/erc8004/register
 * Registers an agent on the canonical ERC-8004 IdentityRegistry on Base mainnet
 *
 * Per PRD Section 4 - On-chain identity registration
 */

import { NextRequest, NextResponse } from 'next/server'
import { registerAgentOnChain, verifyAgentRegistration, formatGlobalAgentId } from '@/lib/erc8004/onchain'
import { getAgentERC8004 } from '@/lib/erc8004/storage'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    // Verify agent exists and has ERC-8004 data
    const registration = await getAgentERC8004(agentId)
    if (!registration) {
      return NextResponse.json(
        { error: 'Agent not found or has no ERC-8004 registration data' },
        { status: 404 }
      )
    }

    // Check if already registered on-chain
    if (registration.chainStatus?.chain === 'base' && registration.chainStatus?.tokenId) {
      const verified = await verifyAgentRegistration(registration.chainStatus.tokenId)
      if (verified.exists) {
        return NextResponse.json({
          success: true,
          alreadyRegistered: true,
          tokenId: registration.chainStatus.tokenId,
          globalAgentId: formatGlobalAgentId(registration.chainStatus.tokenId),
          txHash: registration.chainStatus.registrationTx,
          message: 'Agent is already registered on-chain',
        })
      }
    }

    // Register on-chain
    const result = await registerAgentOnChain(agentId)

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Registration failed',
          txHash: result.txHash,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tokenId: result.tokenId,
      globalAgentId: result.tokenId ? formatGlobalAgentId(result.tokenId) : null,
      txHash: result.txHash,
      message: 'Agent successfully registered on ERC-8004 IdentityRegistry',
    })
  } catch (error) {
    console.error('ERC-8004 registration endpoint error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/agents/[id]/erc8004/register
 * Check registration status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    const registration = await getAgentERC8004(agentId)
    if (!registration) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const isRegistered = registration.chainStatus?.chain === 'base' && registration.chainStatus?.tokenId
    let onChainVerified = false

    if (isRegistered && registration.chainStatus?.tokenId) {
      const verified = await verifyAgentRegistration(registration.chainStatus.tokenId)
      onChainVerified = verified.exists
    }

    return NextResponse.json({
      agentId,
      isRegistered,
      onChainVerified,
      chainStatus: registration.chainStatus || { chain: 'local' },
      globalAgentId: registration.chainStatus?.tokenId
        ? formatGlobalAgentId(registration.chainStatus.tokenId)
        : null,
    })
  } catch (error) {
    console.error('ERC-8004 status check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
