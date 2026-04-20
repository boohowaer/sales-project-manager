import { NextResponse } from 'next/server'
import { getUserTeamContext, isManager } from '@/lib/auth/get-user-role'
import { submitApprovalRequest, getPendingRequests, getMyRequests, getAllRequests } from '@/lib/supabase/approval-queries'

export async function GET(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mine = searchParams.get('mine') === 'true'

  if (mine) {
    const requests = await getMyRequests(ctx.userId)
    return NextResponse.json(requests)
  }

  // manager 或 approval_cc 用户可查看全部审批
  if (isManager(ctx.role) || ctx.approvalCc) {
    const requests = await getAllRequests(ctx.teamId)
    return NextResponse.json(requests)
  }

  // sales_rep 无 cc 权限时只能看自己的
  const requests = await getMyRequests(ctx.userId)
  return NextResponse.json(requests)
}

export async function POST(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type, targetId, payload } = body
  if (!type || !payload) {
    return NextResponse.json({ error: 'type and payload are required' }, { status: 400 })
  }

  const req = await submitApprovalRequest({
    teamId: ctx.teamId,
    type,
    targetId,
    payload,
    submittedBy: ctx.userId,
  })
  return NextResponse.json(req, { status: 201 })
}
