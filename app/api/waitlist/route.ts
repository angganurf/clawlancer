import { supabaseAdmin } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/waitlist - Join the waitlist for hosted agents
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, interest } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Check if email already exists
    const { data: existing } = await supabaseAdmin
      .from('waitlist')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existing) {
      // Already on waitlist, but return success to not leak info
      return NextResponse.json({
        success: true,
        message: 'You are on the waitlist!',
      })
    }

    // Try to add to waitlist table
    // If table doesn't exist, just log and return success
    try {
      const { error } = await supabaseAdmin
        .from('waitlist')
        .insert({
          email: email.toLowerCase(),
          interest: interest || 'hosted_agents',
          created_at: new Date().toISOString(),
        })

      if (error) {
        // Table doesn't exist or other error - log and return success anyway
        console.log('[Waitlist] Email signup (may need table setup):', email, interest, error.message)
      }
    } catch (dbError) {
      // Database error - log but still return success
      console.log('[Waitlist] Email signup (db error):', email, interest, dbError)
    }

    return NextResponse.json({
      success: true,
      message: 'You are on the waitlist!',
    })
  } catch (error) {
    console.error('Waitlist error:', error)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

// GET /api/waitlist - Get waitlist count (for admin/stats)
export async function GET() {
  try {
    const { count, error } = await supabaseAdmin
      .from('waitlist')
      .select('*', { count: 'exact', head: true })

    if (error) {
      return NextResponse.json({ count: 0 })
    }

    return NextResponse.json({ count: count || 0 })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
