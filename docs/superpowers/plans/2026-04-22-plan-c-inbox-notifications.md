# 收件箱与通知系统 实现计划（计划 C）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 inbox_notifications 表，实现审批全流程通知写入、浏览器通知登录补推、收件箱页面及侧边栏入口，并将任务/节点提醒接入收件箱。

**Architecture:** DB 新增 inbox_notifications → inbox-queries 工具函数 → 各 API 路由写通知 → BrowserNotificationProvider 处理权限与补推 → 收件箱页面 → TasksContext/dashboard page 写任务/节点提醒。

**Tech Stack:** Next.js 15 App Router, Supabase, TypeScript, Tailwind CSS, shadcn/ui, Web Notifications API

**依赖：** 计划 A（approval_cc/data_scope）和计划 B（approval_urge_log、审批管理页面、getAllRequests/urgeRequest）已完成。

---

## 文件改动清单

| 文件 | 操作 |
|------|------|
| `migrations/20260422_add_inbox_notifications.sql` | 新增 |
| `types/index.ts` | 修改：新增 InboxNotification 类型 |
| `lib/supabase/inbox-queries.ts` | 新增：writeNotification、writeNotifications、getNotifications、getUnreadCount、markRead、getBrowserUnpushed、markBrowserPushed、getTeamManagers、getTeamCcUsers |
| `app/api/inbox/route.ts` | 新增：GET 列表/计数、POST 写通知 |
| `app/api/inbox/[id]/read/route.ts` | 新增：PATCH 标记已读 |
| `app/api/inbox/mark-pushed/route.ts` | 新增：POST 批量标记 browser_pushed=true |
| `app/api/approvals/route.ts` | 修改：POST 写 approval_submitted 通知给 manager |
| `app/api/approvals/[id]/route.ts` | 修改：PATCH 写 approval_approved/rejected/cc 通知 |
| `app/api/approvals/[id]/urge/route.ts` | 修改：POST 写 approval_urge_received 通知 |
| `components/layout/BrowserNotificationProvider.tsx` | 新增：请求权限 + 登录补推 |
| `app/dashboard/layout.tsx` | 修改：加入 BrowserNotificationProvider + 收件箱导航项 |
| `app/dashboard/inbox/page.tsx` | 新增：收件箱页面 |
| `components/layout/SidebarNavigation.tsx` | 修改：新增 Inbox 图标、showInboxBadge 支持 |
| `context/TasksContext.tsx` | 修改：overdue/upcoming 任务写入 inbox |
| `app/dashboard/page.tsx` | 修改：节点提醒写入 inbox |

---

### Task 1: 数据库迁移 — inbox_notifications

**Files:**
- Create: `migrations/20260422_add_inbox_notifications.sql`

- [ ] **Step 1: 创建迁移文件**

```sql
-- migrations/20260422_add_inbox_notifications.sql

CREATE TABLE IF NOT EXISTS inbox_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN (
    'task_overdue', 'task_upcoming', 'milestone',
    'approval_submitted', 'approval_approved', 'approval_rejected',
    'approval_cc', 'approval_urge', 'approval_urge_received'
  )),
  title TEXT NOT NULL,
  body TEXT,
  link_type TEXT CHECK (link_type IN ('task', 'approval', 'project')),
  link_id TEXT,
  is_read BOOLEAN DEFAULT false,
  browser_pushed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_notifications_user_created
  ON inbox_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_notifications_unpushed
  ON inbox_notifications(user_id, browser_pushed)
  WHERE browser_pushed = false;

ALTER TABLE inbox_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON inbox_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON inbox_notifications FOR UPDATE
  USING (auth.uid() = user_id);
```

- [ ] **Step 2: 在 Supabase Dashboard SQL Editor 执行，验证**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name = 'inbox_notifications';
-- 预期：返回一行
```

- [ ] **Step 3: Commit**

```bash
git add migrations/20260422_add_inbox_notifications.sql
git commit -m "feat: 数据库迁移 — 新增 inbox_notifications 表"
```

---

### Task 2: types/index.ts 新增 InboxNotification 类型

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: 在 types/index.ts 末尾追加**

```typescript
export type InboxNotificationType =
  | 'task_overdue'
  | 'task_upcoming'
  | 'milestone'
  | 'approval_submitted'
  | 'approval_approved'
  | 'approval_rejected'
  | 'approval_cc'
  | 'approval_urge'
  | 'approval_urge_received'

export type InboxLinkType = 'task' | 'approval' | 'project'

export type InboxNotification = {
  id: string
  user_id: string
  type: InboxNotificationType
  title: string
  body: string | null
  link_type: InboxLinkType | null
  link_id: string | null
  is_read: boolean
  browser_pushed: boolean
  created_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: types 新增 InboxNotification"
```

---

### Task 3: lib/supabase/inbox-queries.ts

**Files:**
- Create: `lib/supabase/inbox-queries.ts`

- [ ] **Step 1: 创建文件**

```typescript
import { createClient } from '@supabase/supabase-js'
import type { InboxNotification, InboxNotificationType, InboxLinkType } from '@/types'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function writeNotification(params: {
  userId: string
  type: InboxNotificationType
  title: string
  body?: string
  linkType?: InboxLinkType
  linkId?: string
}): Promise<void> {
  const supabase = createAdminClient()
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
  const supabase = createAdminClient()
  const { error } = await supabase.from('inbox_notifications').insert(
    notifications.map(n => ({
      user_id: n.userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link_type: n.linkType ?? null,
      link_id: n.linkId ?? null,
    }))
  )
  if (error) throw error
}

export async function getNotifications(userId: string): Promise<InboxNotification[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('inbox_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createAdminClient()
  const { count, error } = await supabase
    .from('inbox_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw error
  return count ?? 0
}

export async function markRead(id: string, userId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('inbox_notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function markBrowserPushed(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('inbox_notifications')
    .update({ browser_pushed: true })
    .in('id', ids)
  if (error) throw error
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/inbox-queries.ts
git commit -m "feat: 新增 inbox-queries 工具函数"
```

---

### Task 4: /api/inbox 路由

**Files:**
- Create: `app/api/inbox/route.ts`
- Create: `app/api/inbox/[id]/read/route.ts`
- Create: `app/api/inbox/mark-pushed/route.ts`

- [ ] **Step 1: 创建 app/api/inbox/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext } from '@/lib/auth/get-user-role'
import { getNotifications, getUnreadCount, writeNotification } from '@/lib/supabase/inbox-queries'
import type { InboxNotificationType, InboxLinkType } from '@/types'

export async function GET(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)

  if (searchParams.get('count') === 'true') {
    const unread = await getUnreadCount(ctx.userId)
    return NextResponse.json({ unread })
  }

  const notifications = await getNotifications(ctx.userId)
  return NextResponse.json(notifications)
}

export async function POST(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { type, title, body: bodyText, linkType, linkId } = body as {
    type: InboxNotificationType
    title: string
    body?: string
    linkType?: InboxLinkType
    linkId?: string
  }

  if (!type || !title) {
    return NextResponse.json({ error: 'type and title are required' }, { status: 400 })
  }

  await writeNotification({
    userId: ctx.userId,
    type,
    title,
    body: bodyText,
    linkType,
    linkId,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
```

- [ ] **Step 2: 创建 app/api/inbox/[id]/read/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext } from '@/lib/auth/get-user-role'
import { markRead } from '@/lib/supabase/inbox-queries'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await markRead(id, ctx.userId)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: 创建 app/api/inbox/mark-pushed/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext } from '@/lib/auth/get-user-role'
import { markBrowserPushed, getNotifications } from '@/lib/supabase/inbox-queries'

export async function POST(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await request.json() as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  // 安全检查：只能标记属于当前用户的通知
  const notifications = await getNotifications(ctx.userId)
  const ownIds = new Set(notifications.map(n => n.id))
  const safeIds = ids.filter(id => ownIds.has(id))

  await markBrowserPushed(safeIds)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/inbox/route.ts "app/api/inbox/[id]/read/route.ts" app/api/inbox/mark-pushed/route.ts
git commit -m "feat: 新增 /api/inbox 路由（列表/写入/标记已读/标记已推送）"
```

---

### Task 5: POST /api/approvals 写 approval_submitted 通知

**Files:**
- Modify: `app/api/approvals/route.ts`

- [ ] **Step 1: 替换 app/api/approvals/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext, isManager } from '@/lib/auth/get-user-role'
import { submitApprovalRequest, getMyRequests, getAllRequests } from '@/lib/supabase/approval-queries'
import { writeNotifications, getTeamManagers } from '@/lib/supabase/inbox-queries'

const TYPE_LABELS: Record<string, string> = {
  create_customer: '新建客户',
  create_project: '新建项目',
  update_project: '修改项目',
}

export async function GET(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mine = searchParams.get('mine') === 'true'

  if (mine) {
    const requests = await getMyRequests(ctx.userId)
    return NextResponse.json(requests)
  }

  if (isManager(ctx.role) || ctx.approvalCc) {
    const requests = await getAllRequests(ctx.teamId)
    return NextResponse.json(requests)
  }

  const requests = await getMyRequests(ctx.userId)
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

  // 通知所有 manager
  const managers = await getTeamManagers(ctx.teamId)
  const label = TYPE_LABELS[type] ?? type
  const name = (payload?.name as string) ?? ''
  const subject = name ? `${label}：${name}` : label
  await writeNotifications(
    managers.map(uid => ({
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

- [ ] **Step 2: Commit**

```bash
git add app/api/approvals/route.ts
git commit -m "feat: POST /api/approvals 提交审批时写 approval_submitted 通知给 manager"
```

---

### Task 6: PATCH /api/approvals/[id] 写通过/驳回通知

**Files:**
- Modify: `app/api/approvals/[id]/route.ts`

- [ ] **Step 1: 替换 app/api/approvals/[id]/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext, isManager } from '@/lib/auth/get-user-role'
import { approveRequest, rejectRequest } from '@/lib/supabase/approval-queries'
import { writeNotification, writeNotifications, getTeamCcUsers } from '@/lib/supabase/inbox-queries'
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
    .select('submitted_by, type, payload')
    .eq('id', id)
    .single()
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const label = TYPE_LABELS[req.type] ?? req.type
  const name = (req.payload as Record<string, unknown>)?.name as string ?? ''
  const subject = name ? `${label}：${name}` : label

  if (action === 'approve') {
    await approveRequest(id, ctx.userId)

    await writeNotification({
      userId: req.submitted_by,
      type: 'approval_approved',
      title: '审批通过',
      body: `你发起的「${subject}」已通过`,
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
git commit -m "feat: PATCH /api/approvals/[id] 通过/驳回时写全流程通知"
```

---

### Task 7: POST /api/approvals/[id]/urge 写催办通知

**Files:**
- Modify: `app/api/approvals/[id]/urge/route.ts`

- [ ] **Step 1: 替换催办接口，催办成功时写 approval_urge_received 通知**

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext } from '@/lib/auth/get-user-role'
import { urgeRequest } from '@/lib/supabase/approval-queries'
import { writeNotifications, getTeamManagers } from '@/lib/supabase/inbox-queries'
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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()
  const { data: req } = await supabase
    .from('approval_requests')
    .select('submitted_by, status, type, payload')
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

  const managers = await getTeamManagers(ctx.teamId)
  const label = TYPE_LABELS[req.type] ?? req.type
  const name = (req.payload as Record<string, unknown>)?.name as string ?? ''
  const subject = name ? `${label}：${name}` : label
  await writeNotifications(
    managers.map(uid => ({
      userId: uid,
      type: 'approval_urge_received' as const,
      title: '催办提醒',
      body: `「${subject}」发起人催你处理`,
      linkType: 'approval' as const,
      linkId: id,
    }))
  )

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/approvals/[id]/urge/route.ts"
git commit -m "feat: 催办成功时写 approval_urge_received 通知给 manager"
```

---

### Task 8: BrowserNotificationProvider + layout.tsx 集成

**Files:**
- Create: `components/layout/BrowserNotificationProvider.tsx`
- Modify: `app/dashboard/layout.tsx`

- [ ] **Step 1: 创建 components/layout/BrowserNotificationProvider.tsx**

```typescript
'use client'

import { useEffect } from 'react'
import type { InboxNotification } from '@/types'

export function BrowserNotificationProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }

    async function pushUnpushed() {
      if (Notification.permission !== 'granted') return
      try {
        const res = await fetch('/api/inbox')
        if (!res.ok) return
        const notifications: InboxNotification[] = await res.json()
        const unpushed = notifications.filter(n => !n.browser_pushed)
        if (unpushed.length === 0) return

        unpushed.forEach(n => {
          new Notification(n.title, {
            body: n.body ?? undefined,
            icon: '/favicon.ico',
            tag: n.id,
          })
        })

        await fetch('/api/inbox/mark-pushed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: unpushed.map(n => n.id) }),
        })
      } catch {
        // 网络错误时静默失败
      }
    }

    pushUnpushed()
  }, [])

  return <>{children}</>
}
```

- [ ] **Step 2: 替换 app/dashboard/layout.tsx**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SidebarNavigation } from '@/components/layout/SidebarNavigation'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { MobileSidebar } from '@/components/layout/MobileSidebar'
import { TasksProviderWrapper } from '@/components/layout/TasksProvider'
import { BrowserNotificationProvider } from '@/components/layout/BrowserNotificationProvider'
import { getUserTeamContext } from '@/lib/auth/get-user-role'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const ctx = await getUserTeamContext()

  if (!ctx) {
    redirect('/disabled')
  }

  const isManager = ctx.role === 'super_admin' || ctx.role === 'sales_manager'

  const navigation = [
    { name: '仪表板', href: '/dashboard', iconName: 'LayoutDashboard' },
    { name: '客户', href: '/dashboard/customers', iconName: 'Users' },
    { name: '项目', href: '/dashboard/projects', iconName: 'FolderKanban' },
    { name: '进展', href: '/dashboard/updates', iconName: 'FileText' },
    { name: '任务', href: '/dashboard/tasks', iconName: 'CheckSquare' },
    { name: '审批管理', href: '/dashboard/approvals', iconName: 'ClipboardCheck', showPendingBadge: isManager },
    { name: '收件箱', href: '/dashboard/inbox', iconName: 'Inbox', showInboxBadge: true },
    { name: '设置', href: '/dashboard/settings', iconName: 'Settings' },
    ...(ctx.role === 'super_admin' ? [
      { name: '成员管理', href: '/dashboard/admin/users', iconName: 'UserCog' },
      { name: '数据字典', href: '/dashboard/admin/dictionary', iconName: 'BookOpen' },
    ] : []),
  ]

  return (
    <div className="min-h-screen bg-[#f0f0f0]">
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-64 flex-col shadow-lg" style={{ backgroundColor: '#090702' }}>
        <div className="flex flex-col h-full">
          <div className="flex flex-col justify-center h-20 px-6" style={{ backgroundColor: '#090702' }}>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#ffffff', fontFamily: 'var(--font-poppins), sans-serif' }}>Sales to Do</h1>
            <p className="text-xs" style={{ color: '#999999' }}>销售个人任务管理工具</p>
          </div>
          <SidebarNavigation navigation={navigation} />
          <div className="p-4">
            <LogoutButton />
          </div>
        </div>
      </aside>

      <MobileSidebar navigation={navigation} />

      <BrowserNotificationProvider>
        <TasksProviderWrapper>
          <div className="md:pl-64">
            <main className="min-h-screen">
              {children}
            </main>
          </div>
        </TasksProviderWrapper>
      </BrowserNotificationProvider>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/layout/BrowserNotificationProvider.tsx app/dashboard/layout.tsx
git commit -m "feat: 新增 BrowserNotificationProvider 登录补推 + 收件箱导航项"
```

---

### Task 9: 收件箱页面 /dashboard/inbox

**Files:**
- Create: `app/dashboard/inbox/page.tsx`

- [ ] **Step 1: 创建收件箱页面**

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Bell, CheckCircle, Clock, AlertCircle, ClipboardCheck, FolderKanban, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { InboxNotification } from '@/types'

const LINK_TARGETS: Record<string, string> = {
  task_overdue: '/dashboard/tasks',
  task_upcoming: '/dashboard/tasks',
  milestone: '/dashboard/projects',
  approval_submitted: '/dashboard/approvals',
  approval_approved: '/dashboard/approvals',
  approval_rejected: '/dashboard/approvals',
  approval_cc: '/dashboard/approvals',
  approval_urge: '/dashboard/approvals',
  approval_urge_received: '/dashboard/approvals',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  task_overdue: <AlertCircle className="w-4 h-4 text-rose-500" />,
  task_upcoming: <Clock className="w-4 h-4 text-zinc-400" />,
  milestone: <FolderKanban className="w-4 h-4 text-blue-500" />,
  approval_submitted: <ClipboardCheck className="w-4 h-4 text-zinc-600" />,
  approval_approved: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  approval_rejected: <AlertCircle className="w-4 h-4 text-rose-500" />,
  approval_cc: <Bell className="w-4 h-4 text-zinc-500" />,
  approval_urge: <Bell className="w-4 h-4 text-amber-500" />,
  approval_urge_received: <Bell className="w-4 h-4 text-amber-500" />,
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

function NotifItem({
  notif,
  onMarkRead,
}: {
  notif: InboxNotification
  onMarkRead: (id: string) => void
}) {
  const router = useRouter()
  const target = LINK_TARGETS[notif.type]

  async function doMarkRead() {
    if (!notif.is_read) {
      await fetch(`/api/inbox/${notif.id}/read`, { method: 'PATCH' })
      onMarkRead(notif.id)
    }
  }

  return (
    <div
      onClick={doMarkRead}
      className={`flex items-start gap-3 p-4 rounded-2xl cursor-pointer transition-colors ${
        notif.is_read ? 'bg-white hover:bg-zinc-50' : 'bg-blue-50 hover:bg-blue-100/60'
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {TYPE_ICONS[notif.type] ?? <Bell className="w-4 h-4 text-zinc-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm font-medium truncate ${notif.is_read ? 'text-zinc-700' : 'text-zinc-900'}`}>
            {notif.title}
          </p>
          <span className="text-xs text-zinc-400 shrink-0">{timeAgo(notif.created_at)}</span>
        </div>
        {notif.body && (
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{notif.body}</p>
        )}
      </div>
      {target && (
        <button
          onClick={async e => {
            e.stopPropagation()
            await doMarkRead()
            router.push(target)
          }}
          className="shrink-0 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors mt-0.5"
        >
          去处理 <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

export default function InboxPage() {
  const [notifications, setNotifications] = useState<InboxNotification[]>([])
  const [tab, setTab] = useState<'unread' | 'all'>('unread')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch('/api/inbox')
    if (res.ok) setNotifications(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const unreadCount = notifications.filter(n => !n.is_read).length
  const displayed = tab === 'unread' ? notifications.filter(n => !n.is_read) : notifications

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">收件箱</h1>
        <p className="mt-2 text-zinc-500 text-sm">所有通知和提醒记录</p>
      </div>

      <div className="flex gap-2 mb-6">
        {([
          { key: 'unread' as const, label: `未读 (${unreadCount})` },
          { key: 'all' as const, label: '全部' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-zinc-900 text-white'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-zinc-400 text-sm">加载中...</div>
      ) : displayed.length === 0 ? (
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="text-center py-16">
            <CheckCircle className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">{tab === 'unread' ? '暂无未读通知' : '暂无通知'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {displayed.map(n => (
            <NotifItem key={n.id} notif={n} onMarkRead={markRead} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/inbox/page.tsx
git commit -m "feat: 新增收件箱页面，支持未读/全部 tab 及标记已读"
```

---

### Task 10: SidebarNavigation 新增 Inbox 图标与 showInboxBadge

**Files:**
- Modify: `components/layout/SidebarNavigation.tsx`

- [ ] **Step 1: 替换 components/layout/SidebarNavigation.tsx**

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  CheckSquare,
  Settings,
  UserCog,
  BookOpen,
  ClipboardCheck,
  Inbox,
  LucideIcon
} from 'lucide-react'

interface NavigationItem {
  name: string
  href: string
  iconName: string
  showPendingBadge?: boolean
  showInboxBadge?: boolean
}

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  CheckSquare,
  Settings,
  UserCog,
  BookOpen,
  ClipboardCheck,
  Inbox,
}

export function SidebarNavigation({ navigation }: { navigation: NavigationItem[] }) {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [inboxCount, setInboxCount] = useState(0)

  const hasPendingBadge = navigation.some(n => n.showPendingBadge)
  const hasInboxBadge = navigation.some(n => n.showInboxBadge)

  useEffect(() => {
    if (!hasPendingBadge) return
    fetch('/api/approvals')
      .then(r => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setPendingCount(data.filter((r: any) => r.status === 'pending').length)
        }
      })
      .catch(() => {})
  }, [hasPendingBadge])

  useEffect(() => {
    if (!hasInboxBadge) return
    fetch('/api/inbox?count=true')
      .then(r => r.json())
      .then((data: unknown) => {
        if (data && typeof data === 'object' && 'unread' in data) {
          setInboxCount((data as { unread: number }).unread)
        }
      })
      .catch(() => {})
  }, [hasInboxBadge])

  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {navigation.map((item) => {
        const Icon = iconMap[item.iconName]
        if (!Icon) return null

        const isActive = pathname === item.href
        const badge = item.showPendingBadge ? pendingCount : item.showInboxBadge ? inboxCount : 0

        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center px-3 py-2.5 pr-4 text-sm font-medium rounded-full transition-all duration-200 ease-in-out ${
              isActive
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <Icon className={`w-4.5 h-4.5 mr-4 transition-colors duration-200 ease-in-out ${
              isActive ? 'text-white' : 'text-zinc-500'
            }`} />
            {item.name}
            {badge > 0 && (
              <span className="ml-auto text-xs bg-rose-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                {badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/SidebarNavigation.tsx
git commit -m "feat: SidebarNavigation 新增 Inbox 图标和收件箱未读角标"
```

---

### Task 11: TasksContext 写 task_overdue/task_upcoming 通知

**Files:**
- Modify: `context/TasksContext.tsx`

- [ ] **Step 1: 替换 context/TasksContext.tsx**

用 `localStorage` key `inbox_task_written_YYYY-MM-DD` 记录当天已写通知的任务 ID，避免每次刷新重复写入。

```typescript
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getUpcomingTasks, getUserSettings } from '@/lib/supabase/queries'

interface TaskWithProject {
  id: string
  project_id: string
  title: string
  due_date: string | null
  status: string
  projects?: { name: string } | null
}

interface TasksContextType {
  overdueTasks: TaskWithProject[]
  upcomingTasks: TaskWithProject[]
  thisWeekTasks: TaskWithProject[]
  loading: boolean
  refresh: () => void
}

const TasksContext = createContext<TasksContextType>({
  overdueTasks: [],
  upcomingTasks: [],
  thisWeekTasks: [],
  loading: true,
  refresh: () => {}
})

export function useTasks() {
  return useContext(TasksContext)
}

function getTodayKey() {
  return `inbox_task_written_${new Date().toISOString().slice(0, 10)}`
}

function getWrittenToday(): Set<string> {
  try {
    const raw = localStorage.getItem(getTodayKey())
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function markWrittenToday(ids: string[]) {
  const key = getTodayKey()
  const existing = getWrittenToday()
  ids.forEach(id => existing.add(id))
  localStorage.setItem(key, JSON.stringify([...existing]))
}

async function writeTaskNotifications(
  overdue: TaskWithProject[],
  upcoming: TaskWithProject[]
) {
  const written = getWrittenToday()
  const toWrite: Array<{ type: string; title: string; body: string; linkId: string }> = []
  const newIds: string[] = []

  overdue.forEach(task => {
    const sid = `overdue_${task.id}`
    if (!written.has(sid)) {
      toWrite.push({
        type: 'task_overdue',
        title: '任务已过期',
        body: `「${task.title}」已过期`,
        linkId: task.id,
      })
      newIds.push(sid)
    }
  })

  upcoming.forEach(task => {
    const sid = `upcoming_${task.id}`
    if (!written.has(sid)) {
      const dateStr = task.due_date
        ? new Date(task.due_date).toLocaleDateString('zh-CN')
        : ''
      toWrite.push({
        type: 'task_upcoming',
        title: '任务即将到期',
        body: `「${task.title}」即将在 ${dateStr} 到期`,
        linkId: task.id,
      })
      newIds.push(sid)
    }
  })

  if (toWrite.length === 0) return

  await Promise.all(
    toWrite.map(n =>
      fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: n.type,
          title: n.title,
          body: n.body,
          linkType: 'task',
          linkId: n.linkId,
        }),
      })
    )
  )

  markWrittenToday(newIds)
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const [overdueTasks, setOverdueTasks] = useState<TaskWithProject[]>([])
  const [upcomingTasks, setUpcomingTasks] = useState<TaskWithProject[]>([])
  const [thisWeekTasks, setThisWeekTasks] = useState<TaskWithProject[]>([])
  const [loading, setLoading] = useState(true)

  const loadTasks = async () => {
    try {
      const settings = await getUserSettings()
      const reminderHours = settings?.reminder_advance_hours ?? 24
      const data = await getUpcomingTasks(undefined, reminderHours)
      const overdue = data.overdue as TaskWithProject[]
      const upcoming = data.upcoming as TaskWithProject[]
      setOverdueTasks(overdue)
      setUpcomingTasks(upcoming)
      setThisWeekTasks(data.thisWeek as TaskWithProject[])
      writeTaskNotifications(overdue, upcoming).catch(() => {})
    } catch (error) {
      console.error('加载任务失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  return (
    <TasksContext.Provider value={{ overdueTasks, upcomingTasks, thisWeekTasks, loading, refresh: loadTasks }}>
      {children}
    </TasksContext.Provider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add context/TasksContext.tsx
git commit -m "feat: TasksContext 过期/即将到期任务写入 inbox（localStorage 每日去重）"
```

---

### Task 12: dashboard/page.tsx 节点提醒写入 inbox

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: 在 loadData 中，将以下两行**

```typescript
      setMonthlyProjects(buildProjectGroups(future30))
      setNotifProjects(buildProjectGroups(futureNotif))
```

**替换为：**

```typescript
      setMonthlyProjects(buildProjectGroups(future30))
      const notifResult = buildProjectGroups(futureNotif)
      setNotifProjects(notifResult)

      // 节点提醒写 inbox（每日去重）
      const milestoneKey = `inbox_milestone_written_${new Date().toISOString().slice(0, 10)}`
      const writtenMilestones = new Set<string>(
        JSON.parse(localStorage.getItem(milestoneKey) ?? '[]')
      )
      const milestoneWrites: Array<{ type: string; title: string; body: string; linkId: string }> = []
      const newMilestoneIds: string[] = []

      notifResult.toSign.forEach((p: any) => {
        const sid = `sign_${p.id}`
        if (!writtenMilestones.has(sid)) {
          const dateStr = p.expected_close_date
            ? new Date(p.expected_close_date).toLocaleDateString('zh-CN') : ''
          milestoneWrites.push({ type: 'milestone', title: '签约提醒', body: `项目「${p.name}」计划 ${dateStr} 签约`, linkId: p.id })
          newMilestoneIds.push(sid)
        }
      })
      notifResult.toAccept.forEach((p: any) => {
        const sid = `accept_${p.id}`
        if (!writtenMilestones.has(sid)) {
          const dateStr = p.pendingStages[0]?.planned_accepted_date
            ? new Date(p.pendingStages[0].planned_accepted_date).toLocaleDateString('zh-CN') : ''
          milestoneWrites.push({ type: 'milestone', title: '验收提醒', body: `项目「${p.name}」计划 ${dateStr} 验收`, linkId: p.id })
          newMilestoneIds.push(sid)
        }
      })
      notifResult.toInvoice.forEach((p: any) => {
        const sid = `invoice_${p.id}`
        if (!writtenMilestones.has(sid)) {
          const dateStr = p.pendingStages[0]?.planned_invoiced_date
            ? new Date(p.pendingStages[0].planned_invoiced_date).toLocaleDateString('zh-CN') : ''
          milestoneWrites.push({ type: 'milestone', title: '开票提醒', body: `项目「${p.name}」计划 ${dateStr} 开票`, linkId: p.id })
          newMilestoneIds.push(sid)
        }
      })
      notifResult.toPayment.forEach((p: any) => {
        const sid = `payment_${p.id}`
        if (!writtenMilestones.has(sid)) {
          const dateStr = p.pendingStages[0]?.planned_paid_date
            ? new Date(p.pendingStages[0].planned_paid_date).toLocaleDateString('zh-CN') : ''
          milestoneWrites.push({ type: 'milestone', title: '回款提醒', body: `项目「${p.name}」计划 ${dateStr} 回款`, linkId: p.id })
          newMilestoneIds.push(sid)
        }
      })

      if (milestoneWrites.length > 0) {
        Promise.all(
          milestoneWrites.map(n =>
            fetch('/api/inbox', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: n.type, title: n.title, body: n.body, linkType: 'project', linkId: n.linkId }),
            })
          )
        ).then(() => {
          const updated = new Set([...writtenMilestones, ...newMilestoneIds])
          localStorage.setItem(milestoneKey, JSON.stringify([...updated]))
        }).catch(() => {})
      }
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: 仪表板节点提醒写入 inbox（localStorage 每日去重）"
```
