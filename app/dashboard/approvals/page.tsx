'use client'
import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { RejectDialog } from '@/components/admin/RejectDialog'
import { toast } from 'react-hot-toast'
import type { ApprovalRequest } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  create_customer: '新建客户',
  create_project: '新建项目',
  update_project: '修改项目',
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-100 text-rose-700 border-rose-200',
  }
  const labels: Record<string, string> = { pending: '审批中', approved: '已通过', rejected: '已驳回' }
  return (
    <Badge className={`rounded-full text-xs border ${map[status] ?? ''}`}>
      {labels[status] ?? status}
    </Badge>
  )
}

function StepBadge({ current, total }: { current: number; total: number }) {
  if (total <= 1) return null
  return (
    <span className="text-xs text-zinc-400 bg-zinc-100 rounded-full px-2 py-0.5">
      第{current}步 / 共{total}步
    </span>
  )
}

function ApprovalCard({
  req,
  canApprove,
  canUrge,
  onApprove,
  onReject,
  onUrge,
  loading,
}: {
  req: ApprovalRequest
  canApprove: boolean
  canUrge: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onUrge: (id: string) => void
  loading: string | null
}) {
  return (
    <div className="rounded-2xl border-0 bg-white shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-full text-xs">
            {TYPE_LABELS[req.type] ?? req.type}
          </Badge>
          <StepBadge current={req.current_step} total={req.total_steps} />
          <span className="text-xs text-zinc-500">
            {new Date(req.created_at).toLocaleString('zh-CN')}
          </span>
        </div>
        <StatusBadge status={req.status} />
      </div>

      <pre className="text-xs bg-zinc-50 rounded-xl p-3 overflow-x-auto text-zinc-700">
        {JSON.stringify(req.payload, null, 2)}
      </pre>

      {req.status === 'rejected' && req.reject_reason && (
        <p className="text-xs text-rose-600">驳回原因：{req.reject_reason}</p>
      )}

      {req.status === 'pending' && (
        <div className="flex gap-2">
          {canApprove && (
            <>
              <Button
                size="sm"
                onClick={() => onApprove(req.id)}
                disabled={loading === req.id}
                className="rounded-full bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm"
              >
                通过
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReject(req.id)}
                disabled={loading === req.id}
                className="rounded-full border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              >
                驳回
              </Button>
            </>
          )}
          {canUrge && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUrge(req.id)}
              disabled={loading === req.id}
              className="rounded-full border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            >
              催办
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [myRequests, setMyRequests] = useState<ApprovalRequest[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [approvalCc, setApprovalCc] = useState(false)
  const [meLoaded, setMeLoaded] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [tab, setTab] = useState<'pending' | 'mine' | 'all'>('pending')

  const isManager = role === 'super_admin' || role === 'sales_manager'

  const loadData = useCallback(async () => {
    const meRes = await fetch('/api/me')
    const me = await meRes.json()
    setRole(me.role)
    setUserId(me.userId)
    setApprovalCc(me.approvalCc ?? false)
    setMeLoaded(true)

    const [allRes, mineRes] = await Promise.all([
      fetch('/api/approvals'),
      fetch('/api/approvals?mine=true'),
    ])
    if (allRes.ok) setRequests(await allRes.json())
    if (mineRes.ok) setMyRequests(await mineRes.json())
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function isMyTurn(req: ApprovalRequest): boolean {
    if (req.status !== 'pending') return false
    if (role === 'sales_manager') {
      return req.current_step === 1
    }
    if (role === 'super_admin') {
      return req.current_step === req.total_steps
    }
    return false
  }

  async function handleApprove(id: string) {
    setLoading(id)
    const res = await fetch(`/api/approvals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    setLoading(null)
    if (res.ok) { toast.success('已通过'); loadData() }
    else toast.error('操作失败')
  }

  async function handleReject(id: string, reason: string) {
    setLoading(id)
    const res = await fetch(`/api/approvals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', rejectReason: reason }),
    })
    setLoading(null)
    setRejectTarget(null)
    if (res.ok) { toast.success('已驳回'); loadData() }
    else toast.error('操作失败')
  }

  async function handleUrge(id: string) {
    setLoading(id)
    const res = await fetch(`/api/approvals/${id}/urge`, { method: 'POST' })
    setLoading(null)
    if (res.status === 429) {
      const data = await res.json()
      const next = new Date(data.nextAllowedAt).toLocaleString('zh-CN')
      toast.error(`已催办，${next} 后可再次催办`)
    } else if (res.ok) {
      toast.success('催办成功')
    } else {
      toast.error('催办失败')
    }
  }

  const pendingForMe = requests.filter(r => isMyTurn(r))
  const tabs = [
    ...(isManager ? [{ key: 'pending' as const, label: `待我处理 (${pendingForMe.length})` }] : []),
    { key: 'mine' as const, label: '我发起的' },
    ...((isManager || approvalCc) ? [{ key: 'all' as const, label: '全部审批' }] : []),
  ]

  const activeTab = tabs.find(t => t.key === tab) ? tab : tabs[0]?.key ?? 'mine'

  const displayRequests =
    activeTab === 'pending' ? pendingForMe :
    activeTab === 'mine' ? myRequests :
    requests

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">审批管理</h1>
        <p className="mt-2 text-zinc-500 text-sm">查看和处理审批申请</p>
      </div>

      <div className="flex gap-2 mb-6 min-h-[34px]">
        {meLoaded ? tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-zinc-900 text-white'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
            }`}
          >
            {t.label}
          </button>
        )) : null}
      </div>

      {displayRequests.length === 0 ? (
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="text-center py-16">
            <p className="text-zinc-400 text-sm">暂无审批记录</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayRequests.map(req => (
            <ApprovalCard
              key={req.id}
              req={req}
              canApprove={isMyTurn(req)}
              canUrge={activeTab === 'mine' && req.status === 'pending' && req.submitted_by === userId}
              onApprove={handleApprove}
              onReject={id => setRejectTarget(id)}
              onUrge={handleUrge}
              loading={loading}
            />
          ))}
        </div>
      )}

      <RejectDialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onConfirm={reason => rejectTarget && handleReject(rejectTarget, reason)}
      />
    </div>
  )
}
