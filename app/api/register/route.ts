import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { writeNotifications, getTeamSuperAdmins } from '@/lib/supabase/notification-queries'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TEAM_ID = process.env.TEAM_ID ?? '7758bcae-9929-4493-86c0-5accdb879d77'

export async function POST(request: Request) {
  const { email, password, name } = await request.json()
  if (!email || !password || !name) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
  }

  const supabase = adminClient()

  // 创建 auth 用户
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { name },
    email_confirm: true,
  })
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const userId = authData.user.id

  // 创建 pending 成员记录
  const { error: memberError } = await supabase.from('team_members').insert({
    team_id: TEAM_ID,
    user_id: userId,
    role: 'sales_rep',
    status: 'pending',
  })
  if (memberError) {
    // 回滚：删除刚创建的 auth 用户
    await supabase.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  // 通知所有 super_admin
  const adminIds = await getTeamSuperAdmins(TEAM_ID)
  if (adminIds.length > 0) {
    await writeNotifications(
      adminIds.map(uid => ({
        userId: uid,
        type: 'member_request' as const,
        title: '新成员申请加入',
        body: `${name}（${email}）申请加入团队，请前往成员管理审核。`,
      }))
    )
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
