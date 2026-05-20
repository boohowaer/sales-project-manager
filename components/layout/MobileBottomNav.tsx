'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  FileText,
  MoreHorizontal,
  ClipboardCheck,
  UserCog,
  BookOpen,
  Settings,
  LogOut,
  Users,
  X,
  LucideIcon
} from 'lucide-react'
import { toast } from 'react-hot-toast'

interface NavigationItem {
  name: string
  href: string
  iconName: string
  showPendingBadge?: boolean
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
}

type TabItem = {
  name: string
  href: string
  Icon: LucideIcon
  isMore?: boolean
}

const tabs: TabItem[] = [
  { name: '项目', href: '/dashboard/projects', Icon: FolderKanban },
  { name: '任务', href: '/dashboard/tasks', Icon: CheckSquare },
  { name: '首页', href: '/dashboard', Icon: LayoutDashboard },
  { name: '进展', href: '/dashboard/updates', Icon: FileText },
  { name: '更多', href: '#more', Icon: MoreHorizontal, isMore: true },
]

const moreItemNames = ['客户', '审批', '成员管理', '数据字典', '设置']

export function MobileBottomNav({ navigation }: { navigation: NavigationItem[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [loggingOut, setLoggingOut] = useState(false)

  const hasPendingBadge = navigation.some(n => n.showPendingBadge)

  useEffect(() => {
    if (!hasPendingBadge) return
    fetch('/api/approvals?pending_for_me=true')
      .then(r => r.json())
      .then((data: unknown) => {
        if (data && typeof data === 'object' && 'count' in data) {
          setPendingCount((data as { count: number }).count)
        }
      })
      .catch(() => {})
  }, [hasPendingBadge, pathname])

  // 路由变化时关闭更多菜单
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const moreItems = navigation.filter(n => moreItemNames.includes(n.name))

  const isMoreActive = moreItems.some(item => {
    if (item.href === '/dashboard') return false
    return pathname === item.href || pathname.startsWith(item.href + '/')
  })

  const isTabActive = (tab: TabItem) => {
    if (tab.isMore) return isMoreActive
    if (tab.href === '/dashboard') return pathname === '/dashboard'
    return pathname === tab.href || pathname.startsWith(tab.href + '/')
  }

  const handleLogout = useCallback(async () => {
    setLoggingOut(true)
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error('退出登录失败')
      toast.success('已成功退出登录')
      router.push('/login')
      router.refresh()
    } catch {
      toast.error('退出登录失败，请重试')
    } finally {
      setLoggingOut(false)
    }
  }, [router])

  const closeMore = useCallback(() => setMoreOpen(false), [])

  return (
    <>
      {/* 更多 - 底部弹出菜单 */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={closeMore}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl animate-slide-up">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 bg-zinc-200 rounded-full" />
            </div>
            <div className="px-5 pb-2">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-semibold text-zinc-900">更多功能</span>
                <button
                  onClick={closeMore}
                  className="p-1.5 -mr-1.5 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="px-5 pb-2 space-y-0.5">
              {moreItems.map(item => {
                const Icon = iconMap[item.iconName]
                if (!Icon) return null
                const itemActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={closeMore}
                    className={`flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-colors ${
                      itemActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mr-3 ${itemActive ? 'text-zinc-900' : 'text-zinc-400'}`} />
                    {item.name}
                    {item.showPendingBadge && pendingCount > 0 && (
                      <span className="ml-auto text-xs bg-rose-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
            <div className="mx-5 border-t border-zinc-100" />
            <div className="px-5 pt-2 pb-10">
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center w-full px-3 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50"
              >
                <LogOut className="w-5 h-5 mr-3" />
                {loggingOut ? '退出中...' : '退出登录'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 底部导航栏 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-zinc-100">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {tabs.map((tab) => {
            const active = isTabActive(tab)

            if (tab.isMore) {
              return (
                <button
                  key={tab.name}
                  onClick={() => setMoreOpen(prev => !prev)}
                  className="flex flex-col items-center justify-center flex-1 py-1"
                >
                  <div className="relative">
                    <tab.Icon className={`w-5 h-5 transition-colors ${moreOpen || active ? 'text-zinc-900' : 'text-zinc-400'}`} />
                    {active && !moreOpen && (
                      <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-zinc-900 rounded-full" />
                    )}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium transition-colors ${moreOpen || active ? 'text-zinc-900' : 'text-zinc-400'}`}>
                    更多
                  </span>
                </button>
              )
            }

            return (
              <Link
                key={tab.name}
                href={tab.href}
                onClick={closeMore}
                className="flex flex-col items-center justify-center flex-1 py-1"
              >
                <tab.Icon className={`w-5 h-5 transition-colors ${active ? 'text-zinc-900' : 'text-zinc-400'}`} />
                <span className={`text-[10px] mt-1 font-medium transition-colors ${active ? 'text-zinc-900' : 'text-zinc-400'}`}>
                  {tab.name}
                </span>
              </Link>
            )
          })}
        </div>
        <div className="bg-white" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </nav>
    </>
  )
}
