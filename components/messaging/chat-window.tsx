'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useXMTP } from '@/hooks/useXMTP'
import type { Conversation, DecodedMessage } from '@xmtp/xmtp-js'

interface ChatWindowProps {
  peerAddress: string
  peerName?: string
  onClose?: () => void
}

export function ChatWindow({ peerAddress, peerName, onClose }: ChatWindowProps) {
  const { isInitialized, isLoading, error, initialize, getConversation, sendMessage, getMessages } = useXMTP()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<DecodedMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<(() => void) | null>(null)

  // Initialize XMTP if not already
  useEffect(() => {
    if (!isInitialized && !isLoading) {
      initialize()
    }
  }, [isInitialized, isLoading, initialize])

  // Load conversation when XMTP is ready
  useEffect(() => {
    if (!isInitialized || !peerAddress) return

    const loadConversation = async () => {
      setLoadingMessages(true)
      const convo = await getConversation(peerAddress)
      if (convo) {
        setConversation(convo)
        const msgs = await getMessages(convo, 100)
        setMessages(msgs.reverse())
      }
      setLoadingMessages(false)
    }

    loadConversation()
  }, [isInitialized, peerAddress, getConversation, getMessages])

  // Stream new messages
  useEffect(() => {
    if (!conversation) return

    const streamMessages = async () => {
      try {
        for await (const message of await conversation.streamMessages()) {
          setMessages(prev => [...prev, message])
        }
      } catch (err) {
        console.error('Message stream error:', err)
      }
    }

    streamMessages()

    return () => {
      // Cleanup will happen when component unmounts
    }
  }, [conversation])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!conversation || !inputValue.trim() || sending) return

    setSending(true)
    const content = inputValue.trim()
    setInputValue('')

    try {
      await sendMessage(conversation, content)
    } catch (err) {
      console.error('Send error:', err)
      setInputValue(content) // Restore on error
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  if (isLoading) {
    return (
      <div className="bg-[#141210] border border-stone-800 rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#c9a882] border-t-transparent"></div>
          <span className="ml-3 text-stone-400 font-mono text-sm">Initializing XMTP...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[#141210] border border-stone-800 rounded-lg p-6">
        <div className="text-center py-8">
          <p className="text-red-400 font-mono text-sm mb-4">{error}</p>
          <button
            onClick={initialize}
            className="px-4 py-2 bg-[#c9a882] text-[#1a1614] font-mono text-sm rounded hover:bg-[#d4b896] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#141210] border border-stone-800 rounded-lg flex flex-col h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800">
        <div>
          <p className="font-mono font-bold text-white">
            {peerName || truncateAddress(peerAddress)}
          </p>
          <p className="text-xs text-stone-500 font-mono">{truncateAddress(peerAddress)}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loadingMessages ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#c9a882] border-t-transparent"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-stone-500 font-mono text-sm">No messages yet</p>
            <p className="text-stone-600 font-mono text-xs mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSent = msg.senderAddress.toLowerCase() !== peerAddress.toLowerCase()
            return (
              <div
                key={msg.id}
                className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg ${
                    isSent
                      ? 'bg-[#c9a882] text-[#1a1614]'
                      : 'bg-stone-800 text-white'
                  }`}
                >
                  <p className="font-mono text-sm whitespace-pre-wrap break-words">
                    {msg.content as string}
                  </p>
                  <p className={`text-xs mt-1 ${isSent ? 'text-[#1a1614]/60' : 'text-stone-500'}`}>
                    {formatTime(msg.sent)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-stone-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={!conversation || sending}
            className="flex-1 px-3 py-2 bg-stone-900 border border-stone-700 rounded-lg font-mono text-sm text-white placeholder-stone-500 focus:outline-none focus:border-[#c9a882] disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!conversation || !inputValue.trim() || sending}
            className="px-4 py-2 bg-[#c9a882] text-[#1a1614] font-mono text-sm rounded-lg hover:bg-[#d4b896] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
