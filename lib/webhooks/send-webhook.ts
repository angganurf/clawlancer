/**
 * Generic Webhook Sender
 * Reusable webhook delivery with logging to webhook_events table.
 * Supports any event type with structured payloads.
 */

import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * Fire a webhook to an agent's configured URL.
 * Logs to webhook_events, retries once after 30s on failure.
 */
export async function fireWebhook(
  agentId: string,
  agentName: string,
  webhookUrl: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Insert pending webhook event
  const { data: event } = await supabaseAdmin
    .from('webhook_events')
    .insert({
      agent_id: agentId,
      event_type: eventType,
      payload,
      status: 'pending',
    })
    .select('id')
    .single()

  const eventId = event?.id

  const sendAttempt = async (isRetry: boolean): Promise<boolean> => {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Clawlancer-Webhook/1.0',
          'X-Clawlancer-Event': eventType,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      })

      if (response.ok) {
        // Update webhook event log
        if (eventId) {
          await supabaseAdmin
            .from('webhook_events')
            .update({ status: 'delivered', response_code: response.status })
            .eq('id', eventId)
        }

        // Update agent success timestamp
        await supabaseAdmin
          .from('agents')
          .update({
            last_webhook_success_at: new Date().toISOString(),
            last_webhook_error: null,
          })
          .eq('id', agentId)

        console.log(`[Webhooks] ✓ ${eventType} sent to ${agentName}${isRetry ? ' (retry)' : ''}`)
        return true
      } else {
        const errorText = await response.text().catch(() => 'Unknown error')
        const errorMsg = `HTTP ${response.status}: ${errorText.slice(0, 200)}`

        if (eventId) {
          await supabaseAdmin
            .from('webhook_events')
            .update({
              status: isRetry ? 'failed' : 'retrying',
              response_code: response.status,
              error_message: errorMsg,
            })
            .eq('id', eventId)
        }

        await supabaseAdmin
          .from('agents')
          .update({ last_webhook_error: `${errorMsg}${isRetry ? ' (retry failed)' : ''}` })
          .eq('id', agentId)

        console.error(`[Webhooks] ✗ ${eventType} to ${agentName}: ${errorMsg}${isRetry ? ' (retry)' : ''}`)
        return false
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'

      if (eventId) {
        await supabaseAdmin
          .from('webhook_events')
          .update({
            status: isRetry ? 'failed' : 'retrying',
            error_message: errorMsg.slice(0, 200),
          })
          .eq('id', eventId)
      }

      await supabaseAdmin
        .from('agents')
        .update({ last_webhook_error: `${errorMsg.slice(0, 200)}${isRetry ? ' (retry failed)' : ''}` })
        .eq('id', agentId)

      console.error(`[Webhooks] ✗ ${eventType} to ${agentName}:`, errorMsg, isRetry ? '(retry)' : '')
      return false
    }
  }

  // First attempt
  const success = await sendAttempt(false)

  // Retry after 30s on failure
  if (!success) {
    console.log(`[Webhooks] Scheduling retry for ${agentName} in 30s...`)
    setTimeout(async () => {
      await sendAttempt(true)
    }, 30000)
  }
}

/**
 * Look up an agent's webhook config and fire if enabled.
 * Returns whether a webhook was sent.
 */
export async function fireAgentWebhook(
  agentId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ sent: boolean; agentName?: string }> {
  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('id, name, webhook_url, webhook_enabled')
    .eq('id', agentId)
    .single()

  if (!agent || !agent.webhook_enabled || !agent.webhook_url) {
    return { sent: false }
  }

  // Fire and forget — don't block the caller
  fireWebhook(agent.id, agent.name || 'Agent', agent.webhook_url, eventType, payload)
    .catch(err => console.error(`[Webhooks] fireAgentWebhook error:`, err))

  return { sent: true, agentName: agent.name }
}
