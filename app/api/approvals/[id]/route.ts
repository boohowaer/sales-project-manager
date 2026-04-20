import { NextResponse } from 'next/server'
import { getUserTeamContext, isManager } from '@/lib/auth/get-user-role'
import { approveRequest, rejectRequest } from '@/lib/supabase/approval-queries'
import { writeNotification, writeNotifications, getTeamCcUsers, getTeamSuperAdmins } from '@/lib/supabase/inbox-queries'
import { createClient } from '@supabase/supabase-js'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TYPE_LABELS: Record<string, string> = {
  create_customer: '新建客户',
  create_project: '新建项目',
  update_project: '修改项目',
}

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

  const supabase = createAdminClient()
  const { data: req } = await supabase
    .from('approval_requests')
    .select('submitted_by, type, payload, current_step, total_steps')
    .eq('id', id)
    .single()
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const label = TYPE_LABELS[req.type] ?? req.type
  const name = (req.payload as Record<string, unknown>)?.name as string ?? ''
  const subject = name ? `${label}：${name}` : label

  if (action === 'approve') {
    const { advanced } = await approveRequest(id, ctx.userId)

    if (advanced) {
      // 步骤推进：只通知 super_admin（第2步审批人）
      const nextApprovers = await getTeamSuperAdmins(ctx.teamId)
      await writeNotifications(
        nextApprovers.map(uid => ({
          userId: uid,
          type: 'approval_submitted' as const,
          title: '待审批（第2步）',
          body: `「${subject}」已通过第1步，等待你最终审批`,
          linkType: 'approval' as const,
          linkId: id,
        }))
      )
      // 通知提交人第1步已通过
      await writeNotification({
        userId: req.submitted_by,
        type: 'approval_approved',
        title: '审批进展',
        body: `你发起的「${subject}」第1步已通过，等待最终审批`,
        linkType: 'approval',
        linkId: id,
      })
    } else {
      // 最终通过：通知提交人 + CC 用户
      await writeNotification({
        userId: req.submitted_by,
        type: 'approval_approved',
        title: '审批通过',
        body: `你发起的「${subject}」已全部通过`,
        linkType: 'approval',
        linkId: id,
      })
      const ccUsers = await getTeamCcUsers(ctx.teamId)
      if (ccUsers.length > 0) {
        await writeNotifications(
          ccUsers.map(uid => ({
            userId: uid,
            type: 'approval_cc' as const,
            title: '审批抄送',
            body: `「${subject}」已获批准`,
            linkType: 'approval' as const,
            linkId: id,
          }))
        )
      }
    }
  } else if (action === 'reject') {
    if (!rejectReason) {
      return NextResponse.json({ error: 'rejectReason is required' }, { status: 400 })
    }
    await rejectRequest(id, ctx.userId, rejectReason)

    await writeNotification({
      userId: req.submitted_by,
      type: 'approval_rejected',
      title: '审批驳回',
      body: `你发起的「${subject}」已被驳回`,
      linkType: 'approval',
      linkId: id,
    })
  } else {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
