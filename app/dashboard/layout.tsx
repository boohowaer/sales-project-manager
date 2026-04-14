import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, Users, FolderKanban, CheckSquare, Settings, LogOut } from 'lucide-react'
import { signOut } from '@/lib/supabase/auth'

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
    { name: '仪表板', href: '/dashboard', icon: LayoutDashboard },
    { name: '客户', href: '/dashboard/customers', icon: Users },
    { name: '项目', href: '/dashboard/projects', icon: FolderKanban },
    { name: '任务', href: '/dashboard/tasks', icon: CheckSquare },
    { name: '设置', href: '/dashboard/settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">销售项目管理</h1>
          </div>

          {/* 导航 */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 group"
                >
                  <Icon className="w-5 h-5 mr-3 text-gray-400 group-hover:text-gray-500" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* 用户信息 */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.email}
                </p>
              </div>
            </div>
            <form action={async () => {
              'use server'
              await signOut()
              redirect('/login')
            }}>
              <Button type="submit" variant="outline" className="w-full" size="sm">
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
