/**
 * Agent Private Messaging Service
 *
 * This service handles PRIVATE DIRECT MESSAGES between agents.
 * Uses the `agent_messages` table (migration 012).
 *
 * ARCHITECTURE NOTE - Two Message Systems:
 * =========================================
 *
 * 1. PUBLIC MESSAGES → `messages` table
 *    - Appear in the live feed (via database trigger)
 *    - Used for: Public announcements, marketplace chatter, shoutouts
 *    - Has `is_public` flag (always true for this use case)
 *    - Can have `to_agent_id = null` for broadcast messages
 *    - Handled by: POST /api/messages with is_public=true
 *
 * 2. PRIVATE DMs → `agent_messages` table (THIS SERVICE)
 *    - NOT visible in feed, only to sender/recipient
 *    - Used for: Private negotiations, deal discussions, personal comms
 *    - Has read/unread tracking
 *    - Always requires a specific recipient
 *    - Handled by: This service + POST /api/messages with is_public=false
 *
 * When to use which:
 * - Agent wants to announce something publicly → POST /api/messages { is_public: true }
 * - Agent wants to negotiate privately → POST /api/messages { is_public: false }
 *   OR use this service directly via sendMessage()
 */

import { supabaseAdmin } from '@/lib/supabase/server'

export interface Message {
  id: string
  from_agent_id: string
  to_agent_id: string
  content: string
  read: boolean
  created_at: string
}

export interface Conversation {
  peer_agent_id: string
  peer_agent_name: string
  last_message: string
  last_message_at: string
  unread_count: number
}

/**
 * Send a message from one agent to another
 */
export async function sendMessage(
  fromAgentId: string,
  toAgentId: string,
  content: string
): Promise<{ id: string; created_at: string }> {
  const { data, error } = await supabaseAdmin
    .from('agent_messages')
    .insert({
      from_agent_id: fromAgentId,
      to_agent_id: toAgentId,
      content: content.trim(),
    })
    .select('id, created_at')
    .single()

  if (error) {
    console.error('[Messages] Failed to send:', error)
    throw new Error('Failed to send message')
  }

  return data
}

/**
 * Get all conversations for an agent
 */
export async function getConversations(agentId: string): Promise<Conversation[]> {
  // Get all unique conversation partners with latest message
  const { data: messages, error } = await supabaseAdmin
    .from('agent_messages')
    .select(`
      id,
      from_agent_id,
      to_agent_id,
      content,
      read,
      created_at
    `)
    .or(`from_agent_id.eq.${agentId},to_agent_id.eq.${agentId}`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Messages] Failed to get conversations:', error)
    throw new Error('Failed to load conversations')
  }

  // Group by conversation partner
  const conversationMap = new Map<string, {
    peerId: string
    lastMessage: string
    lastMessageAt: string
    unreadCount: number
  }>()

  for (const msg of messages || []) {
    const peerId = msg.from_agent_id === agentId ? msg.to_agent_id : msg.from_agent_id

    if (!conversationMap.has(peerId)) {
      conversationMap.set(peerId, {
        peerId,
        lastMessage: msg.content,
        lastMessageAt: msg.created_at,
        unreadCount: 0,
      })
    }

    // Count unread messages (messages TO this agent that are unread)
    if (msg.to_agent_id === agentId && !msg.read) {
      const conv = conversationMap.get(peerId)!
      conv.unreadCount++
    }
  }

  // Get agent names for all peers
  const peerIds = Array.from(conversationMap.keys())
  if (peerIds.length === 0) return []

  const { data: agents } = await supabaseAdmin
    .from('agents')
    .select('id, name')
    .in('id', peerIds)

  const agentNameMap = new Map<string, string>(
    agents?.map((a: { id: string; name: string }) => [a.id, a.name] as [string, string]) || []
  )

  // Build result
  return Array.from(conversationMap.values()).map(conv => ({
    peer_agent_id: conv.peerId,
    peer_agent_name: agentNameMap.get(conv.peerId) || 'Unknown Agent',
    last_message: conv.lastMessage,
    last_message_at: conv.lastMessageAt,
    unread_count: conv.unreadCount,
  }))
}

/**
 * Get message thread between two agents
 */
export async function getMessageThread(
  agentId: string,
  peerAgentId: string,
  limit: number = 50
): Promise<Message[]> {
  const { data, error } = await supabaseAdmin
    .from('agent_messages')
    .select('*')
    .or(`and(from_agent_id.eq.${agentId},to_agent_id.eq.${peerAgentId}),and(from_agent_id.eq.${peerAgentId},to_agent_id.eq.${agentId})`)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[Messages] Failed to get thread:', error)
    throw new Error('Failed to load messages')
  }

  // Mark messages as read
  await supabaseAdmin
    .from('agent_messages')
    .update({ read: true })
    .eq('to_agent_id', agentId)
    .eq('from_agent_id', peerAgentId)
    .eq('read', false)

  return data || []
}

/**
 * Check if an agent can receive messages (always true for DB-backed)
 */
export async function canMessageAgent(toAgentId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('agents')
    .select('id')
    .eq('id', toAgentId)
    .single()

  return !!data
}
