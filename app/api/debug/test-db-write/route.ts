import { supabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Debug endpoint to test database writes
// POST /api/debug/test-db-write
export async function POST(request: NextRequest) {
  try {
    // Check environment variables first
    const envCheck = {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      serviceRoleKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      supabaseUrlPreview: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) || 'NOT SET'
    }
    console.log('[Debug] Environment check:', envCheck)

    const body = await request.json()
    const { wallet_address } = body

    if (!wallet_address) {
      return NextResponse.json({ error: 'wallet_address required', env: envCheck }, { status: 400 })
    }

    const normalizedAddress = wallet_address.toLowerCase()
    const testKey = crypto.randomBytes(32).toString('hex')

    console.log('[Debug] Starting DB write test for wallet:', normalizedAddress)
    console.log('[Debug] Test key to write:', testKey.slice(0, 16) + '...')

    // Step 1: Find the agent
    const { data: agent, error: findError } = await supabaseAdmin
      .from('agents')
      .select('id, name, wallet_address, api_key')
      .eq('wallet_address', normalizedAddress)
      .single()

    if (findError) {
      console.log('[Debug] Find error:', findError)
      return NextResponse.json({
        step: 'find',
        error: findError.message,
        code: findError.code
      }, { status: 404 })
    }

    console.log('[Debug] Found agent:', agent.id, 'current key:', agent.api_key?.slice(0, 16) || 'NULL')

    // Step 2: Update the api_key
    const { data: updateResult, error: updateError } = await supabaseAdmin
      .from('agents')
      .update({ api_key: testKey })
      .eq('id', agent.id)
      .select('id, api_key')
      .single()

    if (updateError) {
      console.log('[Debug] Update error:', updateError)
      return NextResponse.json({
        step: 'update',
        error: updateError.message,
        code: updateError.code,
        agent_id: agent.id
      }, { status: 500 })
    }

    console.log('[Debug] Update returned:', updateResult?.api_key?.slice(0, 16) || 'NULL')

    // Step 3: Verify by re-querying
    const { data: verifyAgent, error: verifyError } = await supabaseAdmin
      .from('agents')
      .select('id, api_key')
      .eq('id', agent.id)
      .single()

    if (verifyError) {
      console.log('[Debug] Verify error:', verifyError)
      return NextResponse.json({
        step: 'verify',
        error: verifyError.message,
        code: verifyError.code
      }, { status: 500 })
    }

    console.log('[Debug] Verify query returned:', verifyAgent?.api_key?.slice(0, 16) || 'NULL')

    // Step 4: Test auth lookup with the new key
    const { data: authLookup, error: authError } = await supabaseAdmin
      .from('agents')
      .select('id, wallet_address')
      .eq('api_key', testKey)
      .single()

    console.log('[Debug] Auth lookup result:', authLookup?.id || 'NOT FOUND', authError?.message || 'no error')

    return NextResponse.json({
      success: true,
      agent_id: agent.id,
      test_key: testKey,
      test_key_preview: testKey.slice(0, 16),
      env: envCheck,
      steps: {
        find: { found: true, had_key: !!agent.api_key, previous_key_preview: agent.api_key?.slice(0, 16) || 'NULL' },
        update: {
          returned_key_matches: updateResult?.api_key === testKey,
          returned_key_preview: updateResult?.api_key?.slice(0, 16) || 'NULL'
        },
        verify: {
          key_matches: verifyAgent?.api_key === testKey,
          key_preview: verifyAgent?.api_key?.slice(0, 16) || 'NULL'
        },
        auth_lookup: {
          found: !!authLookup,
          agent_id: authLookup?.id || null
        }
      },
      message: 'Use this test_key to authenticate. If auth fails, the issue is in the auth middleware, not the DB write.'
    })
  } catch (error) {
    console.error('[Debug] Unexpected error:', error)
    return NextResponse.json({
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// GET - Check current state without modifying
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')

  if (!wallet) {
    return NextResponse.json({ error: 'wallet query param required' }, { status: 400 })
  }

  const normalizedAddress = wallet.toLowerCase()

  const { data: agent, error } = await supabaseAdmin
    .from('agents')
    .select('id, name, wallet_address, api_key, is_hosted, is_active, created_at')
    .eq('wallet_address', normalizedAddress)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 404 })
  }

  return NextResponse.json({
    agent_id: agent.id,
    name: agent.name,
    wallet: agent.wallet_address,
    has_api_key: !!agent.api_key,
    api_key_preview: agent.api_key?.slice(0, 16) || 'NULL',
    api_key_full: agent.api_key, // TEMPORARY - for debugging only
    is_hosted: agent.is_hosted,
    is_active: agent.is_active,
    created_at: agent.created_at
  })
}
