'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  CheckSquare,
  Settings,
  UserCog,
  BookOpen,
  ClipboardCheck,
  Inbox,
  LucideIcon
} from 'lucide-react'

interface NavigationItem {
  name: string
  href: string
  iconName: string
  showPendingBadge?: boolean
  showInboxBadge?: boolean
}

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  CheckSquare,
  Settings,
  UserCog,
  BookOpen,
  ClipboardCheck,
  Inbox,
}

export function SidebarNavigation({ navigation }: { navigation: NavigationItem[] }) {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [inboxCount, setInboxCount] = useState(0)

  const hasPendingBadge = navigation.some(n => n.showPendingBadge)
  const hasInboxBadge = navigation.some(n => n.showInboxBadge)

  useEffect(() => {
    if (!hasPendingBadge) return
    fetch('/api/approvals')
      .then(r => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setPendingCount(data.filter((r: any) => r.status === 'pending').length)
        }
      })
      .catch(() => {})
  }, [hasPendingBadge])

  useEffect(() => {
    if (!hasInboxBadge) return
    fetch('/api/inbox?count=true')
      .then(r => r.json())
      .then((data: unknown) => {
        if (data && typeof data === 'object' && 'unread' in data) {
          setInboxCount((data as { unread: number }).unread)
        }
      })
      .catch(() => {})
  }, [hasInboxBadge])

  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {navigation.map((item) => {
        const Icon = iconMap[item.iconName]
        if (!Icon) return null

        const isActive = pathname === item.href
        const badge = item.showPendingBadge ? pendingCount : item.showInboxBadge ? inboxCount : 0

        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center px-3 py-2.5 pr-4 text-sm font-medium rounded-full transition-all duration-200 ease-in-out ${
              isActive
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <Icon className={`w-4.5 h-4.5 mr-4 transition-colors duration-200 ease-in-out ${
              isActive ? 'text-white' : 'text-zinc-500'
            }`} />
            {item.name}
            {badge > 0 && (
              <span className="ml-auto text-xs bg-rose-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                {badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
