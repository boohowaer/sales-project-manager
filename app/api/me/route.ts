import { NextResponse } from 'next/server'
import { getUserTeamContext } from '@/lib/auth/get-user-role'
import { getTeamMembers } from '@/lib/supabase/admin-queries'

export async function GET(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ role: null })

  const includeMembers = new URL(request.url).searchParams.get('include') === 'members'
  const members = includeMembers ? await getTeamMembers(ctx.teamId) : undefined

  return NextResponse.json({
    role: ctx.role,
    userId: ctx.userId,
    teamId: ctx.teamId,
    dataScope: ctx.dataScope,
    approvalCc: ctx.approvalCc,
    ...(members ? { members } : {}),
  })
}
