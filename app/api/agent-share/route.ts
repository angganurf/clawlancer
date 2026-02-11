import { supabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { fireWebhook } from '@/lib/webhooks/send-webhook'

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const body = await request.json()
  const { agent_id, share_type, share_text, listing_id } = body

  if (!agent_id || !share_type || !share_text) {
    return NextResponse.json({ error: 'agent_id, share_type, and share_text are required' }, { status: 400 })
  }

  // Verify the user owns the agent and get webhook config
  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('id, name, owner_address, webhook_url, webhook_enabled')
    .eq('id', agent_id)
    .single()

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  if (auth.type === 'user' && agent.owner_address !== auth.wallet.toLowerCase()) {
    return NextResponse.json({ error: 'Not authorized for this agent' }, { status: 403 })
  }

  // Insert into share queue
  const { data: queueRow, error } = await supabaseAdmin
    .from('agent_share_queue')
    .insert({
      agent_id,
      share_type,
      share_text,
      listing_id: listing_id || null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to queue share' }, { status: 500 })
  }

  // Fire webhook if configured
  const agents_notified: Array<{ id: string; name: string; status: string }> = []

  if (agent.webhook_url && agent.webhook_enabled) {
    const bountyUrl = listing_id
      ? `https://clawlancer.ai/marketplace/${listing_id}`
      : 'https://clawlancer.ai/marketplace'

    const payload = {
      event: 'share_request',
      share_type,
      share_text,
      bounty_url: bountyUrl,
      listing_id: listing_id || null,
      agent_id: agent.id,
      agent_name: agent.name,
      timestamp: new Date().toISOString(),
    }

    try {
      await fireWebhook(agent.id, agent.name || 'Agent', agent.webhook_url, 'share_request', payload)

      // Update queue status to sent
      if (queueRow?.id) {
        await supabaseAdmin
          .from('agent_share_queue')
          .update({ status: 'sent' })
          .eq('id', queueRow.id)
      }

      agents_notified.push({ id: agent.id, name: agent.name || 'Agent', status: 'webhook_sent' })
    } catch {
      // Update queue status to failed
      if (queueRow?.id) {
        await supabaseAdmin
          .from('agent_share_queue')
          .update({ status: 'failed' })
          .eq('id', queueRow.id)
      }

      agents_notified.push({ id: agent.id, name: agent.name || 'Agent', status: 'webhook_failed' })
    }
  }

  return NextResponse.json({
    success: true,
    agents_notified: agents_notified.length,
    agents: agents_notified,
  })
}
