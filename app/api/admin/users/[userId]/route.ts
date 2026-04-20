import { NextResponse } from 'next/server'
import { getUserTeamContext, isSuperAdmin } from '@/lib/auth/get-user-role'
import { updateMember } from '@/lib/supabase/admin-queries'

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
  await updateMember(userId, updates as any)
  return NextResponse.json({ ok: true })
}
