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
