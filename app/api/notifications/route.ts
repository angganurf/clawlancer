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
    let userWallet: string | null = null

    if (auth.type === 'user') {
      userWallet = auth.wallet.toLowerCase()
      const { data: agents } = await supabaseAdmin
        .from('agents')
        .select('id')
        .eq('owner_address', userWallet)

      agentIds = agents?.map((a: { id: string }) => a.id) || []
    } else if (auth.type === 'agent') {
      agentIds = [auth.agentId]
    }

    // Build query for both agent notifications and user wallet notifications
    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (agentIds.length > 0 && userWallet) {
      // User has agents - get notifications for both agents AND user wallet
      query = query.or(`agent_id.in.(${agentIds.join(',')}),user_wallet.eq.${userWallet}`)
    } else if (agentIds.length > 0) {
      // Agent auth or user with agents only
      query = query.in('agent_id', agentIds)
    } else if (userWallet) {
      // User with no agents - only user wallet notifications
      query = query.eq('user_wallet', userWallet)
    } else {
      return NextResponse.json({ notifications: [], unread_count: 0 })
    }

    if (unreadOnly) {
      query = query.eq('read', false)
    }

    const { data: notifications, error } = await query

    if (error) {
      console.error('Failed to fetch notifications:', error)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    // Get unread count
    let countQuery = supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)

    if (agentIds.length > 0 && userWallet) {
      countQuery = countQuery.or(`agent_id.in.(${agentIds.join(',')}),user_wallet.eq.${userWallet}`)
    } else if (agentIds.length > 0) {
      countQuery = countQuery.in('agent_id', agentIds)
    } else if (userWallet) {
      countQuery = countQuery.eq('user_wallet', userWallet)
    }

    const { count } = await countQuery

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

    // Get user's agent IDs and wallet for authorization
    let agentIds: string[] = []
    let userWallet: string | null = null

    if (auth.type === 'user') {
      userWallet = auth.wallet.toLowerCase()
      const { data: agents } = await supabaseAdmin
        .from('agents')
        .select('id')
        .eq('owner_address', userWallet)

      agentIds = agents?.map((a: { id: string }) => a.id) || []
    } else if (auth.type === 'agent') {
      agentIds = [auth.agentId]
    }

    if (mark_all_read) {
      // Mark all unread notifications as read
      let updateQuery = supabaseAdmin
        .from('notifications')
        .update({ read: true })
        .eq('read', false)

      if (agentIds.length > 0 && userWallet) {
        updateQuery = updateQuery.or(`agent_id.in.(${agentIds.join(',')}),user_wallet.eq.${userWallet}`)
      } else if (agentIds.length > 0) {
        updateQuery = updateQuery.in('agent_id', agentIds)
      } else if (userWallet) {
        updateQuery = updateQuery.eq('user_wallet', userWallet)
      } else {
        return NextResponse.json({ error: 'No agents or wallet found' }, { status: 404 })
      }

      const { error } = await updateQuery

      if (error) {
        return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'All notifications marked as read' })
    }

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return NextResponse.json({ error: 'notification_ids array required' }, { status: 400 })
    }

    // Mark specific notifications as read (only if owned by user's agents or wallet)
    let updateQuery = supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .in('id', notification_ids)

    if (agentIds.length > 0 && userWallet) {
      updateQuery = updateQuery.or(`agent_id.in.(${agentIds.join(',')}),user_wallet.eq.${userWallet}`)
    } else if (agentIds.length > 0) {
      updateQuery = updateQuery.in('agent_id', agentIds)
    } else if (userWallet) {
      updateQuery = updateQuery.eq('user_wallet', userWallet)
    } else {
      return NextResponse.json({ error: 'No agents or wallet found' }, { status: 404 })
    }

    const { error } = await updateQuery

    if (error) {
      return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update notifications error:', error)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
}
