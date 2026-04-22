# 多级审批流 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将单步审批改造为多级审批：sales_rep 提交需经 sales_manager → super_admin 两步，sales_manager 提交只需 super_admin 一步。

**Architecture:** DB 新增 current_step/total_steps 字段 → approval-queries 改造提交/通过逻辑 → API 路由处理步骤流转与分级通知 → 前端按角色过滤待处理列表并展示步骤进度。

**Tech Stack:** Next.js 15 App Router, Supabase, TypeScript, Tailwind CSS, shadcn/ui

---

## 文件改动清单

| 文件 | 操作 |
|------|------|
| `migrations/20260420_add_approval_steps.sql` | 新增 |
| `types/index.ts` | 修改：ApprovalRequest 新增 current_step、total_steps |
| `lib/supabase/approval-queries.ts` | 修改：submitApprovalRequest、approveRequest |
| `lib/supabase/inbox-queries.ts` | 修改：新增 getTeamSalesManagers |
| `app/api/approvals/route.ts` | 修改：POST 按提交人角色计算步骤数，通知正确审批人 |
| `app/api/approvals/[id]/route.ts` | 修改：PATCH 处理步骤流转 |
| `app/dashboard/approvals/page.tsx` | 修改：待我处理过滤逻辑 + 步骤进度展示 |

---

### Task 1: 数据库迁移 — 新增 current_step / total_steps

**Files:**
- Create: `migrations/20260420_add_approval_steps.sql`

- [ ] **Step 1: 创建迁移文件**

```sql
-- migrations/20260420_add_approval_steps.sql

ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS current_step SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_steps  SMALLINT NOT NULL DEFAULT 1;
```

- [ ] **Step 2: 在 Supabase Dashboard SQL Editor 执行，验证**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'approval_requests'
  AND column_name IN ('current_step', 'total_steps');
-- 预期：返回两行
```

- [ ] **Step 3: Commit**

```bash
git add migrations/20260420_add_approval_steps.sql
git commit -m "feat: 数据库迁移 — approval_requests 新增 current_step/total_steps"
```

---

### Task 2: types/index.ts 更新 ApprovalRequest

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: 找到 ApprovalRequest 类型定义，添加两个字段**

将：
```typescript
export type ApprovalRequest = {
  id: string
  team_id: string
  type: ApprovalRequestType
  target_id: string | null
  payload: Record<string, unknown>
  submitted_by: string
  reviewed_by: string | null
  status: ApprovalStatus
  reject_reason: string | null
  created_at: string
  reviewed_at: string | null
}
```

替换为：
```typescript
export type ApprovalRequest = {
  id: string
  team_id: string
  type: ApprovalRequestType
  target_id: string | null
  payload: Record<string, unknown>
  submitted_by: string
  reviewed_by: string | null
  status: ApprovalStatus
  reject_reason: string | null
  current_step: number
  total_steps: number
  created_at: string
  reviewed_at: string | null
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: ApprovalRequest 类型新增 current_step/total_steps"
```

---

### Task 3: inbox-queries.ts 新增 getTeamSalesManagers

**Files:**
- Modify: `lib/supabase/inbox-queries.ts`

- [ ] **Step 1: 在文件末尾追加函数**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/inbox-queries.ts
git commit -m "feat: inbox-queries 新增 getTeamSalesManagers"
```

---

### Task 4: approval-queries.ts 改造 submitApprovalRequest

**Files:**
- Modify: `lib/supabase/approval-queries.ts`

- [ ] **Step 1: 修改 submitApprovalRequest，接收 submitterRole 并计算步骤数**

将现有 `submitApprovalRequest` 函数完整替换为：

```typescript
export async function submitApprovalRequest(params: {
  teamId: string
  type: ApprovalRequestType
  targetId?: string
  payload: Record<string, unknown>
  submittedBy: string
  submitterRole: 'super_admin' | 'sales_manager' | 'sales_rep'
}): Promise<ApprovalRequest> {
  const supabase = createAdminClient()
  // super_admin 提交直接通过，sales_manager 提交1步，sales_rep 提交2步
  const total_steps = params.submitterRole === 'sales_rep' ? 2 : 1
  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      team_id: params.teamId,
      type: params.type,
      target_id: params.targetId ?? null,
      payload: params.payload,
      submitted_by: params.submittedBy,
      status: 'pending',
      current_step: 1,
      total_steps,
    })
    .select()
    .single()
  if (error) throw error
  return data
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/approval-queries.ts
git commit -m "feat: submitApprovalRequest 支持多级步骤计算"
```

---

### Task 5: approval-queries.ts 改造 approveRequest

**Files:**
- Modify: `lib/supabase/approval-queries.ts`

- [ ] **Step 1: 修改 approveRequest，支持步骤流转**

将现有 `approveRequest` 函数完整替换为：

```typescript
export async function approveRequest(
  id: string,
  reviewedBy: string
): Promise<{ advanced: boolean }> {
  const supabase = createAdminClient()

  const { data: req, error: fetchError } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError || !req) throw fetchError ?? new Error('Request not found')

  // 还有下一步：只推进步骤，不执行业务操作
  if (req.current_step < req.total_steps) {
    const { error } = await supabase
      .from('approval_requests')
      .update({
        current_step: req.current_step + 1,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw error
    return { advanced: true }
  }

  // 最终步骤：执行业务操作并标记 approved
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

  return { advanced: false }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/approval-queries.ts
git commit -m "feat: approveRequest 支持步骤流转，返回 advanced 标志"
```

---

### Task 6: POST /api/approvals — 传入 submitterRole，通知正确审批人

**Files:**
- Modify: `app/api/approvals/route.ts`

- [ ] **Step 1: 替换 POST handler**

将 `app/api/approvals/route.ts` 中的 POST 函数替换为：

```typescript
export async function POST(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type, targetId, payload } = body
  if (!type || !payload) {
    return NextResponse.json({ error: 'type and payload are required' }, { status: 400 })
  }

  const req = await submitApprovalRequest({
    teamId: ctx.teamId,
    type,
    targetId,
    payload,
    submittedBy: ctx.userId,
    submitterRole: ctx.role,
  })

  const label = TYPE_LABELS[type] ?? type
  const name = (payload?.name as string) ?? ''
  const subject = name ? `${label}：${name}` : label

  // 第1步审批人：sales_rep 提交 → 通知 sales_manager；sales_manager 提交 → 通知 super_admin
  let step1Approvers: string[]
  if (ctx.role === 'sales_rep') {
    step1Approvers = await getTeamSalesManagers(ctx.teamId)
  } else {
    step1Approvers = await getTeamManagers(ctx.teamId)
  }

  await writeNotifications(
    step1Approvers.map(uid => ({
      userId: uid,
      type: 'approval_submitted' as const,
      title: '待审批',
      body: `「${subject}」等待你审批`,
      linkType: 'approval' as const,
      linkId: req.id,
    }))
  )

  return NextResponse.json(req, { status: 201 })
}
```

同时在文件顶部 import 中补充 `getTeamSalesManagers`：

```typescript
import { writeNotifications, getTeamManagers, getTeamSalesManagers } from '@/lib/supabase/inbox-queries'
```

并在文件顶部（GET 函数之前）添加 TYPE_LABELS 常量（如果还没有）：

```typescript
const TYPE_LABELS: Record<string, string> = {
  create_customer: '新建客户',
  create_project: '新建项目',
  update_project: '修改项目',
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/approvals/route.ts
git commit -m "feat: POST /api/approvals 按提交人角色通知正确的第1步审批人"
```

---

### Task 7: PATCH /api/approvals/[id] — 步骤流转与分级通知

**Files:**
- Modify: `app/api/approvals/[id]/route.ts`

- [ ] **Step 1: 替换整个文件**

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext, isManager } from '@/lib/auth/get-user-role'
import { approveRequest, rejectRequest } from '@/lib/supabase/approval-queries'
import { writeNotification, writeNotifications, getTeamCcUsers, getTeamManagers } from '@/lib/supabase/inbox-queries'
import { createClient } from '@supabase/supabase-js'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TYPE_LABELS: Record<string, string> = {
  create_customer: '新建客户',
  create_project: '新建项目',
  update_project: '修改项目',
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isManager(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { action, rejectReason } = await request.json()

  const supabase = createAdminClient()
  const { data: req } = await supabase
    .from('approval_requests')
    .select('submitted_by, type, payload, current_step, total_steps')
    .eq('id', id)
    .single()
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const label = TYPE_LABELS[req.type] ?? req.type
  const name = (req.payload as Record<string, unknown>)?.name as string ?? ''
  const subject = name ? `${label}：${name}` : label

  if (action === 'approve') {
    const { advanced } = await approveRequest(id, ctx.userId)

    if (advanced) {
      // 步骤推进：通知下一步审批人（super_admin）
      const nextApprovers = await getTeamManagers(ctx.teamId)
      await writeNotifications(
        nextApprovers.map(uid => ({
          userId: uid,
          type: 'approval_submitted' as const,
          title: '待审批（第2步）',
          body: `「${subject}」已通过第1步，等待你最终审批`,
          linkType: 'approval' as const,
          linkId: id,
        }))
      )
      // 同时通知提交人第1步已通过
      await writeNotification({
        userId: req.submitted_by,
        type: 'approval_approved',
        title: '审批进展',
        body: `你发起的「${subject}」第1步已通过，等待最终审批`,
        linkType: 'approval',
        linkId: id,
      })
    } else {
      // 最终通过：通知提交人 + CC 用户
      await writeNotification({
        userId: req.submitted_by,
        type: 'approval_approved',
        title: '审批通过',
        body: `你发起的「${subject}」已全部通过`,
        linkType: 'approval',
        linkId: id,
      })
      const ccUsers = await getTeamCcUsers(ctx.teamId)
      if (ccUsers.length > 0) {
        await writeNotifications(
          ccUsers.map(uid => ({
            userId: uid,
            type: 'approval_cc' as const,
            title: '审批抄送',
            body: `「${subject}」已获批准`,
            linkType: 'approval' as const,
            linkId: id,
          }))
        )
      }
    }
  } else if (action === 'reject') {
    if (!rejectReason) {
      return NextResponse.json({ error: 'rejectReason is required' }, { status: 400 })
    }
    await rejectRequest(id, ctx.userId, rejectReason)

    await writeNotification({
      userId: req.submitted_by,
      type: 'approval_rejected',
      title: '审批驳回',
      body: `你发起的「${subject}」已被驳回`,
      linkType: 'approval',
      linkId: id,
    })
  } else {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/approvals/[id]/route.ts"
git commit -m "feat: PATCH /api/approvals/[id] 支持多步流转与分级通知"
```

---

### Task 8: 前端审批管理页面 — 过滤逻辑 + 步骤进度展示

**Files:**
- Modify: `app/dashboard/approvals/page.tsx`

- [ ] **Step 1: 替换整个文件**

```typescript
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

    const [allRes, mineRes] = await Promise.all([
      fetch('/api/approvals'),
      fetch('/api/approvals?mine=true'),
    ])
    if (allRes.ok) setRequests(await allRes.json())
    if (mineRes.ok) setMyRequests(await mineRes.json())
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // 判断当前用户是否是该审批当前步骤的审批人
  function isMyTurn(req: ApprovalRequest): boolean {
    if (req.status !== 'pending') return false
    if (role === 'sales_manager') {
      // sales_manager 负责第1步
      return req.current_step === 1
    }
    if (role === 'super_admin') {
      // super_admin 负责最后一步
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

      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
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
        ))}
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
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/approvals/page.tsx
git commit -m "feat: 审批管理页面支持多步过滤和步骤进度展示"
```
