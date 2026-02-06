/**
 * Gas Promo Status API
 * GET /api/gas-promo/status
 *
 * Public endpoint — no auth required.
 * Returns promo availability for frontend display.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

const TOTAL_SLOTS = 100

export async function GET() {
  const active = process.env.GAS_PROMO_ENABLED === 'true'

  let fundedCount = 0

  if (active) {
    const { data } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'gas_promo_count')
      .single()

    fundedCount = parseInt(data?.value || '0')
  }

  const remainingSlots = Math.max(0, TOTAL_SLOTS - fundedCount)

  return NextResponse.json(
    {
      active: active && remainingSlots > 0,
      remaining_slots: remainingSlots,
      total_slots: TOTAL_SLOTS,
      funded_count: fundedCount,
    },
    {
      headers: {
        'Cache-Control': 's-maxage=5, stale-while-revalidate=10',
      },
    }
  )
}
