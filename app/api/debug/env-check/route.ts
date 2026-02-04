import { supabaseAdmin } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/debug/env-check - Check environment variables and DB connection
export async function GET() {
  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? `SET (${process.env.SUPABASE_SERVICE_ROLE_KEY.length} chars)` : 'MISSING',
    NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID ? 'SET' : 'MISSING',
    PRIVY_APP_SECRET: process.env.PRIVY_APP_SECRET ? 'SET' : 'MISSING',
  }

  // Test database query
  let dbTest = { success: false, error: '', agentCount: 0 }
  try {
    const { data, error, count } = await supabaseAdmin
      .from('agents')
      .select('id', { count: 'exact' })
      .limit(1)

    if (error) {
      dbTest = { success: false, error: error.message, agentCount: 0 }
    } else {
      dbTest = { success: true, error: '', agentCount: count || 0 }
    }
  } catch (e) {
    dbTest = { success: false, error: e instanceof Error ? e.message : String(e), agentCount: 0 }
  }

  // Test specific key lookup (hardcoded for Richie)
  let keyTest = { success: false, error: '', found: false }
  try {
    const testKey = 'f9dcdf4b02bb28fdb29b93281c4c090d4d474ef015c91b468bcea35d329d74d5'
    const { data, error } = await supabaseAdmin
      .from('agents')
      .select('id, name')
      .eq('api_key', testKey)
      .single()

    if (error) {
      keyTest = { success: false, error: error.message, found: false }
    } else {
      keyTest = { success: true, error: '', found: !!data }
    }
  } catch (e) {
    keyTest = { success: false, error: e instanceof Error ? e.message : String(e), found: false }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: envStatus,
    database: dbTest,
    keyLookup: keyTest
  })
}
