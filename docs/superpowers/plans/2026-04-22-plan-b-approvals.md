# 审批管理页面 实现计划（计划 B）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 升级审批系统：新增数据库表支持催办、扩展 API 支持 approval_cc 访问和全流程通知占位、新建审批管理页面（替换待审批）、更新侧边栏导航。

**Architecture:** DB 迁移新增 approval_urge_log → 扩展 approval-queries → 扩展 API 路由 → 新建审批管理页面（三区域视图）→ 更新 layout 导航。

**Tech Stack:** Next.js 15 App Router, Supabase, TypeScript, Tailwind CSS, shadcn/ui

**依赖：** 计划 A 已完成（team_members 有 approval_cc 字段，getUserTeamContext 返回 approvalCc）

---

## 文件改动清单

| 文件 | 操作 |
|------|------|
| `migrations/20260422_add_approval_urge_log.sql` | 新增 |
| `lib/supabase/approval-queries.ts` | 修改：新增 getAllRequests、urgeRequest、getUrgeLog |
| `app/api/approvals/route.ts` | 修改：GET 允许 approval_cc 访问 |
| `app/api/approvals/[id]/urge/route.ts` | 新增：催办接口 |
| `app/dashboard/approvals/page.tsx` | 新增：审批管理页面 |
| `app/dashboard/admin/approvals/page.tsx` | 修改：重定向到新路径 |
| `app/dashboard/layout.tsx` | 修改：导航菜单调整，面向全用户显示审批入口 |
| `components/layout/SidebarNavigation.tsx` | 修改：图标映射新增 ClipboardList |

---

### Task 1: 数据库迁移 — approval_urge_log

**Files:**
- Create: `migrations/20260422_add_approval_urge_log.sql`

- [ ] **Step 1: 创建迁移文件**

```sql
-- migrations/20260422_add_approval_urge_log.sql

CREATE TABLE IF NOT EXISTS approval_urge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL,
  urged_by UUID NOT NULL REFERENCES auth.users(id),
  urged_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_urge_log_approval_id
  ON approval_urge_log(approval_id, urged_at DESC);
```

- [ ] **Step 2: 在 Supabase Dashboard SQL Editor 执行**

执行上述 SQL，验证：
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name = 'approval_urge_log';
```
预期：返回一行。

- [ ] **Step 3: Commit**

```bash
git add migrations/20260422_add_approval_urge_log.sql
git commit -m "feat: 数据库迁移 — 新增 approval_urge_log 表"
```

---

### Task 2: 扩展 approval-queries

**Files:**
- Modify: `lib/supabase/approval-queries.ts`

- [ ] **Step 1: 新增 getAllRequests（管理员和 cc 用户查看所有审批）**

在文件末尾追加：

```typescript
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
```

- [ ] **Step 2: 新增 urgeRequest（催办，含 24h 限制检查）**

```typescript
export async function urgeRequest(params: {
  approvalId: string
  urgedBy: string
}): Promise<{ ok: true } | { error: 'cooldown'; nextAllowedAt: string }> {
  const supabase = createAdminClient()

  // 检查 24h 内是否已催过
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
```

- [ ] **Step 3: 新增 getLastUrge（查询某审批最近一次催办时间，用于前端显示冷却状态）**

```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/approval-queries.ts
git commit -m "feat: approval-queries 新增 getAllRequests、urgeRequest、getLastUrge"
```

---

### Task 3: 扩展 GET /api/approvals — 允许 approval_cc 访问

**Files:**
- Modify: `app/api/approvals/route.ts`

- [ ] **Step 1: 修改 GET 处理逻辑**

将 `app/api/approvals/route.ts` 中的 GET 函数替换为：

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext, isManager } from '@/lib/auth/get-user-role'
import { submitApprovalRequest, getPendingRequests, getMyRequests, getAllRequests } from '@/lib/supabase/approval-queries'

export async function GET(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mine = searchParams.get('mine') === 'true'

  if (mine) {
    const requests = await getMyRequests(ctx.userId)
    return NextResponse.json(requests)
  }

  // manager 或 approval_cc 用户可查看全部审批
  if (isManager(ctx.role) || ctx.approvalCc) {
    const requests = await getAllRequests(ctx.teamId)
    return NextResponse.json(requests)
  }

  // sales_rep 无 cc 权限时只能看自己的
  const requests = await getMyRequests(ctx.userId)
  return NextResponse.json(requests)
}
```

保留 POST 函数不变。

- [ ] **Step 2: Commit**

```bash
git add app/api/approvals/route.ts
git commit -m "feat: GET /api/approvals 允许 approval_cc 用户访问"
```

---

### Task 4: 新增 POST /api/approvals/[id]/urge

**Files:**
- Create: `app/api/approvals/[id]/urge/route.ts`

- [ ] **Step 1: 创建催办接口**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/approvals/[id]/urge/route.ts"
git commit -m "feat: 新增 POST /api/approvals/[id]/urge 催办接口"
```

---

### Task 5: 新建审批管理页面

**Files:**
- Create: `app/dashboard/approvals/page.tsx`

- [ ] **Step 1: 创建页面**

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
  const labels: Record<string, string> = { pending: '待审批', approved: '已通过', rejected: '已驳回' }
  return (
    <Badge className={`rounded-full text-xs border ${map[status] ?? ''}`}>
      {labels[status] ?? status}
    </Badge>
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

  const pendingForMe = requests.filter(r => r.status === 'pending')
  const tabs = [
    ...(isManager ? [{ key: 'pending' as const, label: `待我处理 (${pendingForMe.length})` }] : []),
    { key: 'mine' as const, label: '我发起的' },
    ...((isManager || approvalCc) ? [{ key: 'all' as const, label: '全部审批' }] : []),
  ]

  // 默认 tab
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

      {/* Tab 切换 */}
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

      {/* 列表 */}
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
              canApprove={isManager && req.status === 'pending'}
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
git commit -m "feat: 新增审批管理页面，支持待我处理/我发起的/全部审批三区域视图"
```

---

### Task 6: 旧审批页重定向 + 更新导航

**Files:**
- Modify: `app/dashboard/admin/approvals/page.tsx`
- Modify: `app/dashboard/layout.tsx`
- Modify: `components/layout/SidebarNavigation.tsx`

- [ ] **Step 1: 旧页面重定向**

将 `app/dashboard/admin/approvals/page.tsx` 替换为：

```typescript
import { redirect } from 'next/navigation'

export default function OldApprovalsPage() {
  redirect('/dashboard/approvals')
}
```

- [ ] **Step 2: 更新 layout.tsx 导航**

在 `app/dashboard/layout.tsx` 中，找到导航数组，做以下修改：

1. 在"仪表板"后面新增收件箱占位（计划 C 实现，这里先加入导航项）
2. 将"待审批"改为面向全用户显示，路径改为 `/dashboard/approvals`

将原来的：
```typescript
const navigation = [
  { name: '仪表板', href: '/dashboard', iconName: 'LayoutDashboard' },
  { name: '客户', href: '/dashboard/customers', iconName: 'Users' },
  { name: '项目', href: '/dashboard/projects', iconName: 'FolderKanban' },
  { name: '进展', href: '/dashboard/updates', iconName: 'FileText' },
  { name: '任务', href: '/dashboard/tasks', iconName: 'CheckSquare' },
  { name: '设置', href: '/dashboard/settings', iconName: 'Settings' },
  ...(ctx?.role === 'super_admin' || ctx?.role === 'sales_manager' ? [
    { name: '待审批', href: '/dashboard/admin/approvals', iconName: 'ClipboardCheck', showPendingBadge: true },
  ] : []),
  ...(ctx?.role === 'super_admin' ? [
    { name: '成员管理', href: '/dashboard/admin/users', iconName: 'UserCog' },
    { name: '数据字典', href: '/dashboard/admin/dictionary', iconName: 'BookOpen' },
  ] : []),
]
```

替换为：
```typescript
const navigation = [
  { name: '仪表板', href: '/dashboard', iconName: 'LayoutDashboard' },
  { name: '客户', href: '/dashboard/customers', iconName: 'Users' },
  { name: '项目', href: '/dashboard/projects', iconName: 'FolderKanban' },
  { name: '进展', href: '/dashboard/updates', iconName: 'FileText' },
  { name: '任务', href: '/dashboard/tasks', iconName: 'CheckSquare' },
  { name: '审批管理', href: '/dashboard/approvals', iconName: 'ClipboardCheck', showPendingBadge: true },
  { name: '设置', href: '/dashboard/settings', iconName: 'Settings' },
  ...(ctx?.role === 'super_admin' ? [
    { name: '成员管理', href: '/dashboard/admin/users', iconName: 'UserCog' },
    { name: '数据字典', href: '/dashboard/admin/dictionary', iconName: 'BookOpen' },
  ] : []),
]
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/admin/approvals/page.tsx app/dashboard/layout.tsx
git commit -m "feat: 审批管理入口面向全用户，旧路径重定向到新页面"
```
