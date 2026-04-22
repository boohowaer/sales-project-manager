# 角色权限、审批与通知系统设计

日期：2026-04-22

## 背景

现有权限设计过于简单：数据查看范围由前端手动切换，审批权限硬编码在角色判断里，通知系统仅覆盖站内消息弹窗，审批流缺乏完整的参与人通知和管理视图。本次改造目标：

1. 支持每个成员单独配置数据查看范围
2. 新增"审批抄送知情"权限，支持逐人配置
3. 完善审批全流程通知（发起人、审批人、抄送人）
4. 新增审批管理页面，替换现有"待审批"入口
5. 新增收件箱页面，记录所有通知历史
6. 浏览器通知覆盖所有提醒类型，支持登录补推

---

## 一、数据库变更

### 1.1 team_members 表

```sql
ALTER TABLE team_members
  ADD COLUMN data_scope TEXT CHECK (data_scope IN ('own', 'team')) DEFAULT 'own',
  ADD COLUMN approval_cc BOOLEAN DEFAULT false;
```

- `data_scope`：`own`（默认）只看自己数据；`team` 看全团队。super_admin / sales_manager 初始化默认 `team`
- `approval_cc`：仅对 sales_rep 有意义；manager 本身有审批权，此字段不适用

### 1.2 inbox_notifications 表（新增）

```sql
CREATE TABLE inbox_notifications (
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
  browser_pushed BOOLEAN DEFAULT false,  -- 是否已推送浏览器通知
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 1.3 approval_urge_log 表（新增）

```sql
CREATE TABLE approval_urge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL,
  urged_by UUID NOT NULL REFERENCES auth.users(id),
  urged_at TIMESTAMPTZ DEFAULT now()
);
```

用于限制催办频率：同一审批项 24 小时内只能催一次。

迁移文件：`migrations/YYYYMMDD_add_member_permissions.sql`

---

## 二、数据范围控制

### 后端

`/api/me` 响应新增 `data_scope`、`approval_cc` 字段。

`lib/supabase/queries.ts` 中 `getCustomers` / `getProjects` / `getTasks` 改为服务端读取 `data_scope`，不再依赖前端 `teamView` 参数：

```typescript
if (member.data_scope === 'own') {
  query = query.eq('user_id', member.userId)
}
```

### 前端

- `useTeamView` 切换开关只对 `data_scope === 'team'` 的用户显示
- `data_scope === 'own'` 的用户不显示切换按钮，始终只看自己数据

---

## 三、审批全流程通知

### 3.1 通知触发时机

| 事件 | 通知对象 | 通知类型 |
|------|---------|---------|
| 发起人提交审批 | 第一个审批节点的审批人 | `approval_submitted` |
| 某节点审批通过 | 发起人 + 下一节点审批人 | `approval_approved` |
| 某节点审批拒绝 | 发起人 | `approval_rejected` |
| 最终节点审批通过 | 发起人 + 所有 `approval_cc=true` 成员 | `approval_approved` + `approval_cc` |
| 发起人催办 | 当前待审批节点的审批人 | `approval_urge_received` |

**注意：**
- 审批抄送（`approval_cc`）仅在最终节点通过时触发，拒绝不通知
- 发起人收到每个节点的通过/拒绝结果通知

### 3.2 后端实现

`POST /api/approvals`（提交审批）：写入 `approval_submitted` 通知给第一个审批人。

`PATCH /api/approvals/[id]`（通过/拒绝）：
- 通过：写 `approval_approved` 通知给发起人；若有下一节点，写 `approval_submitted` 给下一审批人；若是最终节点，额外写 `approval_cc` 给所有 cc 成员
- 拒绝：写 `approval_rejected` 通知给发起人

`POST /api/approvals/[id]/urge`（催办）：
- 检查 `approval_urge_log`，若 24 小时内已催过则返回 `429`
- 写入 `approval_urge_received` 通知给当前待审批人
- 写入 `approval_urge_log` 记录

所有通知写入 `inbox_notifications` 表，`browser_pushed=false`。

### 3.3 登录补推

用户登录后，查询 `inbox_notifications` 中 `browser_pushed=false` 的记录，逐条触发浏览器通知，然后批量更新 `browser_pushed=true`。

---

## 四、浏览器通知（统一）

在 `app/dashboard/layout.tsx` 中统一请求权限：

```typescript
useEffect(() => {
  if (Notification.permission === 'default') {
    Notification.requestPermission()
  }
}, [])
```

### 4.1 触发逻辑

| 类型 | 触发时机 | 判断条件 |
|------|---------|---------|
| 任务过期 | 每天 10:00（登录补推） | `due_date < 今天` 且未完成 |
| 任务即将到期 | 到期前 `reminder_advance_hours` 小时（登录补推） | `due_date` 在今天到设定小时内 |
| 节点提醒 | 到期前 `milestone_reminder_days` 天（登录补推） | 验收/开票/回款计划日期在设定天数内 |
| 审批相关 | 实时触发 + 登录补推 | 见第三节 |

- `reminder_advance_hours` 和 `milestone_reminder_days` 同时控制提醒面板展示范围和浏览器通知推送时机
- 任务/节点提醒写入 `inbox_notifications`（`browser_pushed=false`），登录时统一补推
- 用 `localStorage` 记录当天已推送的任务/节点 ID，避免同一天重复弹出

### 4.2 通知内容示例

```
任务过期：「跟进客户 A 报价」已过期（2026-04-20）
即将到期：「提交方案」将于 2026-04-24 到期
节点提醒：项目「XX 系统」验收节点将于 2026-04-25 到期
审批通过：你发起的「创建项目 XX」第 1 步已通过
审批拒绝：你发起的「创建项目 XX」第 2 步被拒绝
待审批：「创建项目 XX」等待你审批
催办：「创建项目 XX」发起人催你处理
```

---

## 五、审批管理页面

替换现有"待审批"菜单入口，面向所有用户开放，路径：`/dashboard/approvals`。

### 5.1 视图内容

| 区域 | 内容 | 可见角色 |
|------|------|---------|
| 待我处理 | 当前需要该用户审批的项，可直接通过/驳回 | 审批人（manager） |
| 我发起的 | 自己提交的所有审批历史，含当前状态和每个节点进度 | 所有用户 |
| 全部审批 | 权限内所有审批记录（只读） | manager + approval_cc |

### 5.2 操作权限

| 操作 | 条件 |
|------|------|
| 通过/驳回 | 仅对"待我处理"中的审批项 |
| 催办 | 仅对"我发起的"中进行中的审批项；同一审批项 24 小时内限催一次 |
| 查看详情 | 所有用户均可查看权限内的审批详情 |

### 5.3 催办交互

- 催办按钮在 24 小时冷却期内显示为禁用状态，hover 提示"已催办，请等待 X 小时后再催"
- 催办成功后被催办人收到浏览器通知

---

## 六、收件箱页面

路径：`/dashboard/inbox`，位置：侧边栏"仪表板"下方。

### 6.1 内容

显示当前用户所有 `inbox_notifications` 记录，按时间倒序，分为"未读"和"全部"两个 tab。

### 6.2 列表项格式

```
[图标] [标题]                          [时间]
       [正文摘要]              [去处理 →]（可选）
```

"去处理"按钮仅对以下类型显示：

| 通知类型 | 跳转目标 |
|---------|---------|
| `task_overdue` / `task_upcoming` | `/dashboard/tasks` |
| `milestone` | `/dashboard/projects` |
| `approval_submitted` / `approval_approved` / `approval_rejected` / `approval_urge_received` | `/dashboard/approvals` |

### 6.3 已读状态

- 点击"去处理"或点击列表项时标记为已读（`is_read=true`）
- 顶部显示未读数量角标，与侧边栏菜单图标联动

---

## 七、成员管理页面改造

`MemberTable` 每行新增两个可编辑字段：

| 字段 | 控件 | 可编辑条件 |
|------|------|---------|
| 数据范围 | 下拉（仅自己 / 全团队） | sales_rep 可改；manager 固定"全团队"不可改 |
| 审批抄送 | 开关 | sales_rep 可改；manager 显示"已有审批权"灰色不可改 |

保存接口：`PATCH /api/admin/users/[id]`，body：`{ data_scope, approval_cc }`，仅 super_admin 可调用。

---

## 八、受影响文件

| 文件 | 变更类型 |
|------|---------|
| `migrations/YYYYMMDD_add_member_permissions.sql` | 新增 |
| `app/api/me/route.ts` | 新增 data_scope、approval_cc |
| `app/api/approvals/route.ts` | POST 写通知给第一审批人；GET 扩展 approval_cc 访问 |
| `app/api/approvals/[id]/route.ts` | PATCH 写全流程通知 |
| `app/api/approvals/[id]/urge/route.ts` | 新增催办接口 |
| `app/api/inbox/route.ts` | 新增收件箱查询接口 |
| `app/api/inbox/[id]/read/route.ts` | 新增标记已读接口 |
| `app/api/admin/users/[id]/route.ts` | PATCH 更新 data_scope、approval_cc |
| `lib/supabase/queries.ts` | 数据范围从 DB 读取 |
| `lib/auth/get-user-role.ts` | UserTeamContext 新增 data_scope、approval_cc |
| `hooks/useTeamView.ts` | 根据 data_scope 控制开关显示 |
| `app/dashboard/layout.tsx` | 请求浏览器通知权限；登录补推逻辑 |
| `app/dashboard/page.tsx` | 节点提醒写入 inbox + 触发浏览器通知 |
| `context/TasksContext.tsx` | 任务提醒写入 inbox + 触发浏览器通知 |
| `app/dashboard/approvals/page.tsx` | 新增审批管理页（替换原待审批页） |
| `app/dashboard/inbox/page.tsx` | 新增收件箱页面 |
| `components/admin/MemberTable.tsx` | 新增 data_scope、approval_cc 编辑字段 |
| `components/layout/Sidebar.tsx` | 菜单调整：待审批→审批管理；新增收件箱入口 |
