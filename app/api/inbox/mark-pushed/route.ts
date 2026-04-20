import { NextResponse } from 'next/server'
import { getUserTeamContext } from '@/lib/auth/get-user-role'
import { markBrowserPushed, getNotifications } from '@/lib/supabase/inbox-queries'

export async function POST(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await request.json() as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  const notifications = await getNotifications(ctx.userId)
  const ownIds = new Set(notifications.map(n => n.id))
  const safeIds = ids.filter(id => ownIds.has(id))

  await markBrowserPushed(safeIds)
  return NextResponse.json({ ok: true })
}
