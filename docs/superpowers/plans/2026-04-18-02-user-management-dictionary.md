# 用户管理 + 数据字典 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现超管后台的成员管理（邀请/角色/禁用）和数据字典（增删改排序）功能，包含完整的 API 路由和页面 UI。

**Architecture:** API 路由使用 Supabase service role 绕过 RLS 执行管理操作；邀请流程通过 token 链接完成；数据字典以 team_id + category + key 三元组唯一标识条目。

**Tech Stack:** Next.js 15 App Router, Supabase, TypeScript, shadcn/ui, Tailwind CSS

---

## 文件结构

**新建：**
- `lib/supabase/admin-queries.ts` — 管理员专用查询（service role）
- `app/api/admin/users/route.ts` — GET 成员列表 / POST 邀请
- `app/api/admin/users/[userId]/route.ts` — PATCH 更新角色/状态
- `app/api/admin/dictionary/route.ts` — GET 列表 / POST 新增
- `app/api/admin/dictionary/[id]/route.ts` — PATCH 更新 / DELETE 删除
- `app/api/invitations/[token]/route.ts` — GET 验证 token / POST 接受邀请
- `app/dashboard/admin/users/page.tsx` — 成员管理页
- `app/dashboard/admin/dictionary/page.tsx` — 数据字典页
- `components/admin/InviteUserDialog.tsx` — 邀请对话框
- `components/admin/MemberTable.tsx` — 成员列表表格
- `components/admin/DictionaryManager.tsx` — 数据字典管理组件

**修改：**
- `components/layout/SidebarNavigation.tsx` — 超管可见管理菜单入口

---

### Task 1: 管理员查询函数

**Files:**
- Create: `lib/supabase/admin-queries.ts`

- [ ] **Step 1: 创建文件**

创建 `lib/supabase/admin-queries.ts`，同时确认 `SUPABASE_SERVICE_ROLE_KEY` 已在 `.env.local` 中配置（Supabase 项目设置 → API → service_role key）。



```typescript
import { createClient } from '@supabase/supabase-js'
import type { TeamMember, TeamInvitation } from '@/types'

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function getTeamMembers(teamId: string): Promise<(TeamMember & { email: string })[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('team_members')
    .select('*, users:user_id(email)')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return (data || []).map(m => ({
    ...m,
    email: (m.users as { email: string } | null)?.email ?? '',
  }))
}

export async function updateMember(
  memberId: string,
  updates: { role?: TeamMember['role']; status?: 'active' | 'disabled' }
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('team_members')
    .update(updates)
    .eq('id', memberId)
  if (error) throw error
}

export async function createInvitation(params: {
  teamId: string
  email: string
  role: TeamMember['role']
  invitedBy: string
}): Promise<TeamInvitation> {
  const supabase = createAdminClient()
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('team_invitations')
    .insert({
      team_id: params.teamId,
      email: params.email,
      role: params.role,
      token,
      invited_by: params.invitedBy,
      expires_at: expiresAt,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getInvitationByToken(token: string): Promise<TeamInvitation | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('token', token)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()
  return data
}

export async function acceptInvitation(token: string, userId: string): Promise<void> {
  const supabase = createAdminClient()
  const invitation = await getInvitationByToken(token)
  if (!invitation) throw new Error('Invalid or expired invitation')

  await supabase.from('team_members').insert({
    team_id: invitation.team_id,
    user_id: userId,
    role: invitation.role,
    invited_by: invitation.invited_by,
  })
  await supabase
    .from('team_invitations')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
}
```

- [ ] **Step 2: 验证类型无错误**

```bash
npx tsc --noEmit
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/admin-queries.ts
git commit -m "feat: add admin-queries with member management and invitation functions"
```

---

### Task 2: 用户管理 API 路由

**Files:**
- Create: `app/api/admin/users/route.ts`
- Create: `app/api/admin/users/[userId]/route.ts`

- [ ] **Step 1: 创建 `app/api/admin/users/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext, isSuperAdmin } from '@/lib/auth/get-user-role'
import { getTeamMembers, createInvitation } from '@/lib/supabase/admin-queries'

export async function GET() {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const members = await getTeamMembers(ctx.teamId)
  return NextResponse.json(members)
}

export async function POST(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { email, role } = await request.json()
  if (!email || !role) {
    return NextResponse.json({ error: 'email and role are required' }, { status: 400 })
  }
  const invitation = await createInvitation({
    teamId: ctx.teamId,
    email,
    role,
    invitedBy: ctx.userId,
  })
  return NextResponse.json({ token: invitation.token }, { status: 201 })
}
```

- [ ] **Step 2: 创建 `app/api/admin/users/[userId]/route.ts`**

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
  const updates: { role?: string; status?: string } = {}
  if (body.role) updates.role = body.role
  if (body.status) updates.status = body.status
  await updateMember(userId, updates as any)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/users/
git commit -m "feat: add admin users API routes (list, invite, update role/status)"
```

---

### Task 3: 邀请接受 API

**Files:**
- Create: `app/api/invitations/[token]/route.ts`

- [ ] **Step 1: 创建文件**

```typescript
import { NextResponse } from 'next/server'
import { getInvitationByToken, acceptInvitation } from '@/lib/supabase/admin-queries'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const invitation = await getInvitationByToken(token)
  if (!invitation) {
    return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 })
  }
  return NextResponse.json({ email: invitation.email, role: invitation.role })
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  await acceptInvitation(token, user.id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/invitations/
git commit -m "feat: add invitation accept API"
```

---

### Task 4: 数据字典 API 路由

**Files:**
- Create: `app/api/admin/dictionary/route.ts`
- Create: `app/api/admin/dictionary/[id]/route.ts`

- [ ] **Step 1: 在 `lib/supabase/admin-queries.ts` 末尾追加数据字典查询函数**

```typescript
// ─── 数据字典 ───────────────────────────────────────────────

export type DictionaryEntry = {
  id: string
  team_id: string
  category: string
  key: string
  label: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export async function getDictionaryEntries(teamId: string, category?: string): Promise<DictionaryEntry[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('data_dictionary')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true })
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createDictionaryEntry(
  entry: Omit<DictionaryEntry, 'id' | 'created_at'>
): Promise<DictionaryEntry> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('data_dictionary')
    .insert(entry)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDictionaryEntry(
  id: string,
  updates: Partial<Pick<DictionaryEntry, 'label' | 'sort_order' | 'is_active'>>
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('data_dictionary').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteDictionaryEntry(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('data_dictionary').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: 创建 `app/api/admin/dictionary/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext, isSuperAdmin } from '@/lib/auth/get-user-role'
import { getDictionaryEntries, createDictionaryEntry } from '@/lib/supabase/admin-queries'

export async function GET(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') ?? undefined
  const entries = await getDictionaryEntries(ctx.teamId, category)
  return NextResponse.json(entries)
}

export async function POST(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await request.json()
  const { category, key, label, sort_order = 0 } = body
  if (!category || !key || !label) {
    return NextResponse.json({ error: 'category, key, label are required' }, { status: 400 })
  }
  const entry = await createDictionaryEntry({
    team_id: ctx.teamId,
    category,
    key,
    label,
    sort_order,
    is_active: true,
  })
  return NextResponse.json(entry, { status: 201 })
}
```

- [ ] **Step 3: 创建 `app/api/admin/dictionary/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext, isSuperAdmin } from '@/lib/auth/get-user-role'
import { updateDictionaryEntry, deleteDictionaryEntry } from '@/lib/supabase/admin-queries'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json()
  await updateDictionaryEntry(id, body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  await deleteDictionaryEntry(id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/admin-queries.ts app/api/admin/dictionary/
git commit -m "feat: add data dictionary API routes and queries"
```

---

### Task 5: 成员列表组件

**Files:**
- Create: `components/admin/MemberTable.tsx`
- Create: `components/admin/InviteUserDialog.tsx`

- [ ] **Step 1: 创建 `components/admin/MemberTable.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { TeamRole } from '@/types'

type Member = {
  id: string
  email: string
  role: TeamRole
  status: 'active' | 'disabled'
  joined_at: string
}

const ROLE_LABELS: Record<TeamRole, string> = {
  super_admin: '超级管理员',
  sales_manager: '销售经理',
  sales_rep: '普通销售',
}

export function MemberTable({ members, onUpdate }: {
  members: Member[]
  onUpdate: () => void
}) {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleRoleChange(memberId: string, role: TeamRole) {
    setLoading(memberId)
    await fetch(`/api/admin/users/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    setLoading(null)
    onUpdate()
  }

  async function handleToggleStatus(memberId: string, currentStatus: string) {
    setLoading(memberId)
    const status = currentStatus === 'active' ? 'disabled' : 'active'
    await fetch(`/api/admin/users/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setLoading(null)
    onUpdate()
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">邮箱</th>
            <th className="px-4 py-3 text-left font-medium">角色</th>
            <th className="px-4 py-3 text-left font-medium">状态</th>
            <th className="px-4 py-3 text-left font-medium">加入时间</th>
            <th className="px-4 py-3 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.id} className="border-t">
              <td className="px-4 py-3">{m.email}</td>
              <td className="px-4 py-3">
                <select
                  value={m.role}
                  disabled={loading === m.id}
                  onChange={e => handleRoleChange(m.id, e.target.value as TeamRole)}
                  className="rounded border px-2 py-1 text-sm bg-background"
                >
                  {(Object.keys(ROLE_LABELS) as TeamRole[]).map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <Badge variant={m.status === 'active' ? 'default' : 'secondary'}>
                  {m.status === 'active' ? '正常' : '已禁用'}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(m.joined_at).toLocaleDateString('zh-CN')}
              </td>
              <td className="px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loading === m.id}
                  onClick={() => handleToggleStatus(m.id, m.status)}
                >
                  {m.status === 'active' ? '禁用' : '启用'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: 创建 `components/admin/InviteUserDialog.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TeamRole } from '@/types'

const ROLE_LABELS: Record<TeamRole, string> = {
  super_admin: '超级管理员',
  sales_manager: '销售经理',
  sales_rep: '普通销售',
}

export function InviteUserDialog({ open, onClose, onSuccess }: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('sales_rep')
  const [loading, setLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      setInviteLink(`${window.location.origin}/invite/${data.token}`)
      onSuccess()
    }
  }

  function handleClose() {
    setEmail('')
    setRole('sales_rep')
    setInviteLink(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>邀请成员</DialogTitle>
        </DialogHeader>
        {inviteLink ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">邀请链接已生成（24小时有效）：</p>
            <Input value={inviteLink} readOnly onClick={e => (e.target as HTMLInputElement).select()} />
            <p className="text-xs text-muted-foreground">复制链接发送给对方，对方点击后注册/登录即可加入团队。</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>邮箱</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-1">
              <Label>角色</Label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as TeamRole)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              >
                {(Object.keys(ROLE_LABELS) as TeamRole[]).map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <DialogFooter>
          {!inviteLink && (
            <Button onClick={handleSubmit} disabled={loading || !email}>
              {loading ? '生成中...' : '生成邀请链接'}
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/admin/
git commit -m "feat: add MemberTable and InviteUserDialog components"
```

---

### Task 6: 数据字典管理组件

**Files:**
- Create: `components/admin/DictionaryManager.tsx`

- [ ] **Step 1: 创建文件**

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { DictionaryEntry } from '@/lib/supabase/admin-queries'

const CATEGORIES = [
  { key: 'customer_source', label: '客户来源' },
  { key: 'industry', label: '行业分类' },
  { key: 'project_stage', label: '项目阶段' },
]

export function DictionaryManager({ entries, onUpdate }: {
  entries: DictionaryEntry[]
  onUpdate: () => void
}) {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].key)
  const [newLabel, setNewLabel] = useState('')
  const [newKey, setNewKey] = useState('')
  const [loading, setLoading] = useState(false)

  const filtered = entries.filter(e => e.category === activeCategory)

  async function handleAdd() {
    if (!newLabel || !newKey) return
    setLoading(true)
    await fetch('/api/admin/dictionary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: activeCategory,
        key: newKey,
        label: newLabel,
        sort_order: filtered.length,
      }),
    })
    setNewLabel('')
    setNewKey('')
    setLoading(false)
    onUpdate()
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/admin/dictionary/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    })
    onUpdate()
  }

  async function handleDelete(id: string) {
    if (!confirm('确认删除？历史数据中的该选项将保留显示。')) return
    await fetch(`/api/admin/dictionary/${id}`, { method: 'DELETE' })
    onUpdate()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {CATEGORIES.map(c => (
          <Button
            key={c.key}
            variant={activeCategory === c.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(c.key)}
          >
            {c.label}
          </Button>
        ))}
      </div>

      <div className="rounded-md border divide-y">
        {filtered.map(entry => (
          <div key={entry.id} className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">{entry.label}</span>
              <span className="text-xs text-muted-foreground">({entry.key})</span>
              {!entry.is_active && <Badge variant="secondary">已禁用</Badge>}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleToggle(entry.id, entry.is_active)}>
                {entry.is_active ? '禁用' : '启用'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)}>
                删除
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input placeholder="key（英文）" value={newKey} onChange={e => setNewKey(e.target.value)} className="w-40" />
        <Input placeholder="显示名称" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
        <Button onClick={handleAdd} disabled={loading || !newLabel || !newKey}>添加</Button>
      </div>
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
git add components/admin/DictionaryManager.tsx
git commit -m "feat: add DictionaryManager component"
```

---

### Task 7: 用户管理页面

**Files:**
- Create: `app/dashboard/admin/users/page.tsx`

- [ ] **Step 1: 创建文件**

```typescript
'use client'
import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { MemberTable } from '@/components/admin/MemberTable'
import { InviteUserDialog } from '@/components/admin/InviteUserDialog'

export default function UsersPage() {
  const [members, setMembers] = useState<any[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)

  const loadMembers = useCallback(async () => {
    const res = await fetch('/api/admin/users')
    if (res.ok) setMembers(await res.json())
  }, [])

  useEffect(() => { loadMembers() }, [loadMembers])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">成员管理</h1>
        <Button onClick={() => setInviteOpen(true)}>邀请成员</Button>
      </div>
      <MemberTable members={members} onUpdate={loadMembers} />
      <InviteUserDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={loadMembers}
      />
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
git add app/dashboard/admin/users/
git commit -m "feat: add admin users page"
```

---

### Task 8: 数据字典页面

**Files:**
- Create: `app/dashboard/admin/dictionary/page.tsx`

- [ ] **Step 1: 创建文件**

```typescript
'use client'
import { useEffect, useState, useCallback } from 'react'
import { DictionaryManager } from '@/components/admin/DictionaryManager'
import type { DictionaryEntry } from '@/lib/supabase/admin-queries'

export default function DictionaryPage() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([])

  const loadEntries = useCallback(async () => {
    const res = await fetch('/api/admin/dictionary')
    if (res.ok) setEntries(await res.json())
  }, [])

  useEffect(() => { loadEntries() }, [loadEntries])

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">数据字典</h1>
      <DictionaryManager entries={entries} onUpdate={loadEntries} />
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
git add app/dashboard/admin/dictionary/
git commit -m "feat: add admin dictionary page"
```

---

### Task 9: 侧边栏加管理入口

**Files:**
- Modify: `components/layout/SidebarNavigation.tsx`

- [ ] **Step 1: 读取 SidebarNavigation.tsx 当前内容**

```bash
cat components/layout/SidebarNavigation.tsx
```

- [ ] **Step 2: 在导航列表末尾加超管专属入口**

找到导航链接列表，在末尾追加（仅当 role === 'super_admin' 时显示）：

```typescript
// 在组件顶部引入 useEffect/useState 获取角色（或从 props/context 传入）
// 示例：假设通过 props 传入 role
{role === 'super_admin' && (
  <>
    <NavLink href="/dashboard/admin/users" icon={Users}>成员管理</NavLink>
    <NavLink href="/dashboard/admin/dictionary" icon={BookOpen}>数据字典</NavLink>
  </>
)}
```

具体实现需根据 SidebarNavigation.tsx 现有结构调整（读取文件后确认 NavLink 组件名和 icon 导入方式）。

- [ ] **Step 3: 验证类型**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 手动测试**

启动开发服务器，以超管账号登录，确认侧边栏出现"成员管理"和"数据字典"入口，点击可正常跳转。

- [ ] **Step 5: Commit**

```bash
git add components/layout/SidebarNavigation.tsx
git commit -m "feat: add admin nav links to sidebar for super_admin"
```

---

## 自审检查

**规格覆盖：**
- ✅ `/dashboard/admin/users` — 成员列表、邀请、角色管理、禁用/启用
- ✅ `/dashboard/admin/dictionary` — 数据字典增删改启用/禁用
- ✅ 邀请 token 生成（24小时有效）
- ✅ 接受邀请 API（token 验证 + 加入团队）
- ✅ 所有 API 路由均校验 super_admin 角色
- ✅ 数据字典三个内置分类（customer_source / industry / project_stage）

**不在本计划范围：**
- 邀请邮件发送（本期返回 token 链接，邮件集成后续处理）
- 邀请接受页面 `/invite/[token]`（需另建页面，调用 `/api/invitations/[token]` POST）
- 数据字典排序拖拽（当前仅支持 sort_order 字段，拖拽 UI 后续迭代）
