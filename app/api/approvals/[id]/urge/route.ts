import { NextResponse } from 'next/server'
import { getUserTeamContext } from '@/lib/auth/get-user-role'
import { urgeRequest } from '@/lib/supabase/approval-queries'
import { createClient } from '@supabase/supabase-js'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // 验证该审批是当前用户发起的
  const supabase = createAdminClient()
  const { data: req } = await supabase
    .from('approval_requests')
    .select('submitted_by, status')
    .eq('id', id)
    .single()

  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (req.submitted_by !== ctx.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (req.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending approvals can be urged' }, { status: 400 })
  }

  const result = await urgeRequest({ approvalId: id, urgedBy: ctx.userId })

  if ('error' in result) {
    return NextResponse.json(
      { error: 'cooldown', nextAllowedAt: result.nextAllowedAt },
      { status: 429 }
    )
  }

  return NextResponse.json({ ok: true })
}
