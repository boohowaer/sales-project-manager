import { createClient } from '@supabase/supabase-js'
import type { InboxNotification, InboxNotificationType, InboxLinkType } from '@/types'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// 数值越高优先级越高，未列出的为 0
const TYPE_PRIORITY: Partial<Record<InboxNotificationType, number>> = {
  task_overdue: 2,
  task_upcoming: 1,
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

  if (params.linkType && params.linkId) {
    // 查询同一 link 是否已有更高优先级的记录
    const { data: existing } = await supabase
      .from('inbox_notifications')
      .select('id, type')
      .eq('user_id', params.userId)
      .eq('link_type', params.linkType)
      .eq('link_id', params.linkId)

    if (existing && existing.length > 0) {
      const incomingPriority = TYPE_PRIORITY[params.type] ?? 0
      const maxExistingPriority = Math.max(
        ...existing.map((r: { type: InboxNotificationType }) => TYPE_PRIORITY[r.type] ?? 0)
      )
      // 已有更高优先级的记录，跳过写入
      if (incomingPriority < maxExistingPriority) return

      // 删除旧记录，写入新的
      await supabase
        .from('inbox_notifications')
        .delete()
        .eq('user_id', params.userId)
        .eq('link_type', params.linkType)
        .eq('link_id', params.linkId)
    }
  }

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
  // 逐条写入以应用去重逻辑
  await Promise.all(notifications.map(n => writeNotification(n)))
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

export async function getTeamSuperAdmins(teamId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('role', 'super_admin')
    .eq('status', 'active')
  return data?.map(m => m.user_id) ?? []
}

export async function deleteNotificationsByLink(
  userId: string,
  linkType: InboxLinkType,
  linkId: string
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('inbox_notifications')
    .delete()
    .eq('user_id', userId)
    .eq('link_type', linkType)
    .eq('link_id', linkId)
  if (error) throw error
}
