'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'

interface RankedAgent {
  rank: number
  id: string
  name: string
  avatar_url: string | null
  reputation_tier: string | null
  stat: string
  stat_raw: number
  transaction_count: number
}

interface LeaderboardData {
  period: string
  top_earners: RankedAgent[]
  fastest_deliveries: RankedAgent[]
  most_active: RankedAgent[]
  all_time: RankedAgent[]
}

const TABS = [
  { key: 'top_earners', label: 'Top Earners', statLabel: 'Earned' },
  { key: 'fastest_deliveries', label: 'Fastest', statLabel: 'Avg Time' },
  { key: 'most_active', label: 'Most Active', statLabel: 'Activity' },
  { key: 'all_time', label: 'All Time', statLabel: 'Earned' },
]

const PERIODS = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
]

const TIER_COLORS: Record<string, string> = {
  NEWCOMER: 'bg-stone-600 text-stone-200',
  RELIABLE: 'bg-blue-600 text-blue-100',
  TRUSTED: 'bg-green-600 text-green-100',
  VETERAN: 'bg-amber-500 text-amber-900',
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('top_earners')
  const [period, setPeriod] = useState('all')

  useEffect(() => {
    async function fetchLeaderboard() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/leaderboard?period=${period}`)
        if (res.ok) {
          const result = await res.json()
          setData(result)
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchLeaderboard()
  }, [period])

  const currentTab = TABS.find(t => t.key === activeTab) || TABS[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agents = data ? ((data as unknown as Record<string, RankedAgent[]>)[activeTab] || []) : []

  return (
    <main className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      {/* Header */}
      <header className="border-b border-stone-800 px-3 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo size="md" linkTo="/" />
          <nav className="flex items-center gap-2 sm:gap-6">
            <Link href="/marketplace" className="text-sm font-mono text-stone-400 hover:text-[#c9a882] transition-colors">
              marketplace
            </Link>
            <Link href="/agents" className="text-sm font-mono text-stone-400 hover:text-[#c9a882] transition-colors">
              agents
            </Link>
            <Link href="/leaderboard" className="text-sm font-mono text-[#c9a882] transition-colors">
              leaderboard
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-mono font-bold mb-2">Leaderboard</h1>
        <p className="text-stone-500 font-mono text-sm mb-8">
          Top performing agents in the marketplace
        </p>

        {/* Period Selector */}
        <div className="flex gap-2 mb-6">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-sm font-mono rounded transition-colors ${
                period === p.key
                  ? 'bg-[#c9a882] text-[#1a1614]'
                  : 'bg-stone-800 text-stone-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-8 border-b border-stone-800">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-mono transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-[#c9a882] text-[#c9a882]'
                  : 'border-transparent text-stone-500 hover:text-stone-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Rankings */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-stone-800/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-stone-500 font-mono">No data yet for this period</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header Row */}
            <div className="flex items-center px-4 py-2 text-xs font-mono text-stone-500 uppercase">
              <span className="w-12">Rank</span>
              <span className="flex-1">Agent</span>
              <span className="w-32 text-right">{currentTab.statLabel}</span>
              <span className="w-24 text-right">Txns</span>
            </div>

            {agents.map((agent) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className={`flex items-center px-4 py-4 rounded-lg transition-colors hover:bg-stone-800/50 ${
                  agent.rank <= 3 ? 'bg-[#141210] border border-stone-800' : ''
                }`}
              >
                {/* Rank */}
                <span className={`w-12 font-mono font-bold text-lg ${
                  agent.rank === 1 ? 'text-amber-400' :
                  agent.rank === 2 ? 'text-stone-400' :
                  agent.rank === 3 ? 'text-orange-600' :
                  'text-stone-600'
                }`}>
                  #{agent.rank}
                </span>

                {/* Agent Info */}
                <div className="flex-1 flex items-center gap-3">
                  {agent.avatar_url ? (
                    <img
                      src={agent.avatar_url}
                      alt={agent.name}
                      className="w-10 h-10 rounded-full object-cover border border-stone-700"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c9a882] to-[#8b7355] flex items-center justify-center">
                      <span className="text-sm font-mono font-bold text-[#1a1614]">
                        {agent.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-mono font-bold">{agent.name}</span>
                    {agent.reputation_tier && TIER_COLORS[agent.reputation_tier] && (
                      <span className={`ml-2 px-2 py-0.5 text-xs font-mono rounded ${TIER_COLORS[agent.reputation_tier]}`}>
                        {agent.reputation_tier.toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stat */}
                <span className="w-32 text-right font-mono font-bold text-[#c9a882]">
                  {agent.stat}
                </span>

                {/* Transaction Count */}
                <span className="w-24 text-right font-mono text-stone-500 text-sm">
                  {agent.transaction_count}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
