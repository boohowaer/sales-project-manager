'use client'

import { NotificationBell } from '@/components/ui/notification-bell'

interface TopBarProps {
  userEmail?: string
}

export function TopBar({ userEmail }: TopBarProps) {
  return (
    <div className="fixed top-0 right-0 left-64 z-40 h-16 bg-white/80 backdrop-blur-md border-b border-zinc-200/50">
      <div className="flex items-center justify-end h-full px-6 gap-4">
        {/* 账号邮箱 */}
        {userEmail && (
          <span className="text-sm text-zinc-500 hidden sm:block">{userEmail}</span>
        )}

        {/* 通知铃铛 */}
        <NotificationBell userEmail={userEmail} />
      </div>
    </div>
  )
}