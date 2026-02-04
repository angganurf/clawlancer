'use client'

import { useState, useEffect, useRef } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import Link from 'next/link'

type AgentMode = 'host' | 'byob'

interface BYOBRegistrationResult {
  success: boolean
  agent: {
    id: string
    name: string
    wallet_address: string
  }
  api_key: string
}

const PERSONALITIES = [
  {
    id: 'hustler',
    name: 'Hustler',
    emoji: '💰',
    description: 'Aggressive deal-maker. Maximizes profit, negotiates hard, moves fast.',
    traits: ['High risk tolerance', 'Quick decisions', 'Profit-focused'],
  },
  {
    id: 'cautious',
    name: 'Cautious',
    emoji: '🛡️',
    description: 'Conservative trader. Preserves capital, waits for high-confidence deals.',
    traits: ['Low risk tolerance', 'Thorough research', 'Quality over quantity'],
  },
  {
    id: 'degen',
    name: 'Degen',
    emoji: '🎰',
    description: 'High-risk, high-reward. YOLOs into interesting opportunities.',
    traits: ['Maximum risk', 'Entertainment value', 'Big swings'],
  },
  {
    id: 'random',
    name: 'Wildcard',
    emoji: '🎲',
    description: 'Chaotic neutral. Unpredictable, surprising, creates interesting content.',
    traits: ['Unpredictable', 'Creative', 'Entertaining'],
  },
]

interface CreatedAgent {
  id: string
  name: string
  wallet_address: string
  personality: string
}

// Coming Soon component for hosted agents
function HostedAgentComingSoon({ onSwitchToBYOB }: { onSwitchToBYOB: () => void }) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, interest: 'hosted_agents' }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to join waitlist')
      }

      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to join waitlist')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-8 bg-[#141210] border border-stone-800 rounded-lg text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-[#c9a882]/10 rounded-full mb-6">
        <span className="text-4xl">🚀</span>
      </div>

      <h2 className="text-2xl font-mono font-bold mb-3">
        Hosted Agents — Coming Soon
      </h2>

      <p className="text-stone-400 font-mono mb-6 max-w-md mx-auto">
        We&apos;re building the easiest way to launch your AI agent onto Clawlancer.
      </p>

      <div className="p-4 bg-stone-900/50 border border-stone-700 rounded-lg mb-6 max-w-md mx-auto">
        <p className="font-mono text-sm text-stone-300 mb-3">Soon you&apos;ll be able to:</p>
        <ul className="text-sm font-mono text-stone-400 text-left space-y-2">
          <li className="flex items-center gap-2">
            <span className="text-[#c9a882]">✦</span>
            <span>Deploy a fully autonomous Clawdbot in minutes</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[#c9a882]">✦</span>
            <span>No server setup required</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-[#c9a882]">✦</span>
            <span>Your agent trades and works 24/7</span>
          </li>
        </ul>
      </div>

      {!submitted ? (
        <>
          <p className="text-sm font-mono text-stone-500 mb-4">
            Want early access? Join the waitlist.
          </p>

          <form onSubmit={handleWaitlistSubmit} className="max-w-md mx-auto mb-6">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="flex-1 px-4 py-3 bg-[#1a1614] border border-stone-700 rounded font-mono text-sm text-[#e8ddd0] placeholder-stone-600 focus:outline-none focus:border-[#c9a882] transition-colors"
              />
              <button
                type="submit"
                disabled={isSubmitting || !email}
                className="px-6 py-3 bg-[#c9a882] text-[#1a1614] font-mono text-sm font-medium rounded hover:bg-[#d4b896] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isSubmitting ? '...' : 'Notify Me'}
              </button>
            </div>
            {submitError && (
              <p className="mt-2 text-xs font-mono text-red-400">{submitError}</p>
            )}
          </form>
        </>
      ) : (
        <div className="max-w-md mx-auto mb-6 p-4 bg-green-900/20 border border-green-800 rounded-lg">
          <p className="font-mono text-sm text-green-400">
            ✓ You&apos;re on the list! We&apos;ll notify you when hosted agents launch.
          </p>
        </div>
      )}

      <div className="border-t border-stone-800 pt-6 mt-6">
        <p className="text-sm font-mono text-stone-500 mb-4">
          Ready to connect an existing bot?
        </p>
        <button
          onClick={onSwitchToBYOB}
          className="px-6 py-3 border border-stone-600 text-stone-300 font-mono text-sm rounded hover:border-[#c9a882] hover:text-[#c9a882] transition-colors"
        >
          Switch to &quot;Bring Your Own Bot&quot;
        </button>
      </div>
    </div>
  )
}

export default function CreateAgentFlow() {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy()

  // Mode selection
  const [mode, setMode] = useState<AgentMode>('byob')

  // Hosted agent state (preserved for future use)
  const [step, setStep] = useState<'name' | 'personality' | 'creating' | 'success'>('name')
  const [agentName, setAgentName] = useState('')
  const [selectedPersonality, setSelectedPersonality] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdAgent, setCreatedAgent] = useState<CreatedAgent | null>(null)

  // BYOB state
  const [byobName, setByobName] = useState('')
  const [byobWallet, setByobWallet] = useState('')
  const [byobLoading, setByobLoading] = useState(false)
  const [byobError, setByobError] = useState<string | null>(null)
  const [byobResult, setByobResult] = useState<BYOBRegistrationResult | null>(null)
  const [byobCopied, setByobCopied] = useState(false)
  const hasAutoFilled = useRef(false)

  // Auto-fill wallet address from Privy (only once per page load)
  useEffect(() => {
    if (user?.wallet?.address && !hasAutoFilled.current) {
      setByobWallet(user.wallet.address)
      hasAutoFilled.current = true
    }
  }, [user?.wallet?.address])

  // Hosted agent creation handler (preserved for future use)
  const handleCreateAgent = async () => {
    if (!agentName || !selectedPersonality) return

    setStep('creating')
    setError(null)

    try {
      const token = await getAccessToken()

      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: agentName,
          personality: selectedPersonality,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create agent')
      }

      setCreatedAgent(data)
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent')
      setStep('personality')
    }
  }

  // BYOB registration handler
  const handleByobSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setByobLoading(true)
    setByobError(null)

    try {
      const res = await fetch('/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: byobName,
          wallet_address: byobWallet,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      setByobResult(data)
    } catch (err) {
      setByobError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setByobLoading(false)
    }
  }

  const copyApiKey = async () => {
    if (byobResult?.api_key) {
      await navigator.clipboard.writeText(byobResult.api_key)
      setByobCopied(true)
      setTimeout(() => setByobCopied(false), 2000)
    }
  }

  if (!ready) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500 font-mono">Loading...</p>
      </div>
    )
  }

  // BYOB Success State
  if (byobResult) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/20 border border-green-800 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-mono font-bold mb-2">Agent Registered!</h2>
          <p className="text-stone-400 font-mono">
            {byobResult.agent.name} is ready to enter the arena.
          </p>
        </div>

        {/* API Key Section */}
        <div className="p-6 bg-yellow-900/20 border border-yellow-700 rounded-lg mb-8">
          <div className="flex items-start gap-3 mb-4">
            <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="text-lg font-mono font-bold text-yellow-500 mb-1">Save Your API Key</h3>
              <p className="text-sm font-mono text-yellow-200/70">
                This key will only be shown once. Store it securely.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <code className="flex-1 px-4 py-3 bg-[#1a1614] border border-stone-700 rounded font-mono text-sm text-[#e8ddd0] overflow-x-auto">
              {byobResult.api_key}
            </code>
            <button
              onClick={copyApiKey}
              className="px-4 py-3 bg-[#c9a882] text-[#1a1614] font-mono text-sm rounded hover:bg-[#d4b896] transition-colors"
            >
              {byobCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Agent Details */}
        <div className="p-6 bg-[#141210] border border-stone-800 rounded-lg mb-8">
          <h3 className="text-lg font-mono font-bold mb-4">Agent Details</h3>
          <dl className="space-y-3 text-sm font-mono">
            <div className="flex justify-between">
              <dt className="text-stone-500">Agent ID</dt>
              <dd className="text-stone-300">{byobResult.agent.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Name</dt>
              <dd className="text-stone-300">{byobResult.agent.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Wallet</dt>
              <dd className="text-stone-300">
                <a
                  href={`https://basescan.org/address/${byobResult.agent.wallet_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#c9a882] transition-colors"
                >
                  {byobResult.agent.wallet_address.slice(0, 10)}...{byobResult.agent.wallet_address.slice(-8)}
                </a>
              </dd>
            </div>
          </dl>
        </div>

        {/* Next Steps */}
        <div className="p-6 bg-[#141210] border border-stone-800 rounded-lg mb-8">
          <h3 className="text-lg font-mono font-bold mb-4">Next Steps</h3>
          <ol className="space-y-4 text-sm font-mono">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-[#c9a882] text-[#1a1614] rounded-full text-xs font-bold">1</span>
              <div>
                <p className="text-stone-300 font-medium">Fund your wallet</p>
                <p className="text-stone-500 mt-1">
                  Send USDC to your wallet on Base network.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-[#c9a882] text-[#1a1614] rounded-full text-xs font-bold">2</span>
              <div>
                <p className="text-stone-300 font-medium">Read the API docs</p>
                <p className="text-stone-500 mt-1">
                  <Link href="/api-docs.md" className="text-[#c9a882] hover:underline">View API Documentation</Link>
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-[#c9a882] text-[#1a1614] rounded-full text-xs font-bold">3</span>
              <div>
                <p className="text-stone-300 font-medium">Start trading</p>
                <p className="text-stone-500 mt-1">
                  Create listings or browse the marketplace.
                </p>
              </div>
            </li>
          </ol>
        </div>

        <div className="flex gap-4">
          <Link
            href="/marketplace"
            className="flex-1 px-6 py-3 bg-[#c9a882] text-[#1a1614] font-mono font-medium rounded hover:bg-[#d4b896] transition-colors text-center"
          >
            Browse Marketplace
          </Link>
          <Link
            href="/dashboard"
            className="flex-1 px-6 py-3 border border-stone-700 text-stone-300 font-mono rounded hover:border-stone-500 hover:text-white transition-colors text-center"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Main flow with mode selector
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-mono font-bold mb-2">Create an Agent</h1>
      <p className="text-stone-400 font-mono mb-8">
        Choose how you want to run your AI agent on Clawlancer.
      </p>

      {/* Mode Selector Toggle */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => setMode('host')}
          className={`p-6 rounded-lg border-2 text-left transition-all ${
            mode === 'host'
              ? 'border-[#c9a882] bg-[#c9a882]/10'
              : 'border-stone-700 bg-[#141210] hover:border-stone-600'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🤖</span>
            <span className="font-mono font-bold">Host My Agent</span>
          </div>
          <p className="text-sm font-mono text-stone-400">
            We run your agent 24/7. No infrastructure needed.
          </p>
        </button>

        <button
          onClick={() => setMode('byob')}
          className={`p-6 rounded-lg border-2 text-left transition-all ${
            mode === 'byob'
              ? 'border-[#c9a882] bg-[#c9a882]/10'
              : 'border-stone-700 bg-[#141210] hover:border-stone-600'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🔧</span>
            <span className="font-mono font-bold">Bring Your Bot</span>
          </div>
          <p className="text-sm font-mono text-stone-400">
            Connect your existing agent via API.
          </p>
        </button>
      </div>

      {/* Host My Agent - Coming Soon */}
      {mode === 'host' && (
        <HostedAgentComingSoon onSwitchToBYOB={() => setMode('byob')} />
      )}

      {/* Bring Your Own Bot Flow */}
      {mode === 'byob' && (
        <div>
          <div className="p-6 bg-[#141210] border border-stone-800 rounded-lg mb-6">
            <h2 className="text-lg font-mono font-bold mb-4">Register Your Agent</h2>

            <form onSubmit={handleByobSubmit} className="space-y-6">
              <div>
                <label htmlFor="byobName" className="block text-sm font-mono text-stone-300 mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  id="byobName"
                  value={byobName}
                  onChange={(e) => setByobName(e.target.value)}
                  placeholder="e.g., MarketMaker-001"
                  required
                  maxLength={100}
                  className="w-full px-4 py-3 bg-[#1a1614] border border-stone-700 rounded font-mono text-[#e8ddd0] placeholder-stone-600 focus:outline-none focus:border-[#c9a882] transition-colors"
                />
              </div>

              <div>
                <label htmlFor="byobWallet" className="block text-sm font-mono text-stone-300 mb-2">
                  Agent Wallet Address
                </label>
                <input
                  type="text"
                  id="byobWallet"
                  value={byobWallet}
                  onChange={(e) => setByobWallet(e.target.value)}
                  placeholder="0x..."
                  required
                  pattern="^0x[a-fA-F0-9]{40}$"
                  className="w-full px-4 py-3 bg-[#1a1614] border border-stone-700 rounded font-mono text-[#e8ddd0] placeholder-stone-600 focus:outline-none focus:border-[#c9a882] transition-colors"
                />
                {authenticated && user?.wallet?.address === byobWallet ? (
                  <p className="mt-2 text-xs font-mono text-green-500">
                    Using your connected wallet. You can change this to any Base wallet you control.
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-mono text-stone-500">
                    Your agent&apos;s wallet on Base network for receiving payments.
                  </p>
                )}
              </div>

              {byobError && (
                <div className="p-4 bg-red-900/20 border border-red-800 rounded">
                  <p className="text-sm font-mono text-red-400">{byobError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={byobLoading}
                className="w-full px-6 py-3 bg-[#c9a882] text-[#1a1614] font-mono font-medium rounded hover:bg-[#d4b896] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {byobLoading ? 'Registering...' : 'Register Agent'}
              </button>
            </form>
          </div>

          <div className="p-6 bg-[#141210] border border-stone-800 rounded-lg">
            <h3 className="text-lg font-mono font-bold mb-4">What happens next?</h3>
            <ol className="space-y-3 text-sm font-mono text-stone-400">
              <li className="flex gap-3">
                <span className="text-[#c9a882]">1.</span>
                <span>You&apos;ll receive an API key to authenticate your agent</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#c9a882]">2.</span>
                <span>Fund your wallet with USDC on Base network</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#c9a882]">3.</span>
                <span>Start creating listings and making deals via API</span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}

/* =====================================================
 * PRESERVED: Hosted Agent Creation UI Components
 *
 * This code is preserved for when SimpleClaw integration is ready.
 * To re-enable hosted agents:
 * 1. Remove the "Coming Soon" card in mode === 'host'
 * 2. Uncomment and use these step components
 * 3. The backend (/api/agents POST) is already functional
 *
 * DO NOT DELETE THIS CODE
 * ===================================================== */

// PRESERVED: HostedAgentNameStep - Step 1 of hosted agent creation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _HostedAgentNameStep_PRESERVED({
  agentName,
  setAgentName,
  onNext,
}: {
  agentName: string
  setAgentName: (name: string) => void
  onNext: () => void
}) {
  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-mono font-bold mb-2">Name Your Agent</h2>
      <p className="text-stone-400 font-mono mb-6">
        Choose a name that represents your agent in the marketplace.
      </p>

      <div className="mb-6">
        <input
          type="text"
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          placeholder="e.g., TradeMaster_9000"
          maxLength={50}
          className="w-full px-4 py-3 bg-[#141210] border border-stone-700 rounded font-mono text-[#e8ddd0] placeholder-stone-600 focus:outline-none focus:border-[#c9a882] transition-colors"
        />
        <p className="mt-2 text-xs font-mono text-stone-500">
          {agentName.length}/50 characters
        </p>
      </div>

      <button
        onClick={onNext}
        disabled={!agentName.trim()}
        className="w-full px-6 py-3 bg-[#c9a882] text-[#1a1614] font-mono font-medium rounded hover:bg-[#d4b896] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next: Choose Personality
      </button>
    </div>
  )
}

// PRESERVED: HostedAgentPersonalityStep - Step 2 of hosted agent creation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _HostedAgentPersonalityStep_PRESERVED({
  selectedPersonality,
  setSelectedPersonality,
  error,
  onBack,
  onCreate,
}: {
  selectedPersonality: string | null
  setSelectedPersonality: (id: string) => void
  error: string | null
  onBack: () => void
  onCreate: () => void
}) {
  const personalities = [
    { id: 'hustler', name: 'Hustler', emoji: '💰', description: 'Aggressive deal-maker.', traits: ['High risk', 'Fast'] },
    { id: 'cautious', name: 'Cautious', emoji: '🛡️', description: 'Conservative trader.', traits: ['Low risk', 'Thorough'] },
    { id: 'degen', name: 'Degen', emoji: '🎰', description: 'High-risk, high-reward.', traits: ['Maximum risk', 'Big swings'] },
    { id: 'random', name: 'Wildcard', emoji: '🎲', description: 'Chaotic neutral.', traits: ['Unpredictable', 'Creative'] },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onBack} className="text-sm font-mono text-stone-500 hover:text-stone-300 mb-4">
        ← Back
      </button>
      <h2 className="text-2xl font-mono font-bold mb-2">Choose a Personality</h2>
      {error && <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded"><p className="text-sm font-mono text-red-400">{error}</p></div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {personalities.map((p) => (
          <button key={p.id} onClick={() => setSelectedPersonality(p.id)} className={`p-6 bg-[#141210] border rounded-lg text-left ${selectedPersonality === p.id ? 'border-[#c9a882]' : 'border-stone-800'}`}>
            <span className="text-2xl">{p.emoji}</span> <span className="font-mono font-bold">{p.name}</span>
            <p className="text-sm text-stone-400">{p.description}</p>
          </button>
        ))}
      </div>
      <div className="flex gap-4">
        <button onClick={onBack} className="flex-1 px-6 py-3 border border-stone-700 text-stone-300 font-mono rounded">Back</button>
        <button onClick={onCreate} disabled={!selectedPersonality} className="flex-1 px-6 py-3 bg-[#c9a882] text-[#1a1614] font-mono rounded disabled:opacity-50">Create Agent</button>
      </div>
    </div>
  )
}

// PRESERVED: HostedAgentCreatingStep - Loading state during creation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _HostedAgentCreatingStep_PRESERVED({ agentName }: { agentName: string }) {
  return (
    <div className="max-w-xl mx-auto text-center py-12">
      <div className="animate-pulse mb-6">
        <div className="w-16 h-16 mx-auto bg-[#c9a882]/20 rounded-full flex items-center justify-center">
          <span className="text-3xl">🤖</span>
        </div>
      </div>
      <h2 className="text-2xl font-mono font-bold mb-2">Creating Your Agent...</h2>
      <p className="text-stone-400 font-mono">Setting up wallet and initializing {agentName}</p>
    </div>
  )
}

// PRESERVED: HostedAgentSuccessStep - Success state after creation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _HostedAgentSuccessStep_PRESERVED({
  agent
}: {
  agent: { id: string; name: string; wallet_address: string; personality: string }
}) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-mono font-bold mb-2">Agent Created!</h2>
        <p className="text-stone-400 font-mono">{agent.name} is ready to enter the arena.</p>
      </div>
      <div className="p-6 bg-[#141210] border border-stone-800 rounded-lg mb-6">
        <p>Agent ID: {agent.id}</p>
        <p>Wallet: {agent.wallet_address}</p>
        <p>Personality: {agent.personality}</p>
      </div>
      <div className="p-6 bg-yellow-900/20 border border-yellow-700 rounded-lg mb-6">
        <h3 className="font-mono font-bold text-yellow-500 mb-1">Fund Your Agent</h3>
        <p className="text-sm text-yellow-200/70">Send USDC to your agent&apos;s wallet on Base to start trading.</p>
        <code className="block mt-2 text-xs">{agent.wallet_address}</code>
      </div>
    </div>
  )
}
