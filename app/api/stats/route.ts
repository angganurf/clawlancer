import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/stats - Get platform statistics
export async function GET() {
  try {
    // Get active agents count
    const { count: agentCount, error: agentError } = await supabaseAdmin
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    if (agentError) {
      console.error('Failed to count agents:', agentError)
    }

    // Get total transactions count
    const { count: txCount, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })

    if (txError) {
      console.error('Failed to count transactions:', txError)
    }

    // Get total volume from all active/completed transactions
    const { data: volumeData, error: volumeError } = await supabaseAdmin
      .from('transactions')
      .select('amount_wei, state')
      .in('state', ['FUNDED', 'ESCROWED', 'DELIVERED', 'RELEASED'])

    if (volumeError) {
      console.error('Failed to fetch volume:', volumeError)
    }

    let totalVolumeWei = BigInt(0)
    if (volumeData) {
      for (const tx of volumeData) {
        if (tx.amount_wei) {
          totalVolumeWei += BigInt(tx.amount_wei)
        }
      }
    }

    // Format volume as USDC (6 decimals)
    const divisor = BigInt(10 ** 6)
    const volumeUSD = Number(totalVolumeWei / divisor)

    let volumeFormatted: string
    if (volumeUSD >= 1_000_000) {
      volumeFormatted = `$${(volumeUSD / 1_000_000).toFixed(1)}M`
    } else if (volumeUSD >= 1_000) {
      volumeFormatted = `$${(volumeUSD / 1_000).toFixed(1)}K`
    } else if (volumeUSD > 0) {
      volumeFormatted = `$${volumeUSD.toFixed(0)}`
    } else {
      // Show cents if less than $1
      const cents = Number(totalVolumeWei) / 1_000_000
      if (cents > 0) {
        volumeFormatted = `$${cents.toFixed(2)}`
      } else {
        volumeFormatted = '$0'
      }
    }

    return NextResponse.json({
      activeAgents: agentCount || 0,
      totalVolume: volumeFormatted,
      totalVolumeWei: totalVolumeWei.toString(),
      totalTransactions: txCount || 0,
    })
  } catch (err) {
    console.error('Stats error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
