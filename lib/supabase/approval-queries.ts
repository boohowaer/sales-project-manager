import { createClient } from '@supabase/supabase-js'
import type { ApprovalRequest, ApprovalRequestType } from '@/types'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function submitApprovalRequest(params: {
  teamId: string
  type: ApprovalRequestType
  targetId?: string
  payload: Record<string, unknown>
  submittedBy: string
}): Promise<ApprovalRequest> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      team_id: params.teamId,
      type: params.type,
      target_id: params.targetId ?? null,
      payload: params.payload,
      submitted_by: params.submittedBy,
      status: 'pending',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getPendingRequests(teamId: string): Promise<ApprovalRequest[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getMyRequests(submittedBy: string): Promise<ApprovalRequest[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('submitted_by', submittedBy)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function approveRequest(id: string, reviewedBy: string): Promise<void> {
  const supabase = createAdminClient()

  const { data: req, error: fetchError } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError || !req) throw fetchError ?? new Error('Request not found')

  if (req.type === 'create_customer') {
    const { data: customer, error } = await supabase
      .from('customers')
      .insert(req.payload)
      .select()
      .single()
    if (error) throw error
    await supabase.from('approval_requests').update({
      status: 'approved',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      target_id: customer.id,
    }).eq('id', id)
  } else if (req.type === 'create_project') {
    const { data: project, error } = await supabase
      .from('projects')
      .insert(req.payload)
      .select()
      .single()
    if (error) throw error
    await supabase.from('approval_requests').update({
      status: 'approved',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      target_id: project.id,
    }).eq('id', id)
  } else if (req.type === 'update_project') {
    const { error } = await supabase
      .from('projects')
      .update(req.payload)
      .eq('id', req.target_id)
    if (error) throw error
    await supabase.from('approval_requests').update({
      status: 'approved',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
  }
}

export async function rejectRequest(id: string, reviewedBy: string, rejectReason: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('approval_requests')
    .update({
      status: 'rejected',
      reviewed_by: reviewedBy,
      reject_reason: rejectReason,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function getAllRequests(teamId: string): Promise<ApprovalRequest[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function urgeRequest(params: {
  approvalId: string
  urgedBy: string
}): Promise<{ ok: true } | { error: 'cooldown'; nextAllowedAt: string }> {
  const supabase = createAdminClient()

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('approval_urge_log')
    .select('urged_at')
    .eq('approval_id', params.approvalId)
    .gte('urged_at', since)
    .order('urged_at', { ascending: false })
    .limit(1)

  if (recent && recent.length > 0) {
    const nextAllowedAt = new Date(
      new Date(recent[0].urged_at).getTime() + 24 * 60 * 60 * 1000
    ).toISOString()
    return { error: 'cooldown', nextAllowedAt }
  }

  const { error } = await supabase
    .from('approval_urge_log')
    .insert({ approval_id: params.approvalId, urged_by: params.urgedBy })
  if (error) throw error

  return { ok: true }
}

export async function getLastUrge(approvalId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('approval_urge_log')
    .select('urged_at')
    .eq('approval_id', approvalId)
    .order('urged_at', { ascending: false })
    .limit(1)
  return data?.[0]?.urged_at ?? null
}
