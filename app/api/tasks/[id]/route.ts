import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserTeamContext } from '@/lib/auth/get-user-role'

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing env:', { url: !!url, key: !!key })
  }
  return createClient(url!, key!)
}

// PATCH /api/tasks/[id] — 任务 owner 或 assignee 均可更新
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const body = await request.json()

  const supabase = createAdminClient()

  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('user_id')
    .eq('id', taskId)
    .single()

  if (fetchError) {
    console.error('Task fetch error:', fetchError.message)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (task.user_id !== ctx.userId) {
    const { data: share } = await supabase
      .from('task_shares' as any)
      .select('id')
      .eq('task_id', taskId)
      .eq('to_user_id', ctx.userId)
      .maybeSingle()
    if (!share) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(body)
    .eq('id', taskId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
