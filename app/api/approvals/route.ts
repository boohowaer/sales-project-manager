import { NextResponse } from 'next/server'
import { getUserTeamContext, isManager } from '@/lib/auth/get-user-role'
import { submitApprovalRequest, getMyRequests, getAllRequests } from '@/lib/supabase/approval-queries'
import { writeNotifications, getTeamSuperAdmins, getTeamSalesManagers } from '@/lib/supabase/notification-queries'

const TYPE_LABELS: Record<string, string> = {
  create_customer: '新建客户',
  create_project: '新建项目',
  update_project: '修改项目',
}

export async function GET(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mine = searchParams.get('mine') === 'true'

  if (mine) {
    const requests = await getMyRequests(ctx.userId)
    return NextResponse.json(requests)
  }

  if (isManager(ctx.role) || ctx.approvalCc) {
    const requests = await getAllRequests(ctx.teamId)
    return NextResponse.json(requests)
  }

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
    submitterRole: ctx.role,
  })

  const label = TYPE_LABELS[type] ?? type
  const name = (payload?.name as string) ?? ''
  const subject = name ? `${label}：${name}` : label

  // 第1步审批人：sales_rep 提交 → 通知 sales_manager；其他 → 通知 super_admin
  let step1Approvers: string[]
  if (ctx.role === 'sales_rep') {
    step1Approvers = await getTeamSalesManagers(ctx.teamId)
  } else {
    step1Approvers = await getTeamSuperAdmins(ctx.teamId)
  }

  await writeNotifications(
    step1Approvers.map(uid => ({
      userId: uid,
      type: 'approval_submitted' as const,
      title: '待审批',
      body: `「${subject}」等待你审批`,
      linkType: 'approval' as const,
      linkId: req.id,
    }))
  )

  return NextResponse.json(req, { status: 201 })
}
