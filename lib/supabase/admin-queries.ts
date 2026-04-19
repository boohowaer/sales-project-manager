import { createClient } from '@supabase/supabase-js'
import type { TeamMember, TeamInvitation } from '@/types'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function getTeamMembers(teamId: string): Promise<(TeamMember & { email: string })[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('team_members')
    .select('*, users:user_id(email)')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return (data || []).map((m: any) => ({
    ...m,
    email: (m.users as { email: string } | null)?.email ?? '',
  }))
}

export async function updateMember(
  memberId: string,
  updates: { role?: TeamMember['role']; status?: 'active' | 'disabled' }
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('team_members')
    .update(updates)
    .eq('id', memberId)
  if (error) throw error
}

export async function createInvitation(params: {
  teamId: string
  email: string
  role: TeamMember['role']
  invitedBy: string
}): Promise<TeamInvitation> {
  const supabase = createAdminClient()
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('team_invitations')
    .insert({
      team_id: params.teamId,
      email: params.email,
      role: params.role,
      token,
      invited_by: params.invitedBy,
      expires_at: expiresAt,
    })
    .select()
    .single()
  if (error) throw error
  return data as TeamInvitation
}

export async function getInvitationByToken(token: string): Promise<TeamInvitation | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('token', token)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()
  return data as TeamInvitation | null
}

export async function acceptInvitation(token: string, userId: string): Promise<void> {
  const supabase = createAdminClient()
  const invitation = await getInvitationByToken(token)
  if (!invitation) throw new Error('Invalid or expired invitation')

  await supabase.from('team_members').insert({
    team_id: invitation.team_id,
    user_id: userId,
    role: invitation.role,
    invited_by: invitation.invited_by,
  })
  await supabase
    .from('team_invitations')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
}

// ─── 分派 ───────────────────────────────────────────────────

export async function assignResource(params: {
  teamId: string
  resourceType: 'customer' | 'project' | 'task'
  resourceId: string
  assignedFrom: string | null
  assignedTo: string
  operatedBy: string
}): Promise<void> {
  const supabase = createAdminClient()
  const table = params.resourceType === 'customer' ? 'customers'
    : params.resourceType === 'project' ? 'projects' : 'tasks'

  const { error: updateError } = await supabase
    .from(table)
    .update({ user_id: params.assignedTo })
    .eq('id', params.resourceId)
  if (updateError) throw updateError

  const { error: logError } = await supabase
    .from('assignment_logs')
    .insert({
      team_id: params.teamId,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      assigned_from: params.assignedFrom,
      assigned_to: params.assignedTo,
      operated_by: params.operatedBy,
    })
  if (logError) throw logError
}

export async function getTeamActiveMembers(teamId: string): Promise<{ id: string; user_id: string; email: string; role: string }[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('team_members')
    .select('id, user_id, role, users:user_id(email)')
    .eq('team_id', teamId)
    .eq('status', 'active')
  if (error) throw error
  return (data || []).map((m: any) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    email: (m.users as { email: string } | null)?.email ?? '',
  }))
}

// ─── 数据字典 ───────────────────────────────────────────────

export type DictionaryEntry = {
  id: string
  team_id: string
  category: string
  key: string
  label: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export async function getDictionaryEntries(teamId: string, category?: string): Promise<DictionaryEntry[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('data_dictionary')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true })
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as DictionaryEntry[]
}

export async function createDictionaryEntry(
  entry: Omit<DictionaryEntry, 'id' | 'created_at'>
): Promise<DictionaryEntry> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('data_dictionary')
    .insert(entry)
    .select()
    .single()
  if (error) throw error
  return data as DictionaryEntry
}

export async function updateDictionaryEntry(
  id: string,
  updates: Partial<Pick<DictionaryEntry, 'label' | 'sort_order' | 'is_active'>>
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('data_dictionary').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteDictionaryEntry(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('data_dictionary').delete().eq('id', id)
  if (error) throw error
}
