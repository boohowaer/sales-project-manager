import { createClient } from '@supabase/supabase-js'
import type { InboxNotification, InboxNotificationType, InboxLinkType } from '@/types'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function writeNotification(params: {
  userId: string
  type: InboxNotificationType
  title: string
  body?: string
  linkType?: InboxLinkType
  linkId?: string
}): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('inbox_notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? null,
    link_type: params.linkType ?? null,
    link_id: params.linkId ?? null,
  })
  if (error) throw error
}

export async function writeNotifications(
  notifications: Array<{
    userId: string
    type: InboxNotificationType
    title: string
    body?: string
    linkType?: InboxLinkType
    linkId?: string
  }>
): Promise<void> {
  if (notifications.length === 0) return
  const supabase = createAdminClient()
  const { error } = await supabase.from('inbox_notifications').insert(
    notifications.map(n => ({
      user_id: n.userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link_type: n.linkType ?? null,
      link_id: n.linkId ?? null,
    }))
  )
  if (error) throw error
}

export async function getNotifications(userId: string): Promise<InboxNotification[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('inbox_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createAdminClient()
  const { count, error } = await supabase
    .from('inbox_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw error
  return count ?? 0
}

export async function markRead(id: string, userId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('inbox_notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function markBrowserPushed(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('inbox_notifications')
    .update({ browser_pushed: true })
    .in('id', ids)
  if (error) throw error
}

export async function getTeamManagers(teamId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .in('role', ['super_admin', 'sales_manager'])
    .eq('status', 'active')
  return data?.map(m => m.user_id) ?? []
}

export async function getTeamCcUsers(teamId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('approval_cc', true)
    .eq('status', 'active')
  return data?.map(m => m.user_id) ?? []
}

export async function getTeamSalesManagers(teamId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('role', 'sales_manager')
    .eq('status', 'active')
  return data?.map(m => m.user_id) ?? []
}
