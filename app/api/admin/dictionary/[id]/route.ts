import { NextResponse } from 'next/server'
import { getUserTeamContext, isSuperAdmin } from '@/lib/auth/get-user-role'
import { updateDictionaryEntry, deleteDictionaryEntry } from '@/lib/supabase/admin-queries'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json()
  await updateDictionaryEntry(id, body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  await deleteDictionaryEntry(id)
  return NextResponse.json({ ok: true })
}
