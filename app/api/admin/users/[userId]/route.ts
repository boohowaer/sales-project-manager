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
  const updates: { role?: string; status?: string } = {}
  if (body.role) updates.role = body.role
  if (body.status) updates.status = body.status
  await updateMember(userId, updates as any)
  return NextResponse.json({ ok: true })
}
