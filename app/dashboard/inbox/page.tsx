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
  onRemoveByLink,
}: {
  notif: InboxNotification
  onMarkRead: (id: string) => void
  onRemoveByLink: (linkType: string, linkId: string) => void
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
            if (notif.link_type === 'task' && notif.link_id) {
              await fetch(`/api/inbox/by-link?linkType=task&linkId=${notif.link_id}`, {
                method: 'DELETE',
              })
              onRemoveByLink('task', notif.link_id)
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

  const removeByLink = (linkType: string, linkId: string) => {
    setNotifications(prev => prev.filter(n => !(n.link_type === linkType && n.link_id === linkId)))
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
            <NotifItem key={n.id} notif={n} onMarkRead={markRead} onRemoveByLink={removeByLink} />
          ))}
        </div>
      )}
    </div>
  )
}
