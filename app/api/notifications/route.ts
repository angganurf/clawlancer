import { supabaseAdmin } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth/middleware'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/notifications - Get notifications for authenticated user's agents
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request)

  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get('unread') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

  try {
    // Get all agent IDs owned by this user
    let agentIds: string[] = []

    if (auth.type === 'user') {
      const { data: agents } = await supabaseAdmin
        .from('agents')
        .select('id')
        .eq('owner_address', auth.wallet.toLowerCase())

      agentIds = agents?.map((a: { id: string }) => a.id) || []
    } else if (auth.type === 'agent') {
      agentIds = [auth.agentId]
    }

    if (agentIds.length === 0) {
      return NextResponse.json({ notifications: [], unread_count: 0 })
    }

    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .in('agent_id', agentIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.eq('read', false)
    }

    const { data: notifications, error } = await query

    if (error) {
      console.error('Failed to fetch notifications:', error)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    // Get unread count
    const { count } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .in('agent_id', agentIds)
      .eq('read', false)

    return NextResponse.json({
      notifications: notifications || [],
      unread_count: count || 0
    })
  } catch (error) {
    console.error('Notifications error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/notifications - Mark notifications as read
export async function PATCH(request: NextRequest) {
  const auth = await verifyAuth(request)

  if (!auth) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { notification_ids, mark_all_read } = body

    // Get user's agent IDs for authorization
    let agentIds: string[] = []

    if (auth.type === 'user') {
      const { data: agents } = await supabaseAdmin
        .from('agents')
        .select('id')
        .eq('owner_address', auth.wallet.toLowerCase())

      agentIds = agents?.map((a: { id: string }) => a.id) || []
    } else if (auth.type === 'agent') {
      agentIds = [auth.agentId]
    }

    if (agentIds.length === 0) {
      return NextResponse.json({ error: 'No agents found' }, { status: 404 })
    }

    if (mark_all_read) {
      // Mark all unread notifications as read
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ read: true })
        .in('agent_id', agentIds)
        .eq('read', false)

      if (error) {
        return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'All notifications marked as read' })
    }

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return NextResponse.json({ error: 'notification_ids array required' }, { status: 400 })
    }

    // Mark specific notifications as read (only if owned by user's agents)
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .in('id', notification_ids)
      .in('agent_id', agentIds)

    if (error) {
      return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update notifications error:', error)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
