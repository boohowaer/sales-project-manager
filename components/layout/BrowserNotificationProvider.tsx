'use client'

import { useEffect } from 'react'
import type { InboxNotification } from '@/types'

export function BrowserNotificationProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    async function init() {
      if (Notification.permission === 'default') {
        await Notification.requestPermission()
      }
      pushUnpushed()
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

    init()
  }, [])

  return <>{children}</>
}
