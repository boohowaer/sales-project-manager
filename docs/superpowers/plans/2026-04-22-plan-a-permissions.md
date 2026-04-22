# 权限基础设施 实现计划（计划 A）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 team_members 表新增 data_scope 和 approval_cc 字段，将数据查看范围控制从前端移到后端，并在成员管理页面支持逐人配置。

**Architecture:** 数据库迁移新增两列 → 后端 getUserTeamContext 携带新字段 → queries.ts 数据范围从 DB 读取 → /api/me 暴露字段 → MemberTable UI 新增编辑列。

**Tech Stack:** Next.js 15 App Router, Supabase, TypeScript, Tailwind CSS, shadcn/ui

---

## 文件改动清单

| 文件 | 操作 |
|------|------|
| `migrations/20260422_add_member_permissions.sql` | 新增 |
| `types/index.ts` | 修改：TeamMember、UserTeamContext 新增字段 |
| `lib/auth/get-user-role.ts` | 修改：getUserTeamContext 查询并返回新字段 |
| `lib/supabase/queries.ts` | 修改：getCustomers/getProjects/getTasks 改为服务端读 data_scope |
| `lib/supabase/admin-queries.ts` | 修改：updateMember 支持 data_scope、approval_cc |
| `app/api/me/route.ts` | 修改：响应新增 data_scope、approval_cc |
| `app/api/admin/users/[userId]/route.ts` | 修改：PATCH 支持 data_scope、approval_cc |
| `hooks/useTeamView.ts` | 修改：接收 canViewTeam prop，无权限时不允许切换 |
| `components/admin/MemberTable.tsx` | 修改：新增数据范围和审批抄送两列 |
| `app/dashboard/customers/page.tsx` | 修改：根据 data_scope 控制切换按钮显示 |
| `app/dashboard/projects/page.tsx` | 修改：根据 data_scope 控制切换按钮显示 |
| `app/dashboard/tasks/page.tsx` | 修改：根据 data_scope 控制切换按钮显示 |

---

### Task 1: 数据库迁移

**Files:**
- Create: `migrations/20260422_add_member_permissions.sql`

- [ ] **Step 1: 创建迁移文件**

```sql
-- migrations/20260422_add_member_permissions.sql

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS data_scope TEXT
    CHECK (data_scope IN ('own', 'team'))
    DEFAULT 'own',
  ADD COLUMN IF NOT EXISTS approval_cc BOOLEAN
    DEFAULT false;

-- super_admin 和 sales_manager 默认 team 范围
UPDATE team_members
  SET data_scope = 'team'
  WHERE role IN ('super_admin', 'sales_manager')
    AND data_scope = 'own';
```

- [ ] **Step 2: 在 Supabase Dashboard 执行迁移**

打开 Supabase Dashboard → SQL Editor，粘贴上述 SQL 执行。
验证：`SELECT id, role, data_scope, approval_cc FROM team_members LIMIT 5;`
预期：super_admin/sales_manager 的 data_scope 为 'team'，sales_rep 为 'own'，approval_cc 均为 false。

- [ ] **Step 3: Commit**

```bash
git add migrations/20260422_add_member_permissions.sql
git commit -m "feat: 数据库迁移 — team_members 新增 data_scope 和 approval_cc 字段"
```

---

### Task 2: 更新 TypeScript 类型

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: 更新 TeamMember 类型**

在 `types/index.ts` 中找到 `TeamMember` 类型，修改为：

```typescript
export type TeamMember = {
  id: string
  team_id: string
  user_id: string
  role: TeamRole
  status: 'active' | 'disabled'
  invited_by: string | null
  joined_at: string
  data_scope: 'own' | 'team'
  approval_cc: boolean
}
```

- [ ] **Step 2: 更新 UserTeamContext 类型**

找到 `UserTeamContext` 类型，修改为：

```typescript
export type UserTeamContext = {
  teamId: string
  teamName: string
  role: TeamRole
  userId: string
  dataScope: 'own' | 'team'
  approvalCc: boolean
}
```

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: 类型定义新增 data_scope 和 approval_cc 字段"
```

---

### Task 3: 更新 getUserTeamContext

**Files:**
- Modify: `lib/auth/get-user-role.ts`

- [ ] **Step 1: 修改查询，携带新字段**

将 `lib/auth/get-user-role.ts` 中的 `getUserTeamContext` 函数改为：

```typescript
export async function getUserTeamContext(): Promise<UserTeamContext | null> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: member } = await supabase
    .from('team_members' as any)
    .select('team_id, role, data_scope, approval_cc, teams(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!member) return null

  const m = member as {
    team_id: string
    role: string
    data_scope: string
    approval_cc: boolean
    teams: { name: string } | null
  }

  return {
    teamId: m.team_id,
    teamName: m.teams?.name ?? '',
    role: m.role as TeamRole,
    userId: user.id,
    dataScope: (m.data_scope ?? 'own') as 'own' | 'team',
    approvalCc: m.approval_cc ?? false,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth/get-user-role.ts
git commit -m "feat: getUserTeamContext 携带 dataScope 和 approvalCc"
```

---

### Task 4: 更新 /api/me 接口

**Files:**
- Modify: `app/api/me/route.ts`

- [ ] **Step 1: 修改响应，暴露新字段**

将 `app/api/me/route.ts` 改为：

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext } from '@/lib/auth/get-user-role'

export async function GET() {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ role: null })
  return NextResponse.json({
    role: ctx.role,
    userId: ctx.userId,
    teamId: ctx.teamId,
    dataScope: ctx.dataScope,
    approvalCc: ctx.approvalCc,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/me/route.ts
git commit -m "feat: /api/me 响应新增 dataScope 和 approvalCc"
```

---

### Task 5: 数据范围控制移到后端

**Files:**
- Modify: `lib/supabase/queries.ts`

- [ ] **Step 1: 修改 getCustomers**

找到 `getCustomers` 函数，改为从服务端读取 data_scope：

```typescript
export async function getCustomers(options?: { teamView?: boolean }): Promise<Customer[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let query = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  // 读取成员的 data_scope
  const { data: member } = await supabase
    .from('team_members' as any)
    .select('data_scope')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  const dataScope = (member as any)?.data_scope ?? 'own'

  // data_scope=own 时强制只看自己；data_scope=team 时尊重前端 teamView 参数
  if (dataScope === 'own' || !options?.teamView) {
    if (dataScope === 'own') {
      query = query.eq('user_id', user.id)
    }
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}
```

等等，逻辑应该是：
- `data_scope === 'own'`：无论前端传什么，强制过滤 `user_id`
- `data_scope === 'team'`：尊重前端 `teamView` 参数（可切换）

修正后的完整实现：

```typescript
export async function getCustomers(options?: { teamView?: boolean }): Promise<Customer[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: member } = await supabase
    .from('team_members' as any)
    .select('data_scope')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  const dataScope = (member as any)?.data_scope ?? 'own'

  let query = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  if (dataScope === 'own' || !options?.teamView) {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}
```

- [ ] **Step 2: 修改 getProjects**

找到 `getProjects` 函数，用同样的模式修改（在函数开头查询 data_scope，替换原有的 `if (!options?.teamView)` 逻辑）：

```typescript
export async function getProjects(options?: { teamView?: boolean }): Promise<any[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: member } = await supabase
    .from('team_members' as any)
    .select('data_scope')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  const dataScope = (member as any)?.data_scope ?? 'own'

  let query = supabase
    .from('projects')
    .select('*, customers(name, company)')
    .order('created_at', { ascending: false })

  if (dataScope === 'own' || !options?.teamView) {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}
```

注意：保留原有的 `.select('*, customers(name, company)')` 等字段，只替换过滤逻辑部分。

- [ ] **Step 3: 修改 getTasks**

找到 `getTasks` 函数，用同样模式修改：

```typescript
export async function getTasks(options?: { teamView?: boolean }): Promise<any[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: member } = await supabase
    .from('team_members' as any)
    .select('data_scope')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  const dataScope = (member as any)?.data_scope ?? 'own'

  let query = supabase
    .from('tasks')
    .select('*, projects(name, customers(name))')
    .order('created_at', { ascending: false })

  if (dataScope === 'own' || !options?.teamView) {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/queries.ts
git commit -m "feat: 数据范围控制从前端移到后端，读取 data_scope 字段"
```

---

### Task 6: 更新 updateMember 支持新字段

**Files:**
- Modify: `lib/supabase/admin-queries.ts`

- [ ] **Step 1: 修改 updateMember 函数签名**

找到 `updateMember` 函数，修改为：

```typescript
export async function updateMember(
  memberId: string,
  updates: {
    role?: TeamMember['role']
    status?: 'active' | 'disabled'
    data_scope?: 'own' | 'team'
    approval_cc?: boolean
  }
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('team_members')
    .update(updates)
    .eq('id', memberId)
  if (error) throw error
}
```

- [ ] **Step 2: 更新 PATCH /api/admin/users/[userId]/route.ts**

将 `app/api/admin/users/[userId]/route.ts` 改为：

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext, isSuperAdmin } from '@/lib/auth/get-user-role'
import { updateMember } from '@/lib/supabase/admin-queries'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { userId } = await params
  const body = await request.json()
  const updates: {
    role?: string
    status?: string
    data_scope?: 'own' | 'team'
    approval_cc?: boolean
  } = {}
  if (body.role) updates.role = body.role
  if (body.status) updates.status = body.status
  if (body.data_scope !== undefined) updates.data_scope = body.data_scope
  if (body.approval_cc !== undefined) updates.approval_cc = body.approval_cc
  await updateMember(userId, updates as any)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/admin-queries.ts app/api/admin/users/[userId]/route.ts
git commit -m "feat: updateMember 和 PATCH API 支持 data_scope、approval_cc 字段"
```

---

### Task 7: 成员管理页面新增权限配置列

**Files:**
- Modify: `components/admin/MemberTable.tsx`

- [ ] **Step 1: 更新 Member 类型和组件**

将 `components/admin/MemberTable.tsx` 完整替换为：

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TeamRole } from '@/types'

type Member = {
  id: string
  user_id: string
  email: string
  role: TeamRole
  status: 'active' | 'disabled'
  joined_at: string
  data_scope: 'own' | 'team'
  approval_cc: boolean
}

const ROLE_LABELS: Record<TeamRole, string> = {
  super_admin: '超级管理员',
  sales_manager: '销售经理',
  sales_rep: '普通销售',
}

export function MemberTable({ members, onUpdate, currentUserId }: {
  members: Member[]
  onUpdate: () => void
  currentUserId: string | null
}) {
  const [loading, setLoading] = useState<string | null>(null)

  async function patchMember(memberId: string, updates: Record<string, unknown>) {
    setLoading(memberId)
    await fetch(`/api/admin/users/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setLoading(null)
    onUpdate()
  }

  return (
    <Card className="rounded-2xl shadow-sm border-0 bg-white">
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-white border-b border-zinc-200">
            <tr>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase">邮箱</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase">角色</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase">数据范围</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase">审批抄送</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase">状态</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase">加入时间</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {members.map(m => {
              const isManager = m.role === 'super_admin' || m.role === 'sales_manager'
              return (
                <tr key={m.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-zinc-900">{m.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={m.role}
                      disabled={loading === m.id || m.user_id === currentUserId}
                      onValueChange={val => patchMember(m.id, { role: val })}
                    >
                      <SelectTrigger className="w-32 rounded-full border-zinc-200 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_LABELS) as TeamRole[]).map(r => (
                          <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    {isManager ? (
                      <span className="text-xs text-zinc-400">全团队</span>
                    ) : (
                      <Select
                        value={m.data_scope}
                        disabled={loading === m.id}
                        onValueChange={val => patchMember(m.id, { data_scope: val })}
                      >
                        <SelectTrigger className="w-24 rounded-full border-zinc-200 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="own">仅自己</SelectItem>
                          <SelectItem value="team">全团队</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isManager ? (
                      <span className="text-xs text-zinc-400">已有审批权</span>
                    ) : (
                      <button
                        disabled={loading === m.id}
                        onClick={() => patchMember(m.id, { approval_cc: !m.approval_cc })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          m.approval_cc ? 'bg-zinc-900' : 'bg-zinc-200'
                        } disabled:opacity-50`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          m.approval_cc ? 'translate-x-4' : 'translate-x-1'
                        }`} />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`rounded-full text-xs border ${m.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
                      {m.status === 'active' ? '正常' : '已禁用'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {new Date(m.joined_at).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    {m.user_id === currentUserId ? (
                      <span className="text-xs text-zinc-400">（自己）</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={loading === m.id}
                        onClick={() => patchMember(m.id, { status: m.status === 'active' ? 'disabled' : 'active' })}
                        className="h-8 text-xs rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                      >
                        {m.status === 'active' ? '禁用' : '启用'}
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-zinc-400 text-sm">暂无成员</td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/MemberTable.tsx
git commit -m "feat: 成员管理表格新增数据范围和审批抄送配置列"
```

---

### Task 8: 前端根据 data_scope 控制切换按钮

**Files:**
- Modify: `app/dashboard/customers/page.tsx`
- Modify: `app/dashboard/projects/page.tsx`
- Modify: `app/dashboard/tasks/page.tsx`

- [ ] **Step 1: customers/page.tsx — 读取 dataScope，控制切换按钮**

在 `app/dashboard/customers/page.tsx` 中，找到 `useEffect` 里读取 `/api/me` 的部分，新增 `dataScope` 状态：

在组件顶部 state 声明处新增：
```typescript
const [dataScope, setDataScope] = useState<'own' | 'team'>('own')
```

在读取 `/api/me` 的 `useEffect` 中新增：
```typescript
setDataScope(d.dataScope ?? 'own')
```

找到页面中渲染"团队视图"切换按钮的地方（通常是 `viewMode` 相关的 toggle 按钮），在其外层包裹条件：
```tsx
{dataScope === 'team' && (
  <Button ... onClick={toggle}>
    {viewMode === 'team' ? '我的' : '团队'}
  </Button>
)}
```

- [ ] **Step 2: projects/page.tsx — 同样处理**

在 `app/dashboard/projects/page.tsx` 中做同样的修改：新增 `dataScope` state，从 `/api/me` 读取，切换按钮加 `dataScope === 'team'` 条件。

- [ ] **Step 3: tasks/page.tsx — 同样处理**

在 `app/dashboard/tasks/page.tsx` 中做同样的修改。

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/customers/page.tsx app/dashboard/projects/page.tsx app/dashboard/tasks/page.tsx
git commit -m "feat: 数据范围切换按钮仅对 data_scope=team 的用户显示"
```

---

### Task 9: 验证

- [ ] **Step 1: 启动开发服务器**

```bash
# 用户手动运行：
npm run dev
```

- [ ] **Step 2: 验证 super_admin 行为**

以 super_admin 登录：
- 成员管理页面能看到"数据范围"和"审批抄送"两列
- 自己的数据范围列显示"全团队"（不可改）
- 客户/项目/任务页面显示团队视图切换按钮

- [ ] **Step 3: 验证 sales_rep 行为**

以 sales_rep 登录：
- 客户/项目/任务页面不显示切换按钮，只看自己的数据
- 在成员管理（super_admin 操作）将该 sales_rep 的 data_scope 改为 'team' 后，刷新页面，切换按钮出现

- [ ] **Step 4: 验证 approval_cc 开关**

以 super_admin 在成员管理页面将某 sales_rep 的审批抄送开关打开，刷新 `/api/me`（以该 sales_rep 身份），确认响应中 `approvalCc: true`。

- [ ] **Step 5: Commit（如有遗漏修复）**

```bash
git add -p
git commit -m "fix: 权限基础设施验证修复"
```
