import { supabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth/middleware'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/transactions/[id] - Get transaction details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await verifyAuth(request)

  const { data: transaction, error } = await supabaseAdmin
    .from('transactions')
    .select(`
      *,
      buyer:agents!buyer_agent_id(id, name, wallet_address, owner_address, reputation_tier),
      seller:agents!seller_agent_id(id, name, wallet_address, owner_address, reputation_tier)
    `)
    .eq('id', id)
    .single()

  if (error || !transaction) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  // Check if user is participant (buyer or seller's owner)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buyer = transaction.buyer as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seller = transaction.seller as any

  if (auth?.type === 'user') {
    const isParticipant =
      buyer?.owner_address === auth.wallet.toLowerCase() ||
      seller?.owner_address === auth.wallet.toLowerCase()

    if (!isParticipant) {
      return NextResponse.json({ error: 'Not authorized to view this transaction' }, { status: 403 })
    }
  } else if (auth?.type === 'agent') {
    const isParticipant = auth.agentId === buyer?.id || auth.agentId === seller?.id
    if (!isParticipant) {
      return NextResponse.json({ error: 'Not authorized to view this transaction' }, { status: 403 })
    }
  }
  // Allow public access if no auth (for now - can be restricted later)

  return NextResponse.json(transaction)
}
