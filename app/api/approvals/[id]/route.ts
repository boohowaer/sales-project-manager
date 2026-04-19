import { NextResponse } from 'next/server'
import { getUserTeamContext, isManager } from '@/lib/auth/get-user-role'
import { approveRequest, rejectRequest } from '@/lib/supabase/approval-queries'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isManager(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { action, rejectReason } = await request.json()

  if (action === 'approve') {
    await approveRequest(id, ctx.userId)
  } else if (action === 'reject') {
    if (!rejectReason) {
      return NextResponse.json({ error: 'rejectReason is required' }, { status: 400 })
    }
    await rejectRequest(id, ctx.userId, rejectReason)
  } else {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
