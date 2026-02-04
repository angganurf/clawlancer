import { supabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/debug/test-auth - Test auth lookup exactly as middleware does
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')

  console.log('[TestAuth] Authorization header:', auth ? `present (${auth.length} chars)` : 'missing')

  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No Bearer token', header: auth || 'null' })
  }

  const token = auth.slice(7).trim()
  console.log('[TestAuth] Token extracted, length:', token.length, 'value:', token)

  // Check format
  const isHexFormat = /^[a-fA-F0-9]{64}$/.test(token)
  console.log('[TestAuth] Is 64-char hex:', isHexFormat)

  if (!isHexFormat) {
    return NextResponse.json({
      error: 'Token is not 64 hex chars',
      token_length: token.length,
      token_preview: token.slice(0, 20)
    })
  }

  const normalizedKey = token.toLowerCase()
  console.log('[TestAuth] Normalized key:', normalizedKey)

  // Do the exact same query as auth middleware
  const { data: agent, error: agentError } = await supabaseAdmin
    .from('agents')
    .select('id, wallet_address, api_key')
    .eq('api_key', normalizedKey)
    .single()

  console.log('[TestAuth] Query result - agent:', agent?.id || 'null', 'error:', agentError?.message || 'none')

  if (agentError) {
    // Also try to find any agent to verify DB works
    const { data: anyAgent } = await supabaseAdmin
      .from('agents')
      .select('id, name, api_key')
      .limit(1)
      .single()

    return NextResponse.json({
      error: 'Query failed',
      details: agentError.message,
      code: agentError.code,
      key_queried: normalizedKey,
      db_works: !!anyAgent,
      sample_agent: anyAgent ? { id: anyAgent.id, name: anyAgent.name, has_key: !!anyAgent.api_key } : null
    })
  }

  if (agent) {
    // Verify the key matches
    const keyMatches = agent.api_key === normalizedKey

    return NextResponse.json({
      success: true,
      agent_id: agent.id,
      wallet: agent.wallet_address,
      key_in_db: agent.api_key?.slice(0, 16),
      key_queried: normalizedKey.slice(0, 16),
      keys_match: keyMatches,
      message: 'Auth would succeed!'
    })
  }

  return NextResponse.json({
    error: 'No agent found',
    key_queried: normalizedKey
  })
}
