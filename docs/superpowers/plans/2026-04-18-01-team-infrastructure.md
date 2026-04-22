# 团队基础设施 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立团队协作的数据库基础——新增 teams/team_members/team_invitations 表，为现有表加 team_id，调整 RLS 策略，并在 Next.js 层加入角色权限中间件。

**Architecture:** 使用 Supabase migration 管理所有 schema 变更；RLS 从"仅自己可见"改为"同团队可见"；Next.js middleware.ts 拦截 /dashboard/admin/* 路由并校验角色；角色信息通过 Supabase session + team_members 表查询，不存 JWT。

**Tech Stack:** Next.js 15, Supabase (PostgreSQL + RLS), TypeScript, @supabase/ssr

---

## 文件结构

**新建：**
- `supabase/migrations/20260418000001_add_teams.sql` — teams/team_members/team_invitations/assignment_logs/approval_requests 表 + RLS
- `supabase/migrations/20260418000002_add_team_id_to_existing.sql` — 现有表加 team_id
- `lib/auth/get-user-role.ts` — 服务端获取当前用户角色和 team_id
- `middleware.ts` — 拦截 /dashboard/admin/* 路由

**修改：**
- `types/index.ts` — 新增 Team、TeamMember、TeamRole 类型

---

### Task 1: 创建团队相关数据库表

**Files:**
- Create: `supabase/migrations/20260418000001_add_teams.sql`

- [ ] **Step 1: 确认 supabase/migrations 目录存在**

```bash
ls supabase/migrations/
```

如果目录不存在：
```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: 创建 migration 文件**

创建 `supabase/migrations/20260418000001_add_teams.sql`，内容如下：

```sql
-- teams
CREATE TABLE teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- team_members
CREATE TABLE team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT CHECK (role IN ('super_admin', 'sales_manager', 'sales_rep')) NOT NULL,
  status      TEXT CHECK (status IN ('active', 'disabled')) DEFAULT 'active',
  invited_by  UUID REFERENCES auth.users(id),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- team_invitations
CREATE TABLE team_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID REFERENCES teams(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT CHECK (role IN ('super_admin', 'sales_manager', 'sales_rep')) NOT NULL,
  token       TEXT UNIQUE NOT NULL,
  invited_by  UUID REFERENCES auth.users(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- assignment_logs
CREATE TABLE assignment_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID REFERENCES teams(id),
  resource_type TEXT CHECK (resource_type IN ('customer', 'project', 'task')) NOT NULL,
  resource_id   UUID NOT NULL,
  assigned_from UUID REFERENCES auth.users(id),
  assigned_to   UUID REFERENCES auth.users(id) NOT NULL,
  operated_by   UUID REFERENCES auth.users(id) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- approval_requests
CREATE TABLE approval_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID REFERENCES teams(id) ON DELETE CASCADE,
  type          TEXT CHECK (type IN ('create_customer', 'create_project', 'update_project')) NOT NULL,
  target_id     UUID,
  payload       JSONB NOT NULL,
  submitted_by  UUID REFERENCES auth.users(id) NOT NULL,
  reviewed_by   UUID REFERENCES auth.users(id),
  status        TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reject_reason TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ
);

-- RLS: teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members can view their team"
  ON teams FOR SELECT
  USING (id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
  ));

-- RLS: team_members
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members can view their team members"
  ON team_members FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
  ));

-- RLS: team_invitations (只有超管通过 service role 操作，普通用户只能读自己的 token)
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read invitation by token"
  ON team_invitations FOR SELECT
  USING (true);

-- RLS: assignment_logs
ALTER TABLE assignment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members can view assignment logs"
  ON assignment_logs FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
  ));

-- RLS: approval_requests
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submitter can view own requests"
  ON approval_requests FOR SELECT
  USING (submitted_by = auth.uid());
CREATE POLICY "team managers can view all pending requests"
  ON approval_requests FOR SELECT
  USING (team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'sales_manager')
    AND status = 'active'
  ));
```

- [ ] **Step 3: 应用 migration**

```bash
npx supabase db push
```

预期输出：`Applying migration 20260418000001_add_teams.sql`

如果本地开发用 supabase start：
```bash
npx supabase migration up
```

- [ ] **Step 4: 验证表已创建**

```bash
npx supabase db diff
```

预期：无 diff（说明 migration 已完整应用）

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260418000001_add_teams.sql
git commit -m "feat: add teams, team_members, invitations, assignment_logs, approval_requests tables"
```

---

### Task 2: 现有表加 team_id

**Files:**
- Create: `supabase/migrations/20260418000002_add_team_id_to_existing.sql`

- [ ] **Step 1: 创建 migration 文件**

创建 `supabase/migrations/20260418000002_add_team_id_to_existing.sql`：

```sql
-- 为现有表加 team_id（可为空，兼容历史数据）
ALTER TABLE customers ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE projects  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE tasks     ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE settlement_stages ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);
ALTER TABLE weekly_updates    ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id);

-- 更新 customers RLS：同团队成员可见，或 team_id 为空时仅自己可见（兼容历史数据）
DROP POLICY IF EXISTS "Users can only see their own customers" ON customers;
CREATE POLICY "Users can see own or team customers"
  ON customers FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      team_id IS NOT NULL AND team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- 更新 projects RLS
DROP POLICY IF EXISTS "Users can only see their own projects" ON projects;
CREATE POLICY "Users can see own or team projects"
  ON projects FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      team_id IS NOT NULL AND team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- 更新 tasks RLS
DROP POLICY IF EXISTS "Users can only see their own tasks" ON tasks;
CREATE POLICY "Users can see own or team tasks"
  ON tasks FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      team_id IS NOT NULL AND team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );
```

- [ ] **Step 2: 应用 migration**

```bash
npx supabase db push
```

预期输出：`Applying migration 20260418000002_add_team_id_to_existing.sql`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260418000002_add_team_id_to_existing.sql
git commit -m "feat: add team_id to existing tables and update RLS policies"
```

---

### Task 3: 新增 TypeScript 类型

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: 在 types/index.ts 末尾追加团队相关类型**

在文件末尾添加：

```typescript
// ─── Team types ───────────────────────────────────────────────

export type TeamRole = 'super_admin' | 'sales_manager' | 'sales_rep'

export type Team = {
  id: string
  name: string
  created_by: string | null
  created_at: string
}

export type TeamMember = {
  id: string
  team_id: string
  user_id: string
  role: TeamRole
  status: 'active' | 'disabled'
  invited_by: string | null
  joined_at: string
}

export type TeamInvitation = {
  id: string
  team_id: string
  email: string
  role: TeamRole
  token: string
  invited_by: string | null
  expires_at: string
  used_at: string | null
  created_at: string
}

export type AssignmentLog = {
  id: string
  team_id: string
  resource_type: 'customer' | 'project' | 'task'
  resource_id: string
  assigned_from: string | null
  assigned_to: string
  operated_by: string
  created_at: string
}

export type ApprovalRequestType = 'create_customer' | 'create_project' | 'update_project'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

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

// 当前用户的团队上下文（从 team_members 查询后缓存使用）
export type UserTeamContext = {
  teamId: string
  teamName: string
  role: TeamRole
  userId: string
}
```

- [ ] **Step 2: 确认类型无语法错误**

```bash
npx tsc --noEmit
```

预期：无错误输出

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add Team, TeamMember, ApprovalRequest and related TypeScript types"
```

---

### Task 4: 服务端获取用户角色工具函数

**Files:**
- Create: `lib/auth/get-user-role.ts`

- [ ] **Step 1: 创建目录和文件**

```bash
mkdir -p lib/auth
```

创建 `lib/auth/get-user-role.ts`：

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { UserTeamContext, TeamRole } from '@/types'

/**
 * 在 Server Component / middleware / API route 中获取当前用户的团队上下文。
 * 返回 null 表示用户未登录或不属于任何团队。
 */
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
    .from('team_members')
    .select('team_id, role, teams(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!member) return null

  return {
    teamId: member.team_id,
    teamName: (member.teams as { name: string } | null)?.name ?? '',
    role: member.role as TeamRole,
    userId: user.id,
  }
}

/**
 * 检查角色是否有管理权限（super_admin 或 sales_manager）
 */
export function isManager(role: TeamRole): boolean {
  return role === 'super_admin' || role === 'sales_manager'
}

/**
 * 检查角色是否为超管
 */
export function isSuperAdmin(role: TeamRole): boolean {
  return role === 'super_admin'
}
```

- [ ] **Step 2: 确认类型无错误**

```bash
npx tsc --noEmit
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add lib/auth/get-user-role.ts
git commit -m "feat: add getUserTeamContext server utility"
```

---

### Task 5: Next.js middleware 路由保护

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: 创建 middleware.ts（项目根目录）**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 未登录用户访问 /dashboard/* 重定向到登录页
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // /dashboard/admin/* 需要 super_admin 角色
  if (user && request.nextUrl.pathname.startsWith('/dashboard/admin')) {
    const { data: member } = await supabase
      .from('team_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!member || member.role !== 'super_admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

- [ ] **Step 2: 验证 TypeScript 无错误**

```bash
npx tsc --noEmit
```

预期：无错误

- [ ] **Step 3: 手动测试**

启动开发服务器后：
1. 未登录状态访问 `http://localhost:3000/dashboard` → 应跳转到 `/login`
2. 普通销售账号访问 `http://localhost:3000/dashboard/admin/users` → 应跳转到 `/dashboard`
3. 超管账号访问 `http://localhost:3000/dashboard/admin/users` → 应正常显示（页面可能还不存在，返回 404 即可，不跳转就对）

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat: add middleware to protect /dashboard/admin routes"
```

---

### Task 6: 为 Supabase queries 加入 team_id 支持

**Files:**
- Modify: `lib/supabase/queries.ts`

- [ ] **Step 1: 在 getCustomers、getProjects、getTasks 中加入 team_id 过滤**

在 `lib/supabase/queries.ts` 中，找到 `getCustomers` 函数，在查询中加入 team_id 写入支持。

先在文件顶部确认已导入 supabase client，然后修改 `createCustomer`：

```typescript
// 修改前（示例）
export async function createCustomer(customer: CustomerInsert): Promise<Customer> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('customers')
    .insert(customer)
    .select()
    .single()
  if (error) throw error
  return data
}

// 修改后：自动注入 team_id
export async function createCustomer(customer: CustomerInsert): Promise<Customer> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 获取用户的 team_id
  const { data: member } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  const { data, error } = await supabase
    .from('customers')
    .insert({ ...customer, team_id: member?.team_id ?? null })
    .select()
    .single()
  if (error) throw error
  return data
}
```

对 `createProject` 和 `createTask` 做同样的修改（注入 team_id）。

- [ ] **Step 2: 验证 TypeScript 无错误**

```bash
npx tsc --noEmit
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/queries.ts
git commit -m "feat: inject team_id when creating customers, projects, tasks"
```

---

## 自审检查

**规格覆盖：**
- ✅ teams / team_members / team_invitations 表
- ✅ assignment_logs 表
- ✅ approval_requests 表
- ✅ 现有表加 team_id
- ✅ RLS 策略调整
- ✅ TypeScript 类型
- ✅ middleware 路由保护
- ✅ 新建数据时注入 team_id

**不在本计划范围（后续计划处理）：**
- 邀请流程 UI → 计划 02
- 数据字典页面 → 计划 02
- 分派功能 UI → 计划 03
- 审批流 UI → 计划 04
