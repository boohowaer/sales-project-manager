import { NextResponse } from 'next/server'
import { getUserTeamContext, isSuperAdmin } from '@/lib/auth/get-user-role'
import { getDictionaryEntries, createDictionaryEntry } from '@/lib/supabase/admin-queries'

export async function GET(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') ?? undefined
  const entries = await getDictionaryEntries(ctx.teamId, category)
  return NextResponse.json(entries)
}

export async function POST(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const { category, key, label, sort_order = 0 } = body
  if (!category || !key || !label) {
    return NextResponse.json({ error: 'category, key, label are required' }, { status: 400 })
  }
  const entry = await createDictionaryEntry({
    team_id: ctx.teamId,
    category,
    key,
    label,
    sort_order,
    is_active: true,
  })
  return NextResponse.json(entry, { status: 201 })
}
