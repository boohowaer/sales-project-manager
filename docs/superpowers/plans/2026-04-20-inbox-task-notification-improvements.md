# 收件箱任务提醒优化 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 点击"去处理"后删除同任务所有收件箱通知；任务/节点提醒 body 增加项目名称。

**Architecture:** 新增 `deleteNotificationsByLink` 查询函数 → 新增 `DELETE /api/inbox/by-link` 路由 → 收件箱页面点击"去处理"时先删除再跳转 → TasksContext 写通知时 body 加项目名。

**Tech Stack:** Next.js 15 App Router, Supabase, TypeScript, Tailwind CSS

---

## 文件改动清单

| 文件 | 操作 |
|------|------|
| `lib/supabase/inbox-queries.ts` | 修改：新增 `deleteNotificationsByLink` |
| `app/api/inbox/by-link/route.ts` | 新增：DELETE 按 link_type+link_id 删除通知 |
| `app/dashboard/inbox/page.tsx` | 修改：任务类通知"去处理"点击时先删除再跳转 |
| `context/TasksContext.tsx` | 修改：body 加项目名 |

---

### Task 1: inbox-queries 新增 deleteNotificationsByLink

**Files:**
- Modify: `lib/supabase/inbox-queries.ts`

- [ ] **Step 1: 在文件末尾追加函数**

```typescript
export async function deleteNotificationsByLink(
  userId: string,
  linkType: InboxLinkType,
  linkId: string
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('inbox_notifications')
    .delete()
    .eq('user_id', userId)
    .eq('link_type', linkType)
    .eq('link_id', linkId)
  if (error) throw error
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/inbox-queries.ts
git commit -m "feat: inbox-queries 新增 deleteNotificationsByLink"
```

---

### Task 2: 新增 DELETE /api/inbox/by-link

**Files:**
- Create: `app/api/inbox/by-link/route.ts`

- [ ] **Step 1: 创建文件**

```typescript
import { NextResponse } from 'next/server'
import { getUserTeamContext } from '@/lib/auth/get-user-role'
import { deleteNotificationsByLink } from '@/lib/supabase/inbox-queries'
import type { InboxLinkType } from '@/types'

export async function DELETE(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const linkType = searchParams.get('linkType') as InboxLinkType | null
  const linkId = searchParams.get('linkId')

  if (!linkType || !linkId) {
    return NextResponse.json({ error: 'linkType and linkId are required' }, { status: 400 })
  }

  await deleteNotificationsByLink(ctx.userId, linkType, linkId)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/inbox/by-link/route.ts
git commit -m "feat: 新增 DELETE /api/inbox/by-link 按 link 批量删除通知"
```

---

### Task 3: 收件箱页面 — 任务类"去处理"点击时先删除再跳转

**Files:**
- Modify: `app/dashboard/inbox/page.tsx`

当前 `NotifItem` 组件的"去处理"按钮点击逻辑：先标记已读，再跳转。

需要改为：对 `link_type === 'task'` 的通知，点击"去处理"时先调用 DELETE /api/inbox/by-link 删除同任务所有通知，再跳转。

- [ ] **Step 1: 修改 NotifItem 组件中的"去处理"按钮 onClick**

找到 `NotifItem` 函数中的"去处理"按钮，将：

```typescript
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
```

替换为：

```typescript
      {target && (
        <button
          onClick={async e => {
            e.stopPropagation()
            if (notif.link_type === 'task' && notif.link_id) {
              await fetch(`/api/inbox/by-link?linkType=task&linkId=${notif.link_id}`, {
                method: 'DELETE',
              })
              onMarkRead(notif.id)
            } else {
              await doMarkRead()
            }
            router.push(target)
          }}
          className="shrink-0 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors mt-0.5"
        >
          去处理 <ArrowRight className="w-3 h-3" />
        </button>
      )}
```

同时修改 `markRead` 函数，支持按 link 批量从本地 state 移除：

找到 `InboxPage` 中的 `markRead`：
```typescript
  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }
```

在其下方新增 `removeByLink`：
```typescript
  const removeByLink = (linkType: string, linkId: string) => {
    setNotifications(prev => prev.filter(n => !(n.link_type === linkType && n.link_id === linkId)))
  }
```

并将 `NotifItem` 的 props 和调用更新，传入 `onRemoveByLink`：

将 `NotifItem` 的 props 类型改为：
```typescript
function NotifItem({
  notif,
  onMarkRead,
  onRemoveByLink,
}: {
  notif: InboxNotification
  onMarkRead: (id: string) => void
  onRemoveByLink: (linkType: string, linkId: string) => void
})
```

将"去处理"按钮 onClick 中的 `onMarkRead(notif.id)` 改为 `onRemoveByLink('task', notif.link_id!)`。

在 `InboxPage` 的列表渲染处，给 `NotifItem` 传入 `onRemoveByLink={removeByLink}`：
```typescript
          {displayed.map(n => (
            <NotifItem key={n.id} notif={n} onMarkRead={markRead} onRemoveByLink={removeByLink} />
          ))}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/inbox/page.tsx
git commit -m "feat: 收件箱任务类通知点击去处理时删除同任务所有通知"
```

---

### Task 4: TasksContext — body 加项目名

**Files:**
- Modify: `context/TasksContext.tsx`

- [ ] **Step 1: 修改 writeTaskNotifications 中的 body 拼接**

找到 overdue 的 body：
```typescript
        body: `「${task.title}」已过期`,
```
替换为：
```typescript
        body: `「${task.title}」已过期${task.projects?.name ? `（${task.projects.name}）` : ''}`,
```

找到 upcoming 的 body：
```typescript
        body: `「${task.title}」即将在 ${dateStr} 到期`,
```
替换为：
```typescript
        body: `「${task.title}」即将在 ${dateStr} 到期${task.projects?.name ? `（${task.projects.name}）` : ''}`,
```

- [ ] **Step 2: Commit**

```bash
git add context/TasksContext.tsx
git commit -m "feat: 任务提醒 body 增加项目名称"
```
