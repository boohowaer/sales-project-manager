# 分派 + 视图切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为经理和超管提供跨成员分派客户/项目/任务的能力，并在列表页加入"查看全团队"切换开关，切换状态持久化到 localStorage。

**Architecture:** 分派通过 PATCH API 更新记录的 `user_id`，同时写入 `assignment_logs`；视图切换用自定义 hook `useTeamView` 管理状态，列表查询根据 viewMode 决定是否加 `user_id` 过滤。

**Tech Stack:** Next.js 15 App Router, Supabase, TypeScript, shadcn/ui, Tailwind CSS

---

## 文件结构

**新建：**
- `app/api/admin/assign/route.ts` — POST 分派操作
- `hooks/useTeamView.ts` — 视图切换状态 hook（localStorage）
- `components/admin/AssignDialog.tsx` — 分派成员选择对话框

**修改：**
- `lib/supabase/queries.ts` — getCustomers/getProjects/getTasks 支持 `teamView` 参数
- `app/dashboard/customers/page.tsx` — 加视图切换 + 分派按钮
- `app/dashboard/projects/page.tsx` — 加视图切换 + 分派按钮
- `app/dashboard/tasks/page.tsx` — 加视图切换 + 分派按钮

---

### Task 1: useTeamView hook

**Files:**
- Create: `hooks/useTeamView.ts`

- [ ] **Step 1: 创建文件**

```typescript
'use client'
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'team_view_mode'

export type ViewMode = 'mine' | 'team'

export function useTeamView() {
  const [viewMode, setViewMode] = useState<ViewMode>('mine')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'team') setViewMode('team')
  }, [])

  function toggle() {
    setViewMode(prev => {
      const next: ViewMode = prev === 'mine' ? 'team' : 'mine'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }

  return { viewMode, toggle }
}
```

- [ ] **Step 2: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add hooks/useTeamView.ts
git commit -m "feat: add useTeamView hook with localStorage persistence"
```

---

### Task 2: 分派 API

**Files:**
- Create: `app/api/admin/assign/route.ts`

- [ ] **Step 1: 在 `lib/supabase/admin-queries.ts` 末尾追加分派查询函数**

```typescript
// ─── 分派 ───────────────────────────────────────────────────

export async function assignResource(params: {
  teamId: string
  resourceType: 'customer' | 'project' | 'task'
  resourceId: string
  assignedFrom: string | null
  assignedTo: string
  operatedBy: string
}): Promise<void> {
  const supabase = createAdminClient()

  // 更新记录的 user_id
  const table = params.resourceType === 'customer' ? 'customers'
    : params.resourceType === 'project' ? 'projects' : 'tasks'

  const { error: updateError } = await supabase
    .from(table)
    .update({ user_id: params.assignedTo })
    .eq('id', params.resourceId)
  if (updateError) throw updateError

  // 写入操作日志
  const { error: logError } = await supabase
    .from('assignment_logs')
    .insert({
      team_id: params.teamId,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      assigned_from: params.assignedFrom,
      assigned_to: params.assignedTo,
      operated_by: params.operatedBy,
    })
  if (logError) throw logError
}

export async function getTeamActiveMembers(teamId: string): Promise<{ id: string; user_id: string; email: string; role: string }[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('team_members')
    .select('id, user_id, role, users:user_id(email)')
    .eq('team_id', teamId)
    .eq('status', 'active')
  if (error) throw error
  return (data || []).map(m => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    email: (m.users as { email: string } | null)?.email ?? '',
  }))
}
```

- [ ] **Step 2: 创建 `app/api/admin/assign/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext, isManager } from '@/lib/auth/get-user-role'
import { assignResource } from '@/lib/supabase/admin-queries'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isManager(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { resourceType, resourceId, assignedTo } = await request.json()
  if (!resourceType || !resourceId || !assignedTo) {
    return NextResponse.json({ error: 'resourceType, resourceId, assignedTo are required' }, { status: 400 })
  }

  // 查询当前负责人
  const supabase = await createClient()
  const table = resourceType === 'customer' ? 'customers'
    : resourceType === 'project' ? 'projects' : 'tasks'
  const { data: record } = await supabase.from(table).select('user_id').eq('id', resourceId).single()

  await assignResource({
    teamId: ctx.teamId,
    resourceType,
    resourceId,
    assignedFrom: record?.user_id ?? null,
    assignedTo,
    operatedBy: ctx.userId,
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/admin-queries.ts app/api/admin/assign/
git commit -m "feat: add assign API and assignResource query"
```

---

### Task 3: AssignDialog 组件

**Files:**
- Create: `components/admin/AssignDialog.tsx`

- [ ] **Step 1: 创建文件**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Member = { user_id: string; email: string; role: string }

export function AssignDialog({ open, onClose, resourceType, resourceId, onSuccess }: {
  open: boolean
  onClose: () => void
  resourceType: 'customer' | 'project' | 'task'
  resourceId: string
  onSuccess: () => void
}) {
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch('/api/admin/users').then(r => r.json()).then(setMembers)
  }, [open])

  async function handleAssign() {
    if (!selected) return
    setLoading(true)
    await fetch('/api/admin/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resourceType, resourceId, assignedTo: selected }),
    })
    setLoading(false)
    onSuccess()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>分派给...</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {members.map(m => (
            <button
              key={m.user_id}
              onClick={() => setSelected(m.user_id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                selected === m.user_id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {m.email}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleAssign} disabled={loading || !selected}>
            {loading ? '分派中...' : '确认分派'}
          </Button>
          <Button variant="outline" onClick={onClose}>取消</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/AssignDialog.tsx
git commit -m "feat: add AssignDialog component"
```

---

### Task 4: queries.ts 支持团队视图

**Files:**
- Modify: `lib/supabase/queries.ts`

- [ ] **Step 1: 修改 getCustomers 支持 teamView 参数**

在 `lib/supabase/queries.ts` 中找到 `getCustomers` 函数，修改为：

```typescript
export async function getCustomers(options?: { teamView?: boolean }): Promise<Customer[]> {
  const supabase = await createClient()
  let query = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  if (!options?.teamView) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) query = query.eq('user_id', user.id)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}
```

- [ ] **Step 2: 同样修改 getProjects**

找到 `getProjects` 函数，在 `.from('projects')` 查询中加入同样的 teamView 过滤逻辑：

```typescript
export async function getProjects(options?: { teamView?: boolean }): Promise<any[]> {
  const supabase = await createClient()
  let projectQuery = supabase
    .from('projects')
    .select('*, customers(*)')
    .order('created_at', { ascending: false })

  if (!options?.teamView) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) projectQuery = projectQuery.eq('user_id', user.id)
  }

  const { data: projects, error: projectsError } = await projectQuery
  if (projectsError) throw projectsError
  // ... 其余逻辑不变（结算段批量查询等）
```

- [ ] **Step 3: 同样修改 getTasks**

找到 `getTasks` 函数，加入 teamView 参数：

```typescript
export async function getTasks(options?: { teamView?: boolean }): Promise<Task[]> {
  const supabase = await createClient()
  let query = supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  if (!options?.teamView) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) query = query.eq('user_id', user.id)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}
```

- [ ] **Step 4: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/queries.ts
git commit -m "feat: add teamView option to getCustomers, getProjects, getTasks"
```

---

### Task 5: 客户列表页加视图切换和分派

**Files:**
- Modify: `app/dashboard/customers/page.tsx`

- [ ] **Step 1: 读取当前文件**

```bash
cat app/dashboard/customers/page.tsx
```

- [ ] **Step 2: 加入视图切换和分派按钮**

在文件顶部加入 hook 和组件导入：

```typescript
import { useTeamView } from '@/hooks/useTeamView'
import { AssignDialog } from '@/components/admin/AssignDialog'
```

在组件内加入：

```typescript
const { viewMode, toggle } = useTeamView()
const [assignTarget, setAssignTarget] = useState<string | null>(null)
// 在 useEffect 中将 viewMode 传给 getCustomers：
// getCustomers({ teamView: viewMode === 'team' })
```

在列表顶部加视图切换按钮（仅经理/超管可见，需从 API 获取当前用户角色）：

```typescript
{isManager && (
  <button onClick={toggle} className="text-sm text-muted-foreground hover:text-foreground">
    {viewMode === 'mine' ? '查看全团队' : '只看我的'}
  </button>
)}
```

在每行操作区加分派按钮（仅经理/超管可见）：

```typescript
{isManager && (
  <Button variant="ghost" size="sm" onClick={() => setAssignTarget(customer.id)}>
    分派
  </Button>
)}
<AssignDialog
  open={assignTarget === customer.id}
  onClose={() => setAssignTarget(null)}
  resourceType="customer"
  resourceId={customer.id}
  onSuccess={loadCustomers}
/>
```

具体实现需根据当前文件结构调整（读取文件后确认组件结构）。

- [ ] **Step 3: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/customers/page.tsx
git commit -m "feat: add team view toggle and assign button to customers page"
```

---

### Task 6: 项目列表页加视图切换和分派

**Files:**
- Modify: `app/dashboard/projects/page.tsx`

- [ ] **Step 1: 读取当前文件**

```bash
cat app/dashboard/projects/page.tsx
```

- [ ] **Step 2: 加入视图切换和分派按钮**

与 Task 5 相同模式，将 `getProjects({ teamView: viewMode === 'team' })` 传入查询，并在每行加分派按钮：

```typescript
import { useTeamView } from '@/hooks/useTeamView'
import { AssignDialog } from '@/components/admin/AssignDialog'

// 在组件内：
const { viewMode, toggle } = useTeamView()
const [assignTarget, setAssignTarget] = useState<string | null>(null)

// 查询时：
getProjects({ teamView: viewMode === 'team' })

// 分派按钮：
{isManager && (
  <Button variant="ghost" size="sm" onClick={() => setAssignTarget(project.id)}>
    分派
  </Button>
)}
<AssignDialog
  open={assignTarget === project.id}
  onClose={() => setAssignTarget(null)}
  resourceType="project"
  resourceId={project.id}
  onSuccess={loadProjects}
/>
```

- [ ] **Step 3: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/projects/page.tsx
git commit -m "feat: add team view toggle and assign button to projects page"
```

---

### Task 7: 任务列表页加视图切换和分派

**Files:**
- Modify: `app/dashboard/tasks/page.tsx`

- [ ] **Step 1: 读取当前文件**

```bash
cat app/dashboard/tasks/page.tsx
```

- [ ] **Step 2: 加入视图切换和分派按钮**

与 Task 5/6 相同模式：

```typescript
import { useTeamView } from '@/hooks/useTeamView'
import { AssignDialog } from '@/components/admin/AssignDialog'

const { viewMode, toggle } = useTeamView()
const [assignTarget, setAssignTarget] = useState<string | null>(null)

// 查询时：
getTasks({ teamView: viewMode === 'team' })

// 分派按钮：
{isManager && (
  <Button variant="ghost" size="sm" onClick={() => setAssignTarget(task.id)}>
    分派
  </Button>
)}
<AssignDialog
  open={assignTarget === task.id}
  onClose={() => setAssignTarget(null)}
  resourceType="task"
  resourceId={task.id}
  onSuccess={loadTasks}
/>
```

- [ ] **Step 3: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 手动测试**

以经理账号登录：
1. 客户/项目/任务列表顶部出现"查看全团队"按钮
2. 点击后显示团队所有成员数据，按钮变为"只看我的"
3. 刷新页面后保持上次选择
4. 每行出现"分派"按钮，点击弹出成员选择器，确认后数据归属变更

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/tasks/page.tsx
git commit -m "feat: add team view toggle and assign button to tasks page"
```

---

## 自审检查

**规格覆盖：**
- ✅ 分派客户/项目/任务（更新 user_id + 写 assignment_logs）
- ✅ 分派操作仅经理/超管可见
- ✅ 视图切换开关（我的 / 全团队）
- ✅ 切换状态 localStorage 持久化
- ✅ 客户、项目、任务三个列表页均支持

**不在本计划范围：**
- 详情页的分派按钮（本期仅列表页，详情页后续迭代）
- 按负责人筛选下拉（视图切换后的进阶筛选，后续迭代）
