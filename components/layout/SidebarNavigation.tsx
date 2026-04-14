'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as LucideIcons from 'lucide-react'

interface SidebarNavigationProps {
  navigation: Array<{
    name: string
    href: string
    iconName: string
  }>
}

export function SidebarNavigation({ navigation }: SidebarNavigationProps) {
  const pathname = usePathname()

  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {navigation.map((item) => {
        // 动态获取图标组件
        const Icon = LucideIcons[item.iconName as keyof typeof LucideIcons]
        const isActive = pathname === item.href
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center px-3 py-2.5 pr-4 text-sm font-medium rounded-full transition-all ${
              isActive
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <Icon className={`w-4.5 h-4.5 mr-4 transition-colors ${
              isActive ? 'text-white' : 'text-zinc-500'
            }`} />
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
}
