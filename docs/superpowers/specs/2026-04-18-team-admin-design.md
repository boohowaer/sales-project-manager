# 团队协作与后台管理功能设计文档

**日期：** 2026-04-18
**项目：** sales-project-manager
**状态：** 待实施

---

## 背景

当前系统为单用户模式，每个用户数据完全隔离。为支持 10-15 人小团队协作使用，需要引入团队概念、角色权限体系、用户管理和数据字典功能。

---

## 目标

- 支持三级角色：超级管理员、销售经理、普通销售
- 经理和超管可查看团队所有成员数据
- 超管可邀请成员、分配角色、禁用账号
- 统一管理系统下拉选项（数据字典）
- 在现有 Dashboard 内集成管理入口，无需独立后台

---

## 技术方案

**应用层权限 + 轻量 RLS：**
- RLS 放开为同团队可见（替代原来的仅自己可见）
- 角色权限逻辑在 Next.js middleware 和 API 层统一拦截
- 不引入第三方 RBAC 框架，保持轻量

---

## 数据库设计

### 新增表

**`teams`**
```sql
id          UUID PRIMARY KEY
name        TEXT NOT NULL
created_by  UUID REFERENCES auth.users(id)
created_at  TIMESTAMPTZ DEFAULT NOW()
```

**`team_members`**
```sql
id          UUID PRIMARY KEY
team_id     UUID REFERENCES teams(id) ON DELETE CASCADE
user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE
role        TEXT CHECK (role IN ('super_admin', 'sales_manager', 'sales_rep'))
status      TEXT CHECK (status IN ('active', 'disabled')) DEFAULT 'active'
invited_by  UUID REFERENCES auth.users(id)
joined_at   TIMESTAMPTZ DEFAULT NOW()
UNIQUE (team_id, user_id)
```

**`team_invitations`**
```sql
id          UUID PRIMARY KEY
team_id     UUID REFERENCES teams(id) ON DELETE CASCADE
email       TEXT NOT NULL
role        TEXT NOT NULL
token       TEXT UNIQUE NOT NULL
invited_by  UUID REFERENCES auth.users(id)
expires_at  TIMESTAMPTZ NOT NULL
used_at     TIMESTAMPTZ
created_at  TIMESTAMPTZ DEFAULT NOW()
```

**`data_dictionary`**
```sql
id          UUID PRIMARY KEY
team_id     UUID REFERENCES teams(id) ON DELETE CASCADE
category    TEXT NOT NULL  -- 如 customer_source / industry / project_stage
key         TEXT NOT NULL
label       TEXT NOT NULL
sort_order  INTEGER DEFAULT 0
is_active   BOOLEAN DEFAULT true
created_at  TIMESTAMPTZ DEFAULT NOW()
UNIQUE (team_id, category, key)
```

### 现有表改造

以下表各增加 `team_id UUID REFERENCES teams(id)` 字段：
- `customers`
- `projects`
- `tasks`
- `settlement_stages`
- `weekly_updates`

### RLS 策略调整

原策略（仅自己可见）改为：
- 普通查询：`user_id = auth.uid()` 或 `team_id IN (当前用户所在团队)`
- 经理/超管写操作：应用层校验角色后使用 service role 执行

---

## 权限矩阵

| 功能 | 超级管理员 | 销售经理 | 普通销售 |
|------|-----------|---------|---------|
| 查看自己的数据 | ✓ | ✓ | ✓ |
| 查看团队所有人数据 | ✓ | ✓ | ✗ |
| 邀请/禁用成员 | ✓ | ✗ | ✗ |
| 分配角色 | ✓ | ✗ | ✗ |
| 管理数据字典 | ✓ | ✗ | ✗ |
| 跨成员分配任务 | ✓ | ✓ | ✗ |
| 分派客户/项目/任务给成员 | ✓ | ✓ | ✗ |
| 查看团队汇总统计 | ✓ | ✓ | ✗ |

---

## 用户管理流程

### 邀请流程
1. 超管在 `/dashboard/admin/users` 输入邮箱 + 指定角色
2. 系统生成一次性邀请 token，发送邀请邮件（链接 24 小时有效）
3. 新成员点击链接 → 注册/登录 → 自动加入团队并绑定角色
4. 超管可随时修改成员角色或将其禁用

### 禁用账号
- 禁用后该成员无法登录，数据保留不删除
- 超管可重新启用

---

## 数据字典

### 内置分类

| 分类 key | 说明 | 初始选项示例 |
|---------|------|------------|
| `customer_source` | 客户来源 | 转介绍、展会、官网、电话开发 |
| `industry` | 行业分类 | 制造业、零售、金融、医疗 |
| `project_stage` | 项目阶段 | 初步接触、方案报价、谈判中、签约 |

### 管理能力
- 超管可增删条目、调整排序、启用/禁用
- 禁用的条目不再出现在下拉选项中，但历史数据保留显示

---

## 新增页面

| 路由 | 功能 | 可见角色 |
|------|------|---------|
| `/dashboard/admin/users` | 成员列表、邀请、角色管理、禁用 | super_admin |
| `/dashboard/admin/dictionary` | 数据字典增删改排序 | super_admin |
| Dashboard 首页（扩展） | 新增团队汇总统计模块 | super_admin, sales_manager |

---

## 应用层权限中间件

在 `middleware.ts` 中统一拦截 `/dashboard/admin/*` 路由，校验当前用户角色。API 路由同样在处理函数入口校验角色，防止绕过前端直接调用。

---

## 分派功能

**操作方：** 销售经理、超级管理员

**分派对象：** 客户、项目、任务

**分派逻辑：** 转移归属——分派后对应记录的 `user_id` 更新为被分派人，原负责人不再可见该条数据

**操作入口：** 客户/项目/任务列表和详情页，经理及超管可见"分派给..."按钮，点击后弹出团队成员选择器

**操作日志：** 新增 `assignment_logs` 表记录每次分派操作

```sql
id            UUID PRIMARY KEY
team_id       UUID REFERENCES teams(id)
resource_type TEXT CHECK (resource_type IN ('customer', 'project', 'task'))
resource_id   UUID
assigned_from UUID REFERENCES auth.users(id)
assigned_to   UUID REFERENCES auth.users(id)
operated_by   UUID REFERENCES auth.users(id)
created_at    TIMESTAMPTZ DEFAULT NOW()
```

---

## 经理视图切换

销售经理在客户、项目、任务列表页默认只显示自己负责的数据，与普通销售体验一致。

页面顶部提供"查看全团队"切换开关，开启后显示团队所有成员的数据，并支持按负责人筛选。

- 切换状态保存在本地（localStorage），刷新后保持上次选择
- 超管默认也采用同样的切换机制

---

## 审批流

### 触发场景

普通销售（sales_rep）执行以下操作时，数据不直接生效，进入待审批状态：
- 新建客户
- 新建项目
- 修改项目关键字段：金额、状态、预计关单日期

销售经理和超管的操作不需要审批，直接生效。

### 审批人配置

超管可在团队设置中配置审批角色（`sales_manager` 或 `super_admin`），默认为 `sales_manager`。

### 数据状态流转

```
提交 → pending（待审批）→ approved（通过，正式生效）
                        → rejected（驳回，附驳回原因）
```

### 待审批期间规则

- 提交人可见自己提交的内容，标记"待审批"
- 审批人可见所有待审条目
- 其他成员不可见该条数据
- 修改项目关键字段时：原数据继续生效，新值以 pending 状态等待审批，通过后覆盖原值

### 新增表

**`approval_requests`**
```sql
id              UUID PRIMARY KEY
team_id         UUID REFERENCES teams(id) ON DELETE CASCADE
type            TEXT CHECK (type IN ('create_customer', 'create_project', 'update_project'))
target_id       UUID        -- 关联的 customer/project id（新建时为空，审批通过后填入）
payload         JSONB       -- 待审批的数据快照
submitted_by    UUID REFERENCES auth.users(id)
reviewed_by     UUID REFERENCES auth.users(id)
status          TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending'
reject_reason   TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
reviewed_at     TIMESTAMPTZ
```

### 新增页面

| 路由 | 功能 | 可见角色 |
|------|------|---------|
| `/dashboard/admin/approvals` | 待审批列表，通过/驳回操作 | super_admin, sales_manager（按配置） |

### 权限矩阵补充

| 功能 | 超级管理员 | 销售经理 | 普通销售 |
|------|-----------|---------|---------|
| 提交审批请求 | 不需要 | 不需要 | ✓ |
| 审批通过/驳回 | ✓ | ✓（按配置） | ✗ |
| 查看自己的待审内容 | — | — | ✓ |

---

## 不在本期范围内

- 多团队支持（当前设计每个用户只属于一个团队）
- 细粒度字段级权限
- 操作审计日志
- 单点登录（SSO）
- 多级审批（当前只支持单级）
