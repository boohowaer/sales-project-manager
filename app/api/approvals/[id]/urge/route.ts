import { NextResponse } from 'next/server'
import { getUserTeamContext } from '@/lib/auth/get-user-role'
import { urgeRequest } from '@/lib/supabase/approval-queries'
import { writeNotifications, getTeamSalesManagers, getTeamSuperAdmins } from '@/lib/supabase/inbox-queries'
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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()
  const { data: req } = await supabase
    .from('approval_requests')
    .select('submitted_by, status, type, payload, current_step, total_steps')
    .eq('id', id)
    .single()

  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (req.submitted_by !== ctx.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (req.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending approvals can be urged' }, { status: 400 })
  }

  const result = await urgeRequest({ approvalId: id, urgedBy: ctx.userId })

  if ('error' in result) {
    return NextResponse.json(
      { error: 'cooldown', nextAllowedAt: result.nextAllowedAt },
      { status: 429 }
    )
  }

  // 催办当前步骤的审批人：第1步 → sales_manager，最后一步 → super_admin
  const currentApprovers = req.current_step < req.total_steps
    ? await getTeamSalesManagers(ctx.teamId)
    : await getTeamSuperAdmins(ctx.teamId)

  const label = TYPE_LABELS[req.type] ?? req.type
  const name = (req.payload as Record<string, unknown>)?.name as string ?? ''
  const subject = name ? `${label}：${name}` : label
  await writeNotifications(
    currentApprovers.map(uid => ({
      userId: uid,
      type: 'approval_urge_received' as const,
      title: '催办提醒',
      body: `「${subject}」发起人催你处理`,
      linkType: 'approval' as const,
      linkId: id,
    }))
  )

  return NextResponse.json({ ok: true })
}
