import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserTeamContext } from '@/lib/auth/get-user-role'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST /api/tasks/[id]/share — 指派或同步
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const { toUserId, shareType } = await request.json()

  if (!toUserId || !shareType || !['assign', 'sync'].includes(shareType)) {
    return NextResponse.json({ error: 'toUserId and shareType (assign|sync) required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 验证任务属于当前用户
  const { data: task } = await supabase
    .from('tasks')
    .select('user_id')
    .eq('id', taskId)
    .single()

  if (!task || task.user_id !== ctx.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('task_shares')
    .upsert({ task_id: taskId, from_user_id: ctx.userId, to_user_id: toUserId, share_type: shareType })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

// DELETE /api/tasks/[id]/share — 撤回指派或同步
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const { toUserId } = await request.json()

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('task_shares')
    .delete()
    .eq('task_id', taskId)
    .eq('from_user_id', ctx.userId)
    .eq('to_user_id', toUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
