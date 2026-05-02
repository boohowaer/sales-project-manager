import { createClient } from '@supabase/supabase-js'
import type { TeamMember, TeamInvitation } from '@/types'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function getTeamMembers(teamId: string): Promise<(TeamMember & { email: string; name: string })[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  const members = data || []

  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const userMap = new Map(users.map(u => [u.id, u]))

  return members.map((m: any) => {
    const u = userMap.get(m.user_id)
    return {
      ...m,
      email: u?.email ?? '',
      name: u?.user_metadata?.name ?? '',
    }
  })
}

export async function updateMember(
  memberId: string,
  updates: {
    role?: TeamMember['role']
    status?: 'active' | 'disabled'
    data_scope?: 'own' | 'team'
    approval_cc?: boolean
  }
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
    .select('id, user_id, role')
    .eq('team_id', teamId)
    .eq('status', 'active')
  if (error) throw error
  const members = data || []

  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) throw usersError
  const emailMap = new Map(users.map(u => [u.id, u.email ?? '']))

  return members.map((m: any) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    email: emailMap.get(m.user_id) ?? '',
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
  parent_id: string | null
  level: number
  module: string | null
  field_key: string | null
  display_name: string | null
}

export async function getDictionaryEntries(teamId: string, category?: string | string[], module?: string): Promise<DictionaryEntry[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('data_dictionary')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true })
  if (Array.isArray(category)) {
    if (category.length > 0) query = query.in('category', category)
  } else if (category) {
    query = query.eq('category', category)
  }
  if (module) query = query.eq('module', module)
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
  updates: Partial<Pick<DictionaryEntry, 'key' | 'label' | 'sort_order' | 'is_active' | 'display_name' | 'parent_id' | 'level'>>
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('data_dictionary').update(updates).eq('id', id)
  if (error) throw error
}

// 修改字典项的 key，并级联更新所有引用了旧 key 的业务数据
export async function updateDictionaryKeyWithCascade(
  teamId: string,
  id: string,
  oldKey: string,
  newKey: string,
  fieldKey: string
): Promise<void> {
  const supabase = createAdminClient()

  const fieldColumnMap: Record<string, { table: string; column: string }> = {
    company: { table: 'customers', column: 'company' },
    customer_source: { table: 'projects', column: 'customer_source' },
    industry: { table: 'projects', column: 'industry' },
    project_status: { table: 'projects', column: 'status' },
  }

  const mapping = fieldColumnMap[fieldKey]
  if (mapping) {
    const { error: updateError } = await supabase
      .from(mapping.table)
      .update({ [mapping.column]: newKey })
      .eq('team_id', teamId)
      .eq(mapping.column, oldKey)
    if (updateError) throw updateError
  }

  const { error } = await supabase.from('data_dictionary').update({ key: newKey }).eq('id', id)
  if (error) throw error
}

export async function deleteDictionaryEntry(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('data_dictionary').delete().eq('id', id)
  if (error) throw error
}

export async function batchUpdateDictionaryEntries(ids: string[], updates: Partial<Pick<DictionaryEntry, 'is_active' | 'sort_order'>>): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('data_dictionary').update(updates).in('id', ids)
  if (error) throw error
}

export async function batchDeleteDictionaryEntries(ids: string[]): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('data_dictionary').delete().in('id', ids)
  if (error) throw error
}

export async function reorderDictionaryEntries(items: { id: string; sort_order: number }[]): Promise<void> {
  const supabase = createAdminClient()
  for (const item of items) {
    const { error } = await supabase.from('data_dictionary').update({ sort_order: item.sort_order }).eq('id', item.id)
    if (error) throw error
  }
}

export async function getDictionaryFieldConfigs(teamId: string): Promise<any[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('dictionary_fields')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

export async function updateDictionaryFieldConfig(id: string, updates: { display_name?: string; sort_order?: number }): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('dictionary_fields').update(updates).eq('id', id)
  if (error) throw error
}

// 检查字典选项被多少数据引用
export async function checkDictionaryUsage(teamId: string, fieldKey: string, key: string): Promise<{ table: string; count: number }[]> {
  const supabase = createAdminClient()
  const results: { table: string; count: number }[] = []

  // 检查各表中该字段的使用情况
  const checks: { table: string; column: string }[] = [
    { table: 'customers', column: 'company' },
    { table: 'projects', column: 'customer_source' },
    { table: 'projects', column: 'industry' },
    { table: 'projects', column: 'status' },
  ]

  const fieldColumnMap: Record<string, string> = {
    company: 'company',
    customer_source: 'customer_source',
    industry: 'industry',
    project_status: 'status',
  }

  const column = fieldColumnMap[fieldKey]
  if (!column) return results

  const { count } = await supabase
    .from(column === 'status' ? 'projects' : column === 'company' ? 'customers' : 'projects')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq(column, key)

  results.push({ table: column === 'company' ? 'customers' : 'projects', count: count || 0 })
  return results
}
