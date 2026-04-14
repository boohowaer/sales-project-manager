import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { signOut } from '@/lib/supabase/auth'
import { SidebarNavigation } from '@/components/layout/SidebarNavigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const navigation = [
    { name: '仪表板', href: '/dashboard', iconName: 'LayoutDashboard' },
    { name: '客户', href: '/dashboard/customers', iconName: 'Users' },
    { name: '项目', href: '/dashboard/projects', iconName: 'FolderKanban' },
    { name: '任务', href: '/dashboard/tasks', iconName: 'CheckSquare' },
    { name: '进展', href: '/dashboard/updates', iconName: 'FileText' },
    { name: '设置', href: '/dashboard/settings', iconName: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-[#f0f0f0]">
      {/* 侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 shadow-lg" style={{ backgroundColor: '#090702' }}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex flex-col justify-center h-20 px-6 border-b pt-4" style={{ borderColor: '#1a1a1a' }}>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#ffffff', fontFamily: 'var(--font-poppins), sans-serif' }}>Sales to Do</h1>
            <p className="text-xs" style={{ color: '#999999' }}>销售个人任务管理工具</p>
          </div>

          {/* 导航 */}
          <SidebarNavigation navigation={navigation} />

          {/* 用户信息 */}
          <div className="p-4 border-t" style={{ borderColor: '#1a1a1a' }}>
            <div className="flex items-center mb-4">
              <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white font-medium text-sm shadow-md">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user.email}
                </p>
              </div>
            </div>
            <form action={async () => {
              'use server'
              await signOut()
              redirect('/login')
            }}>
              <Button
                type="submit"
                className="w-full bg-white/10 text-white hover:bg-white/20 hover:text-white border-0"
                size="sm"
              >
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {/* 主内容区域 */}
      <div className="pl-64">
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}
