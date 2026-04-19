'use client'
import { useEffect, useState, useCallback } from 'react'
import { ApprovalList } from '@/components/admin/ApprovalList'
import type { ApprovalRequest } from '@/types'

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])

  const loadRequests = useCallback(async () => {
    const res = await fetch('/api/approvals')
    if (res.ok) setRequests(await res.json())
  }, [])

  useEffect(() => { loadRequests() }, [loadRequests])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">待审批</h1>
        <p className="mt-2 text-zinc-500 text-sm">审核团队成员提交的客户和项目变更申请</p>
      </div>
      <ApprovalList requests={requests} onUpdate={loadRequests} />
    </div>
  )
}
