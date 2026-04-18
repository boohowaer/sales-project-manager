'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  CheckSquare,
  Settings,
  LucideIcon
} from 'lucide-react'

interface NavigationItem {
  name: string
  href: string
  iconName: string
}

// 图标映射表
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  CheckSquare,
  Settings
}

export function SidebarNavigation({ navigation }: { navigation: NavigationItem[] }) {
  const pathname = usePathname()

  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {navigation.map((item) => {
        const Icon = iconMap[item.iconName]
        if (!Icon) return null

        const isActive = pathname === item.href
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
          </Link>
        )
      })}
    </nav>
  )
}
