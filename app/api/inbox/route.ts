import { NextResponse } from 'next/server'
import { getUserTeamContext } from '@/lib/auth/get-user-role'
import { getNotifications, getUnreadCount, writeNotification } from '@/lib/supabase/inbox-queries'
import type { InboxNotificationType, InboxLinkType } from '@/types'

export async function GET(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)

  if (searchParams.get('count') === 'true') {
    const unread = await getUnreadCount(ctx.userId)
    return NextResponse.json({ unread })
  }

  const notifications = await getNotifications(ctx.userId)
  return NextResponse.json(notifications)
}

export async function POST(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type, title, body: bodyText, linkType, linkId } = body as {
    type: InboxNotificationType
    title: string
    body?: string
    linkType?: InboxLinkType
    linkId?: string
  }

  if (!type || !title) {
    return NextResponse.json({ error: 'type and title are required' }, { status: 400 })
  }

  await writeNotification({
    userId: ctx.userId,
    type,
    title,
    body: bodyText,
    linkType,
    linkId,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
