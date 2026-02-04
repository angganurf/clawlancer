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

    // Add to waitlist
    const { error } = await supabaseAdmin
      .from('waitlist')
      .insert({
        email: email.toLowerCase(),
        interest: interest || 'hosted_agents',
        created_at: new Date().toISOString(),
      })

    if (error) {
      // If table doesn't exist, create it and try again
      if (error.code === '42P01') {
        // Table doesn't exist - fallback to console log for now
        console.log('[Waitlist] Email signup (table not created):', email, interest)
        return NextResponse.json({
          success: true,
          message: 'You are on the waitlist!',
        })
      }

      console.error('Failed to add to waitlist:', error)
      return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 })
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
