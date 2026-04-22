import { NextResponse } from 'next/server'
import { getUserTeamContext, isSuperAdmin } from '@/lib/auth/get-user-role'
import { updateMember } from '@/lib/supabase/admin-queries'
import { writeNotification } from '@/lib/supabase/inbox-queries'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { userId } = await params
  const body = await request.json()
  const updates: {
    role?: string
    status?: string
    data_scope?: 'own' | 'team'
    approval_cc?: boolean
  } = {}
  if (body.role) updates.role = body.role
  if (body.status) updates.status = body.status
  if (body.data_scope !== undefined) updates.data_scope = body.data_scope
  if (body.approval_cc !== undefined) updates.approval_cc = body.approval_cc

  // 先查当前状态，判断是否是 pending→active 的审批通过
  const supabase = adminClient()
  const { data: current } = await supabase
    .from('team_members')
    .select('status, user_id')
    .eq('id', userId)
    .single()

  await updateMember(userId, updates as any)

  // pending→active：通知用户
  if (current?.status === 'pending' && updates.status === 'active') {
    await writeNotification({
      userId: current.user_id,
      type: 'member_approved',
      title: '申请已通过',
      body: '管理员已审核通过你的申请，现在可以登录系统了。',
    })
  }

  return NextResponse.json({ ok: true })
}
