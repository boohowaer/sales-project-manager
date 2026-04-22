# 审批流 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 普通销售（sales_rep）新建客户/项目或修改项目关键字段时，数据进入待审批状态，经理/超管在审批页面通过或驳回后正式生效。

**Architecture:** 提交时将数据快照存入 `approval_requests.payload`，审批通过后从 payload 写入实际表；修改项目关键字段时原数据继续生效，新值以 pending 状态等待；前端根据用户角色决定走直接写入还是审批流。

**Tech Stack:** Next.js 15 App Router, Supabase, TypeScript, shadcn/ui, Tailwind CSS

---

## 文件结构

**新建：**
- `lib/supabase/approval-queries.ts` — 审批相关查询函数
- `app/api/approvals/route.ts` — POST 提交审批请求
- `app/api/approvals/[id]/route.ts` — PATCH 审批通过/驳回
- `app/dashboard/admin/approvals/page.tsx` — 审批列表页
- `components/admin/ApprovalList.tsx` — 审批列表组件
- `components/admin/RejectDialog.tsx` — 驳回原因输入对话框

**修改：**
- `app/dashboard/customers/page.tsx` — 新建客户时 sales_rep 走审批流
- `app/dashboard/projects/page.tsx` — 新建/修改项目时 sales_rep 走审批流
- `components/layout/SidebarNavigation.tsx` — 经理/超管可见审批入口（带待审批数量角标）

---

### Task 1: 审批查询函数

**Files:**
- Create: `lib/supabase/approval-queries.ts`

- [ ] **Step 1: 创建文件**

```typescript
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
```

- [ ] **Step 2: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/approval-queries.ts
git commit -m "feat: add approval-queries with submit, approve, reject functions"
```

---

### Task 2: 审批 API 路由

**Files:**
- Create: `app/api/approvals/route.ts`
- Create: `app/api/approvals/[id]/route.ts`

- [ ] **Step 1: 创建 `app/api/approvals/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext } from '@/lib/auth/get-user-role'
import { submitApprovalRequest, getPendingRequests, getMyRequests } from '@/lib/supabase/approval-queries'

export async function GET(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mine = searchParams.get('mine') === 'true'

  if (mine) {
    const requests = await getMyRequests(ctx.userId)
    return NextResponse.json(requests)
  }

  if (ctx.role === 'sales_rep') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const requests = await getPendingRequests(ctx.teamId)
  return NextResponse.json(requests)
}

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
  })
  return NextResponse.json(req, { status: 201 })
}
```

- [ ] **Step 2: 创建 `app/api/approvals/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext, isManager } from '@/lib/auth/get-user-role'
import { approveRequest, rejectRequest } from '@/lib/supabase/approval-queries'

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

  if (action === 'approve') {
    await approveRequest(id, ctx.userId)
  } else if (action === 'reject') {
    if (!rejectReason) {
      return NextResponse.json({ error: 'rejectReason is required' }, { status: 400 })
    }
    await rejectRequest(id, ctx.userId, rejectReason)
  } else {
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/approvals/
git commit -m "feat: add approvals API routes (submit, approve, reject)"
```

---

### Task 3: 审批列表组件

**Files:**
- Create: `components/admin/ApprovalList.tsx`
- Create: `components/admin/RejectDialog.tsx`

- [ ] **Step 1: 创建 `components/admin/RejectDialog.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export function RejectDialog({ open, onClose, onConfirm }: {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  function handleConfirm() {
    if (!reason.trim()) return
    onConfirm(reason.trim())
    setReason('')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>驳回原因</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>请填写驳回原因（将通知提交人）</Label>
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="请说明驳回原因..."
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={!reason.trim()} variant="destructive">
            确认驳回
          </Button>
          <Button variant="outline" onClick={onClose}>取消</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 创建 `components/admin/ApprovalList.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
    return <p className="text-sm text-muted-foreground py-8 text-center">暂无待审批内容</p>
  }

  return (
    <div className="space-y-3">
      {requests.map(req => (
        <div key={req.id} className="rounded-md border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{TYPE_LABELS[req.type] ?? req.type}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(req.created_at).toLocaleString('zh-CN')}
              </span>
            </div>
            <Badge variant={
              req.status === 'pending' ? 'secondary'
              : req.status === 'approved' ? 'default'
              : 'destructive'
            }>
              {req.status === 'pending' ? '待审批' : req.status === 'approved' ? '已通过' : '已驳回'}
            </Badge>
          </div>

          <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">
            {JSON.stringify(req.payload, null, 2)}
          </pre>

          {req.status === 'pending' && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleApprove(req.id)} disabled={loading === req.id}>
                通过
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejectTarget(req.id)} disabled={loading === req.id}>
                驳回
              </Button>
            </div>
          )}

          {req.status === 'rejected' && req.reject_reason && (
            <p className="text-xs text-destructive">驳回原因：{req.reject_reason}</p>
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
```

- [ ] **Step 3: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/ApprovalList.tsx components/admin/RejectDialog.tsx
git commit -m "feat: add ApprovalList and RejectDialog components"
```

---

### Task 4: 审批页面

**Files:**
- Create: `app/dashboard/admin/approvals/page.tsx`

- [ ] **Step 1: 创建文件**

```typescript
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
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">待审批</h1>
      <ApprovalList requests={requests} onUpdate={loadRequests} />
    </div>
  )
}
```

- [ ] **Step 2: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/admin/approvals/
git commit -m "feat: add approvals page"
```

---

### Task 5: 客户创建走审批流

**Files:**
- Modify: `app/dashboard/customers/page.tsx`

- [ ] **Step 1: 读取当前文件**

```bash
cat app/dashboard/customers/page.tsx
```

- [ ] **Step 2: 修改新建客户逻辑**

找到调用 `createCustomer` 的地方，在前面加角色判断：

```typescript
// 在组件顶部获取当前用户角色（通过 API 或 context）
// 假设已有 userRole: TeamRole

async function handleCreateCustomer(data: CustomerInsert) {
  if (userRole === 'sales_rep') {
    // 走审批流
    await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'create_customer',
        payload: data,
      }),
    })
    // 提示用户已提交审批
    toast('已提交审批，等待经理审核')
  } else {
    // 直接创建
    await createCustomer(data)
    loadCustomers()
  }
}
```

具体实现需根据当前文件中的表单提交逻辑调整。

- [ ] **Step 3: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/customers/page.tsx
git commit -m "feat: sales_rep customer creation goes through approval flow"
```

---

### Task 6: 项目创建和修改走审批流

**Files:**
- Modify: `app/dashboard/projects/page.tsx`

- [ ] **Step 1: 读取当前文件**

```bash
cat app/dashboard/projects/page.tsx
```

- [ ] **Step 2: 修改新建项目逻辑**

找到调用 `createProject` 的地方，加角色判断：

```typescript
async function handleCreateProject(data: ProjectInsert) {
  if (userRole === 'sales_rep') {
    await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'create_project', payload: data }),
    })
    toast('已提交审批，等待经理审核')
  } else {
    await createProject(data)
    loadProjects()
  }
}
```

- [ ] **Step 3: 修改项目关键字段更新逻辑**

关键字段为：`amount`（金额）、`status`（状态）、`expected_close_date`（预计关单日期）。

找到调用 `updateProject` 的地方，检查是否修改了关键字段：

```typescript
const KEY_FIELDS = ['amount', 'status', 'expected_close_date']

async function handleUpdateProject(id: string, updates: Partial<Project>) {
  const hasKeyField = KEY_FIELDS.some(f => f in updates)

  if (userRole === 'sales_rep' && hasKeyField) {
    await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'update_project',
        targetId: id,
        payload: updates,
      }),
    })
    toast('修改已提交审批，原数据继续生效')
  } else {
    await updateProject(id, updates)
    loadProjects()
  }
}
```

- [ ] **Step 4: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 手动测试**

以 sales_rep 账号登录：
1. 新建客户 → 不直接出现在列表，提示"已提交审批"
2. 新建项目 → 同上
3. 修改项目金额/状态/预计关单日期 → 提示"修改已提交审批，原数据继续生效"

以经理账号登录：
1. 进入 `/dashboard/admin/approvals` → 看到待审批列表
2. 点击"通过" → 客户/项目正式出现在列表中
3. 点击"驳回" → 填写原因后驳回

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/projects/page.tsx
git commit -m "feat: sales_rep project create/update key fields go through approval flow"
```

---

### Task 7: 侧边栏加审批入口

**Files:**
- Modify: `components/layout/SidebarNavigation.tsx`

- [ ] **Step 1: 在侧边栏加审批入口（经理/超管可见）**

在 Task 9 of Plan 02 已修改的超管入口附近，加经理也可见的审批入口：

```typescript
{isManager && (
  <NavLink href="/dashboard/admin/approvals" icon={ClipboardCheck}>
    待审批
    {pendingCount > 0 && (
      <span className="ml-auto text-xs bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5">
        {pendingCount}
      </span>
    )}
  </NavLink>
)}
```

`pendingCount` 通过 `fetch('/api/approvals')` 获取列表长度，在 SidebarNavigation 组件 mount 时请求一次。

- [ ] **Step 2: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/layout/SidebarNavigation.tsx
git commit -m "feat: add approvals nav link with pending count badge to sidebar"
```

---

## 自审检查

**规格覆盖：**
- ✅ sales_rep 新建客户 → 审批流
- ✅ sales_rep 新建项目 → 审批流
- ✅ sales_rep 修改项目关键字段（金额/状态/预计关单日期）→ 审批流
- ✅ 经理/超管操作直接生效，不走审批
- ✅ 审批通过后数据正式写入对应表
- ✅ 驳回需填写原因
- ✅ `/dashboard/admin/approvals` 审批列表页
- ✅ 侧边栏审批入口带待审批数量角标
- ✅ 提交人可见自己的待审批内容（`/api/approvals?mine=true`）

**不在本计划范围：**
- 审批人配置（超管在团队设置中配置审批角色，本期固定为 sales_manager + super_admin）
- 审批通知邮件
- 多级审批
