import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SidebarNavigation } from '@/components/layout/SidebarNavigation'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { MobileSidebar } from '@/components/layout/MobileSidebar'
import { TasksProviderWrapper } from '@/components/layout/TasksProvider'
import { BrowserNotificationProvider } from '@/components/layout/BrowserNotificationProvider'
import { getUserTeamContext } from '@/lib/auth/get-user-role'

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

  const ctx = await getUserTeamContext()

  if (!ctx) {
    redirect('/disabled')
  }

  const isManager = ctx.role === 'super_admin' || ctx.role === 'sales_manager'

  const navigation = [
    { name: '仪表板', href: '/dashboard', iconName: 'LayoutDashboard' },
    { name: '收件箱', href: '/dashboard/inbox', iconName: 'Inbox', showInboxBadge: true },
    { name: '客户', href: '/dashboard/customers', iconName: 'Users' },
    { name: '项目', href: '/dashboard/projects', iconName: 'FolderKanban' },
    { name: '进展', href: '/dashboard/updates', iconName: 'FileText' },
    { name: '任务', href: '/dashboard/tasks', iconName: 'CheckSquare' },
    { name: '审批', href: '/dashboard/approvals', iconName: 'ClipboardCheck', showPendingBadge: isManager },
    ...(ctx?.role === 'super_admin' ? [
      { name: '成员管理', href: '/dashboard/admin/users', iconName: 'UserCog' },
      { name: '数据字典', href: '/dashboard/admin/dictionary', iconName: 'BookOpen' },
    ] : []),
    { name: '设置', href: '/dashboard/settings', iconName: 'Settings' },
  ]

  return (
    <div className="min-h-screen bg-[#f0f0f0]">
      {/* 桌面端侧边栏（md 以上显示） */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-64 flex-col shadow-lg" style={{ backgroundColor: '#090702' }}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex flex-col justify-center h-20 px-6" style={{ backgroundColor: '#090702' }}>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#ffffff', fontFamily: 'var(--font-poppins), sans-serif' }}>Sales to Do</h1>
            <p className="text-xs" style={{ color: '#999999' }}>销售个人任务管理工具</p>
          </div>

          {/* 导航 */}
          <SidebarNavigation navigation={navigation} />

          {/* 退出登录按钮 */}
          <div className="p-4">
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* 移动端抽屉式侧边栏 */}
      <MobileSidebar navigation={navigation} />

      <BrowserNotificationProvider>
        <TasksProviderWrapper>
          <div className="md:pl-64">
            <main className="min-h-screen">
              {children}
            </main>
          </div>
        </TasksProviderWrapper>
      </BrowserNotificationProvider>
    </div>
  )
}
