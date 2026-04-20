import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { UserTeamContext, TeamRole } from '@/types'

export async function getUserTeamContext(): Promise<UserTeamContext | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('team_members' as any)
    .select('team_id, role, data_scope, approval_cc, teams(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!member) return null

  const m = member as {
    team_id: string
    role: string
    data_scope: string
    approval_cc: boolean
    teams: { name: string } | null
  }
  return {
    teamId: m.team_id,
    teamName: m.teams?.name ?? '',
    role: m.role as TeamRole,
    userId: user.id,
    dataScope: (m.data_scope ?? 'own') as 'own' | 'team',
    approvalCc: m.approval_cc ?? false,
  }
}

export function isManager(role: TeamRole): boolean {
  return role === 'super_admin' || role === 'sales_manager'
}

export function isSuperAdmin(role: TeamRole): boolean {
  return role === 'super_admin'
}
