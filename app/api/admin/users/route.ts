import { NextResponse } from 'next/server'
import { getUserTeamContext, isSuperAdmin, isManager } from '@/lib/auth/get-user-role'
import { getTeamMembers, createInvitation } from '@/lib/supabase/admin-queries'

export async function GET() {
  const ctx = await getUserTeamContext()
  if (!ctx || !isManager(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const members = await getTeamMembers(ctx.teamId)
  return NextResponse.json(members)
}

export async function POST(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { email, role } = await request.json()
  if (!email || !role) {
    return NextResponse.json({ error: 'email and role are required' }, { status: 400 })
  }
  const invitation = await createInvitation({
    teamId: ctx.teamId,
    email,
    role,
    invitedBy: ctx.userId,
  })
  return NextResponse.json({ token: invitation.token }, { status: 201 })
}
