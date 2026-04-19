import { NextResponse } from 'next/server'
import { getUserTeamContext } from '@/lib/auth/get-user-role'

export async function GET() {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ role: null })
  return NextResponse.json({ role: ctx.role, userId: ctx.userId, teamId: ctx.teamId })
}
