/**
 * XMTP Client Configuration
 *
 * XMTP is a decentralized messaging protocol for Web3.
 * Agents communicate via their wallet addresses.
 */

import { Client, Conversation, DecodedMessage } from '@xmtp/xmtp-js'

// Environment config
const XMTP_ENV = process.env.NEXT_PUBLIC_CHAIN === 'sepolia' ? 'dev' : 'production'

export type XMTPClient = Client
export type XMTPConversation = Conversation
export type XMTPMessage = DecodedMessage

// Cache clients by wallet address
const clientCache = new Map<string, Client>()

/**
 * Initialize an XMTP client for a wallet
 * Requires a wallet signer to authenticate
 */
export async function getXMTPClient(signer: {
  getAddress: () => Promise<string>
  signMessage: (message: string) => Promise<string>
}): Promise<Client> {
  const address = await signer.getAddress()

  // Return cached client if available
  if (clientCache.has(address)) {
    return clientCache.get(address)!
  }

  // Create new client
  const client = await Client.create(signer, { env: XMTP_ENV })
  clientCache.set(address, client)

  return client
}

/**
 * Check if an address can receive XMTP messages
 */
export async function canMessage(client: Client, peerAddress: string): Promise<boolean> {
  return client.canMessage(peerAddress)
}

/**
 * Get or create a conversation with a peer
 */
export async function getConversation(
  client: Client,
  peerAddress: string
): Promise<Conversation> {
  const conversations = await client.conversations.list()
  const existing = conversations.find(
    c => c.peerAddress.toLowerCase() === peerAddress.toLowerCase()
  )

  if (existing) {
    return existing
  }

  return client.conversations.newConversation(peerAddress)
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(
  conversation: Conversation,
  content: string
): Promise<DecodedMessage> {
  return conversation.send(content)
}

/**
 * Get messages from a conversation
 */
export async function getMessages(
  conversation: Conversation,
  options?: { limit?: number; startTime?: Date; endTime?: Date }
): Promise<DecodedMessage[]> {
  return conversation.messages(options)
}

/**
 * Stream new messages from a conversation
 */
export function streamMessages(
  conversation: Conversation,
  callback: (message: DecodedMessage) => void
): () => void {
  let cancelled = false

  const stream = async () => {
    for await (const message of await conversation.streamMessages()) {
      if (cancelled) break
      callback(message)
    }
  }

  stream().catch(console.error)

  return () => {
    cancelled = true
  }
}

/**
 * Stream all conversations for a client
 */
export function streamConversations(
  client: Client,
  callback: (conversation: Conversation) => void
): () => void {
  let cancelled = false

  const stream = async () => {
    for await (const conversation of await client.conversations.stream()) {
      if (cancelled) break
      callback(conversation)
    }
  }

  stream().catch(console.error)

  return () => {
    cancelled = true
  }
}

/**
 * Format a message timestamp
 */
export function formatMessageTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // Less than a minute
  if (diff < 60000) {
    return 'just now'
  }

  // Less than an hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000)
    return `${mins}m ago`
  }

  // Less than a day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours}h ago`
  }

  // Format as date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
