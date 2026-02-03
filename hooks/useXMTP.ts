/**
 * XMTP React Hook
 *
 * Provides XMTP messaging functionality in React components.
 * Uses Privy wallet for signing.
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import type { Client, Conversation, DecodedMessage } from '@xmtp/xmtp-js'

// Environment config
const XMTP_ENV = process.env.NEXT_PUBLIC_CHAIN === 'sepolia' ? 'dev' : 'production'

export interface UseXMTPReturn {
  client: Client | null
  isLoading: boolean
  error: string | null
  isInitialized: boolean
  conversations: Conversation[]
  initialize: () => Promise<void>
  getConversation: (peerAddress: string) => Promise<Conversation | null>
  sendMessage: (conversation: Conversation, content: string) => Promise<DecodedMessage | null>
  getMessages: (conversation: Conversation, limit?: number) => Promise<DecodedMessage[]>
  canMessage: (peerAddress: string) => Promise<boolean>
}

export function useXMTP(): UseXMTPReturn {
  const { ready, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const [client, setClient] = useState<Client | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const initializingRef = useRef(false)

  const initialize = useCallback(async () => {
    if (!ready || !authenticated || initializingRef.current || client) return

    const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')
    if (!embeddedWallet) {
      setError('No wallet available')
      return
    }

    initializingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      // Dynamic import to avoid SSR issues
      const { Client } = await import('@xmtp/xmtp-js')

      // Get ethereum provider from Privy wallet
      const provider = await embeddedWallet.getEthereumProvider()

      // Create a signer compatible with XMTP
      const signer = {
        getAddress: async () => embeddedWallet.address,
        signMessage: async (message: string) => {
          // Use the provider to sign
          const signature = await provider.request({
            method: 'personal_sign',
            params: [message, embeddedWallet.address],
          })
          return signature as string
        },
      }

      // Create XMTP client
      const xmtpClient = await Client.create(signer, { env: XMTP_ENV })
      setClient(xmtpClient)

      // Load existing conversations
      const convos = await xmtpClient.conversations.list()
      setConversations(convos)

      setIsInitialized(true)
    } catch (err) {
      console.error('XMTP initialization error:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize XMTP')
    } finally {
      setIsLoading(false)
      initializingRef.current = false
    }
  }, [ready, authenticated, wallets, client])

  const getConversation = useCallback(async (peerAddress: string): Promise<Conversation | null> => {
    if (!client) {
      setError('XMTP not initialized')
      return null
    }

    try {
      // Check if we can message this address
      const canMsg = await client.canMessage(peerAddress)
      if (!canMsg) {
        setError('This address cannot receive XMTP messages')
        return null
      }

      // Find existing or create new
      const existing = conversations.find(
        c => c.peerAddress.toLowerCase() === peerAddress.toLowerCase()
      )
      if (existing) return existing

      const newConvo = await client.conversations.newConversation(peerAddress)
      setConversations(prev => [...prev, newConvo])
      return newConvo
    } catch (err) {
      console.error('Get conversation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to get conversation')
      return null
    }
  }, [client, conversations])

  const sendMessage = useCallback(async (
    conversation: Conversation,
    content: string
  ): Promise<DecodedMessage | null> => {
    if (!client) {
      setError('XMTP not initialized')
      return null
    }

    try {
      return await conversation.send(content)
    } catch (err) {
      console.error('Send message error:', err)
      setError(err instanceof Error ? err.message : 'Failed to send message')
      return null
    }
  }, [client])

  const getMessages = useCallback(async (
    conversation: Conversation,
    limit: number = 50
  ): Promise<DecodedMessage[]> => {
    try {
      return await conversation.messages({ limit })
    } catch (err) {
      console.error('Get messages error:', err)
      return []
    }
  }, [])

  const canMessage = useCallback(async (peerAddress: string): Promise<boolean> => {
    if (!client) return false
    try {
      return await client.canMessage(peerAddress)
    } catch {
      return false
    }
  }, [client])

  // Auto-initialize when wallet is ready
  useEffect(() => {
    if (ready && authenticated && wallets.length > 0 && !client && !initializingRef.current) {
      // Small delay to ensure wallet is fully loaded
      const timer = setTimeout(() => {
        initialize()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [ready, authenticated, wallets, client, initialize])

  return {
    client,
    isLoading,
    error,
    isInitialized,
    conversations,
    initialize,
    getConversation,
    sendMessage,
    getMessages,
    canMessage,
  }
}
