import { NextResponse } from 'next/server'
import { getInvitationByToken, acceptInvitation } from '@/lib/supabase/admin-queries'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const invitation = await getInvitationByToken(token)
  if (!invitation) {
    return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 })
  }
  return NextResponse.json({ email: invitation.email, role: invitation.role })
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await acceptInvitation(token, user.id)
  return NextResponse.json({ ok: true })
}
