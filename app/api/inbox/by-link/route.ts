import { NextResponse } from 'next/server'
import { getUserTeamContext } from '@/lib/auth/get-user-role'
import { deleteNotificationsByLink } from '@/lib/supabase/inbox-queries'
import type { InboxLinkType } from '@/types'

export async function DELETE(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const linkType = searchParams.get('linkType') as InboxLinkType | null
  const linkId = searchParams.get('linkId')

  if (!linkType || !linkId) {
    return NextResponse.json({ error: 'linkType and linkId are required' }, { status: 400 })
  }

  await deleteNotificationsByLink(ctx.userId, linkType, linkId)
  return NextResponse.json({ ok: true })
}
