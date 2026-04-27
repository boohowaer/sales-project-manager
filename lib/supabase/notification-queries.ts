import { createClient } from '@supabase/supabase-js'
import type { InboxNotificationType, InboxLinkType } from '@/types'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TYPE_PRIORITY: Partial<Record<InboxNotificationType, number>> = {}

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
      if (incomingPriority < maxExistingPriority) return

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
  await Promise.all(notifications.map(n => writeNotification(n)))
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
