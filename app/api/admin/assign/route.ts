import { NextResponse } from 'next/server'
import { getUserTeamContext, isManager } from '@/lib/auth/get-user-role'
import { assignResource, getTeamActiveMembers } from '@/lib/supabase/admin-queries'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isManager(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { resourceType, resourceId, assignedTo } = await request.json()
  if (!resourceType || !resourceId || !assignedTo) {
    return NextResponse.json({ error: 'resourceType, resourceId, assignedTo are required' }, { status: 400 })
  }

  const supabase = await createClient()
  const table = resourceType === 'customer' ? 'customers'
    : resourceType === 'project' ? 'projects' : 'tasks'
  const { data: record } = await supabase.from(table).select('user_id').eq('id', resourceId).single()

  await assignResource({
    teamId: ctx.teamId,
    resourceType,
    resourceId,
    assignedFrom: (record as any)?.user_id ?? null,
    assignedTo,
    operatedBy: ctx.userId,
  })

  return NextResponse.json({ ok: true })
}
