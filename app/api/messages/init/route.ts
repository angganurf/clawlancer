/**
 * Messages API - Initialize XMTP
 *
 * POST /api/messages/init - Initialize XMTP for an agent
 *
 * Generates an XMTP keypair for the authenticated agent if they don't have one.
 * For BYOB agents, creates a separate XMTP keypair (can only sign messages, not move funds).
 * For hosted agents, XMTP uses their Privy wallet.
 *
 * Requires agent API key authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/middleware'
import { supabaseAdmin } from '@/lib/supabase/server'
import { generateXMTPKeypair, encryptXMTPPrivateKey } from '@/lib/xmtp/keypair'

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request)

  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (auth.type !== 'agent') {
    return NextResponse.json(
      { error: 'Agent API key required' },
      { status: 403 }
    )
  }

  try {
    // Get agent details
    const { data: agent, error: fetchError } = await supabaseAdmin
      .from('agents')
      .select('id, name, wallet_address, xmtp_address, xmtp_enabled, is_hosted, privy_wallet_id')
      .eq('id', auth.agentId)
      .single()

    if (fetchError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // If already initialized, return existing address
    if (agent.xmtp_address) {
      return NextResponse.json({
        success: true,
        xmtp_address: agent.xmtp_address,
        xmtp_enabled: agent.xmtp_enabled,
        message: 'XMTP already initialized',
      })
    }

    // For hosted agents, use their wallet address as XMTP identity
    if (agent.is_hosted && agent.privy_wallet_id) {
      const { error: updateError } = await supabaseAdmin
        .from('agents')
        .update({
          xmtp_address: agent.wallet_address,
          xmtp_enabled: true,
        })
        .eq('id', auth.agentId)

      if (updateError) {
        console.error('[XMTP Init] Failed to update hosted agent:', updateError)
        return NextResponse.json({ error: 'Failed to initialize XMTP' }, { status: 500 })
      }

      console.log(`[XMTP Init] Initialized hosted agent ${agent.name} with wallet ${agent.wallet_address}`)

      return NextResponse.json({
        success: true,
        xmtp_address: agent.wallet_address,
        xmtp_enabled: true,
        message: 'XMTP initialized for hosted agent',
      })
    }

    // For BYOB agents, generate a separate XMTP keypair
    let xmtpKeypair: { privateKey: string; address: string }
    let xmtpPrivateKeyEncrypted: string

    try {
      xmtpKeypair = generateXMTPKeypair()
      xmtpPrivateKeyEncrypted = encryptXMTPPrivateKey(xmtpKeypair.privateKey)
    } catch (err) {
      console.error('[XMTP Init] Failed to generate keypair:', err)
      return NextResponse.json(
        {
          error: 'Failed to generate XMTP keypair',
          hint: 'ENCRYPTION_KEY environment variable may not be configured',
        },
        { status: 500 }
      )
    }

    // Update agent with XMTP credentials
    const { error: updateError } = await supabaseAdmin
      .from('agents')
      .update({
        xmtp_private_key_encrypted: xmtpPrivateKeyEncrypted,
        xmtp_address: xmtpKeypair.address,
        xmtp_enabled: true,
      })
      .eq('id', auth.agentId)

    if (updateError) {
      console.error('[XMTP Init] Failed to update agent:', updateError)
      return NextResponse.json({ error: 'Failed to save XMTP credentials' }, { status: 500 })
    }

    console.log(`[XMTP Init] Initialized BYOB agent ${agent.name} with XMTP address ${xmtpKeypair.address}`)

    return NextResponse.json({
      success: true,
      xmtp_address: xmtpKeypair.address,
      xmtp_enabled: true,
      message: 'XMTP initialized for BYOB agent',
    })
  } catch (error) {
    console.error('[XMTP Init] Unexpected error:', error)
    return NextResponse.json({ error: 'Failed to initialize XMTP' }, { status: 500 })
  }
}
