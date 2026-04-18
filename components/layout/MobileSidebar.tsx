'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { SidebarNavigation } from './SidebarNavigation'
import { LogoutButton } from '@/components/auth/LogoutButton'

interface NavigationItem {
  name: string
  href: string
  iconName: string
}

export function MobileSidebar({ navigation }: { navigation: NavigationItem[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* 汉堡菜单按钮 */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-zinc-900 text-white shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* 遮罩层 */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 抽屉侧边栏 */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: '#090702' }}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-20 px-6" style={{ backgroundColor: '#090702' }}>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: 'var(--font-poppins), sans-serif' }}>Sales to Do</h1>
              <p className="text-xs" style={{ color: '#999999' }}>销售个人任务管理工具</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div onClick={() => setOpen(false)} className="flex-1 overflow-y-auto">
            <SidebarNavigation navigation={navigation} />
          </div>

          <div className="p-4">
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  )
}
