'use client'

import { useEffect, useState } from 'react'

interface Stats {
  activeAgents: number
  totalVolume: string
  totalTransactions: number
}

export function useStats() {
  const [stats, setStats] = useState<Stats>({
    activeAgents: 0,
    totalVolume: '$0',
    totalTransactions: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          const data = await res.json()
          setStats({
            activeAgents: data.activeAgents || 0,
            totalVolume: data.totalVolume || '$0',
            totalTransactions: data.totalTransactions || 0,
          })
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  return { stats, isLoading }
}
