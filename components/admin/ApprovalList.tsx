'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { RejectDialog } from './RejectDialog'
import type { ApprovalRequest } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  create_customer: '新建客户',
  create_project: '新建项目',
  update_project: '修改项目',
}

export function ApprovalList({ requests, onUpdate }: {
  requests: ApprovalRequest[]
  onUpdate: () => void
}) {
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  async function handleApprove(id: string) {
    setLoading(id)
    await fetch(`/api/approvals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    setLoading(null)
    onUpdate()
  }

  async function handleReject(id: string, reason: string) {
    setLoading(id)
    await fetch(`/api/approvals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', rejectReason: reason }),
    })
    setLoading(null)
    setRejectTarget(null)
    onUpdate()
  }

  if (requests.length === 0) {
    return (
      <Card className="rounded-2xl shadow-sm border-0 bg-white">
        <CardContent className="text-center py-16">
          <p className="text-zinc-400 text-sm">暂无待审批内容</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map(req => (
        <div key={req.id} className="rounded-2xl border-0 bg-white shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full text-xs">{TYPE_LABELS[req.type] ?? req.type}</Badge>
              <span className="text-xs text-zinc-500">
                {new Date(req.created_at).toLocaleString('zh-CN')}
              </span>
            </div>
            <Badge className={`rounded-full text-xs border ${
              req.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
              : req.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
              : 'bg-rose-100 text-rose-700 border-rose-200'
            }`}>
              {req.status === 'pending' ? '待审批' : req.status === 'approved' ? '已通过' : '已驳回'}
            </Badge>
          </div>

          <pre className="text-xs bg-zinc-50 rounded-xl p-3 overflow-x-auto text-zinc-700">
            {JSON.stringify(req.payload, null, 2)}
          </pre>

          {req.status === 'pending' && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleApprove(req.id)} disabled={loading === req.id}
                className="rounded-full bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm">
                通过
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejectTarget(req.id)} disabled={loading === req.id}
                className="rounded-full border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                驳回
              </Button>
            </div>
          )}

          {req.status === 'rejected' && req.reject_reason && (
            <p className="text-xs text-rose-600">驳回原因：{req.reject_reason}</p>
          )}
        </div>
      ))}

      <RejectDialog
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        onConfirm={reason => rejectTarget && handleReject(rejectTarget, reason)}
      />
    </div>
  )
}
