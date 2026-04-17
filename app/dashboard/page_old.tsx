'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getDashboardStats, getCustomers, createCustomer, createProject, getUserSettings } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, FolderKanban, CheckSquare, TrendingUp, Info, FileCheck, FileText, DollarSign, Receipt, FileEdit } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/components/ui/notification-bell'
import { useTasks } from '@/context/TasksContext'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<any>(null)
  const [userSettings, setUserSettings] = useState<any>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // 使用 Context 中的任务数据
  const { overdueTasks, upcomingTasks } = useTasks()

  // 客户对话框状态
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false)
  const [customerFormData, setCustomerFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    notes: ''
  })

  // 项目对话框状态
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [projectFormData, setProjectFormData] = useState({
    name: '',
    description: '',
    customer_id: '',
    status: 'active',
    value: '',
    probability: 50,
    start_date: '',
    expected_close_date: '',
    has_start_notice: false,
    contract_signed: false,
    settlement_stages: 1
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const [statsData, customersData, settingsData] = await Promise.all([
        getDashboardStats(),
        getCustomers(),
        getUserSettings()
      ])
      setStats(statsData)
      setCustomers(customersData)
      setUserSettings(settingsData)
      if (user?.email) {
        setUserEmail(user.email)
      }
    } catch (error: any) {
      console.error('加载数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!customerFormData.name) {
      toast.error('请输入客户名称')
      return
    }

    try {
      await createCustomer({
        name: customerFormData.name,
        company: customerFormData.company || null,
        email: customerFormData.email || null,
        phone: customerFormData.phone || null,
        notes: customerFormData.notes || null
      })
      toast.success('客户创建成功')
      setCustomerDialogOpen(false)
      setCustomerFormData({ name: '', company: '', email: '', phone: '', notes: '' })
      loadData()
    } catch (error: any) {
      toast.error(error.message || '创建客户失败')
    }
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!projectFormData.name || !projectFormData.customer_id) {
      toast.error('请填写项目名称和选择客户')
      return
    }

    try {
      const settlementStagesNumber = typeof projectFormData.settlement_stages === 'number'
        ? projectFormData.settlement_stages
        : parseInt(projectFormData.settlement_stages as any) || 1

      await createProject({
        name: projectFormData.name,
        description: projectFormData.description || null,
        customer_id: projectFormData.customer_id,
        status: projectFormData.status as any,
        value: projectFormData.value ? parseFloat(projectFormData.value) : null,
        probability: projectFormData.probability,
        start_date: projectFormData.start_date || null,
        expected_close_date: projectFormData.expected_close_date || null,
        actual_close_date: null,
        has_start_notice: projectFormData.has_start_notice,
        contract_signed: projectFormData.contract_signed,
        settlement_stages: settlementStagesNumber
      })
      toast.success('项目创建成功')
      setProjectDialogOpen(false)
      setProjectFormData({
        name: '',
        description: '',
        customer_id: '',
        status: 'active',
        value: '',
        probability: 50,
        start_date: '',
        expected_close_date: '',
        has_start_notice: false,
        contract_signed: false,
        settlement_stages: 1
      })
      loadData()
    } catch (error: any) {
      toast.error(error.message || '创建项目失败')
    }
  }

  const handleQuickAction = (action: string) => {
    if (action === 'createProject') {
      sessionStorage.setItem('openProjectDialog', 'true')
      router.push('/dashboard/projects')
    } else if (action === 'addTask') {
      sessionStorage.setItem('openTaskDialog', 'true')
      router.push('/dashboard/tasks')
    } else if (action === 'updateProgress') {
      router.push('/dashboard/updates')
    }
  }

  // 计算达成进度
  const getProgressPercentage = (amount: number) => {
    if (!userSettings?.sales_goal || userSettings.sales_goal === 0) return null
    const percentage = (amount / userSettings.sales_goal) * 100
    return percentage.toFixed(1)
  }

  if (loading || !stats) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="text-gray-500">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* 页面标题和通知 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">仪表板</h1>
          <p className="mt-2 text-zinc-500 text-sm">欢迎回来！这是您的项目概览。</p>
        </div>
        <div className="flex items-center gap-4">
          {userEmail && (
            <span className="text-sm text-zinc-500">{userEmail}</span>
          )}
          <NotificationBell userEmail={userEmail} />
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 gap-5 mb-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-zinc-500">
              总项目数
            </CardTitle>
            <FolderKanban className="w-4.5 h-4.5 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{stats.totalProjects}</div>
            <div className="flex items-center gap-1.5 mt-2 group relative">
              <p className="text-sm text-zinc-500">
                其中 {stats.activeProjects} 个活跃项目
              </p>
              <Info className="w-3.5 h-3.5 text-zinc-300 cursor-help" />
              {/* Tooltip */}
              <div className="absolute left-0 top-full mt-2.5 w-72 p-3 bg-zinc-900 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <p className="font-medium mb-1.5">活跃项目（Active Projects）</p>
                <p className="text-zinc-300">
                  状态为"进行中"的项目数量
                </p>
                <p className="text-zinc-400 mt-2">
                  项目状态包括：进行中、已成交、已丢失、暂停
                </p>
                {/* 小三角 */}
                <div className="absolute -top-1.5 left-4 w-2.5 h-2.5 bg-zinc-900 transform rotate-45"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-zinc-500">
              今日任务
            </CardTitle>
            <CheckSquare className="w-4.5 h-4.5 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{stats.todayTasks}</div>
            <p className="text-sm text-zinc-500 mt-2">
              本周还有 {stats.weekTasks} 个任务到期
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-zinc-500">
              本年度项目总价值
            </CardTitle>
            <TrendingUp className="w-4.5 h-4.5 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">
              ¥{(stats.totalValue || 0).toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-2 group relative">
              <p className="text-sm text-zinc-500">
                预期收入 ¥{(stats.expectedValue || 0).toLocaleString()}
              </p>
              <Info className="w-3.5 h-3.5 text-zinc-300 cursor-help" />
              {/* Tooltip */}
              <div className="absolute left-0 top-full mt-2.5 w-80 p-3 bg-zinc-900 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <p className="font-medium mb-1.5">预期收入（Expected Revenue）</p>
                <p className="text-zinc-300">
                  基于项目成功概率的加权预期收入。计算公式：Σ(项目价值 × 成功概率%)
                </p>
                <p className="text-zinc-400 mt-2">
                  例如：¥100万项目 × 50%概率 = ¥50万预期收入
                </p>
                {/* 小三角 */}
                <div className="absolute -top-1.5 left-4 w-2.5 h-2.5 bg-zinc-900 transform rotate-45"></div>
              </div>
            </div>
            {getProgressPercentage(stats.totalValue || 0) && (
              <p className="text-sm text-zinc-400 mt-1">
                达成 {getProgressPercentage(stats.totalValue || 0)}%
              </p>
            )}
            {getProgressPercentage(stats.expectedValue || 0) && (
              <p className="text-sm text-zinc-400 mt-0.5">
                预期达成 {getProgressPercentage(stats.expectedValue || 0)}%
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-zinc-500">
              快速操作
            </CardTitle>
            <Users className="w-4.5 h-4.5 text-zinc-400" />
          </CardHeader>
          <CardContent className="py-3">
            <div className="flex justify-around items-center gap-4">
              <button
                onClick={() => handleQuickAction('createProject')}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="flex items-center justify-center w-14 h-14 bg-zinc-900 rounded-full hover:bg-zinc-700 hover:scale-110 hover:shadow-lg transition-all duration-200">
                  <FolderKanban className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-zinc-600 group-hover:text-zinc-900 font-medium">创建项目</span>
              </button>

              <button
                onClick={() => handleQuickAction('addTask')}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="flex items-center justify-center w-14 h-14 bg-zinc-900 rounded-full hover:bg-zinc-700 hover:scale-110 hover:shadow-lg transition-all duration-200">
                  <CheckSquare className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-zinc-600 group-hover:text-zinc-900 font-medium">添加任务</span>
              </button>

              <button
                onClick={() => handleQuickAction('updateProgress')}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="flex items-center justify-center w-14 h-14 bg-zinc-900 rounded-full hover:bg-zinc-700 hover:scale-110 hover:shadow-lg transition-all duration-200">
                  <FileEdit className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs text-zinc-600 group-hover:text-zinc-900 font-medium">更新进展</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 财务统计卡片 */}
      <div className="grid grid-cols-1 gap-5 mb-8 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-zinc-500">
              本年度已签约项目金额
            </CardTitle>
            <FileCheck className="w-4.5 h-4.5 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">
              ¥{(stats.signedWithStart || 0).toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-2 group relative">
              <p className="text-sm text-zinc-500">
                合同签约 ¥{(stats.signedWithContract || 0).toLocaleString()}
              </p>
              <Info className="w-3.5 h-3.5 text-zinc-300 cursor-help" />
              {/* Tooltip */}
              <div className="absolute left-0 top-full mt-2.5 w-80 p-3 bg-zinc-900 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <p className="font-medium mb-1.5">签约金额说明</p>
                <p className="text-zinc-300 mb-2">
                  <span className="font-semibold">上方金额：</span>包含有开工函或已签署合同的所有项目金额总和
                </p>
                <p className="text-zinc-300">
                  <span className="font-semibold">合同签约金额：</span>仅统计已签署合同的项目金额
                </p>
                {/* 小三角 */}
                <div className="absolute -top-1.5 left-4 w-2.5 h-2.5 bg-zinc-900 transform rotate-45"></div>
              </div>
            </div>
            {getProgressPercentage(stats.signedWithStart || 0) && (
              <p className="text-sm text-zinc-400 mt-1">
                达成 {getProgressPercentage(stats.signedWithStart || 0)}%
              </p>
            )}
            {getProgressPercentage(stats.signedWithContract || 0) && (
              <p className="text-sm text-zinc-400 mt-0.5">
                合同签约达成 {getProgressPercentage(stats.signedWithContract || 0)}%
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-zinc-500">
              本年度已验收项目金额
            </CardTitle>
            <FileText className="w-4.5 h-4.5 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">
              ¥{(stats.acceptedAmount || 0).toLocaleString()}
            </div>
            <p className="text-sm text-zinc-500 mt-2">
              基于结算阶段管理
            </p>
            {getProgressPercentage(stats.acceptedAmount || 0) && (
              <p className="text-sm text-zinc-400 mt-1">
                达成 {getProgressPercentage(stats.acceptedAmount || 0)}%
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-zinc-500">
              本年度已开票项目金额
            </CardTitle>
            <Receipt className="w-4.5 h-4.5 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">
              ¥{(stats.invoicedAmount || 0).toLocaleString()}
            </div>
            <p className="text-sm text-zinc-500 mt-2">
              基于结算阶段管理
            </p>
            {getProgressPercentage(stats.invoicedAmount || 0) && (
              <p className="text-sm text-zinc-400 mt-1">
                达成 {getProgressPercentage(stats.invoicedAmount || 0)}%
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium text-zinc-500">
              本年度已回款项目金额
            </CardTitle>
            <DollarSign className="w-4.5 h-4.5 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">
              ¥{(stats.paidAmount || 0).toLocaleString()}
            </div>
            <p className="text-sm text-zinc-500 mt-2">
              基于结算阶段管理
            </p>
            {getProgressPercentage(stats.paidAmount || 0) && (
              <p className="text-sm text-zinc-400 mt-1">
                达成 {getProgressPercentage(stats.paidAmount || 0)}%
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 已过期和本周即将到期的任务 */}
      <Card className="rounded-2xl shadow-sm border-0 bg-white">
        <CardHeader className="pb-5">
          <CardTitle className="text-lg font-semibold">已过期和本周即将到期的任务</CardTitle>
        </CardHeader>
        <CardContent>
          {overdueTasks.length === 0 && upcomingTasks.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              暂无过期或本周即将到期的任务
            </div>
          ) : (
            <div className="space-y-3">
              {[...overdueTasks, ...upcomingTasks].map((task: any) => {
                const isOverdue = new Date(task.due_date) < new Date()
                return (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
                      isOverdue
                        ? 'bg-red-50 hover:bg-red-100'
                        : 'bg-zinc-50 hover:bg-zinc-100'
                    }`}
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-zinc-900 text-sm">{task.title}</h3>
                      <p className="text-sm text-zinc-500 mt-0.5">
                        {task.projects?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${
                        isOverdue ? 'text-red-600' : 'text-zinc-600'
                      }`}>
                        {new Date(task.due_date).toLocaleDateString('zh-CN')}
                        {isOverdue && <span className="ml-1 text-xs">(已过期)</span>}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {task.priority === 'urgent' && '紧急'}
                        {task.priority === 'high' && '高优先级'}
                        {task.priority === 'medium' && '中优先级'}
                        {task.priority === 'low' && '低优先级'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 添加客户对话框 */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">添加新客户</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCustomer} className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-zinc-700">客户名称 *</Label>
              <Input
                id="name"
                value={customerFormData.name}
                onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                placeholder="例如：张三"
                className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
              />
            </div>
            <div>
              <Label htmlFor="company" className="text-sm font-medium text-zinc-700">公司名称</Label>
              <Input
                id="company"
                value={customerFormData.company}
                onChange={(e) => setCustomerFormData({ ...customerFormData, company: e.target.value })}
                placeholder="例如：某某科技有限公司"
                className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-zinc-700">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerFormData.email}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                  placeholder="example@mail.com"
                  className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-sm font-medium text-zinc-700">电话</Label>
                <Input
                  id="phone"
                  value={customerFormData.phone}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                  placeholder="13800138000"
                  className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes" className="text-sm font-medium text-zinc-700">备注</Label>
              <Textarea
                id="notes"
                value={customerFormData.notes}
                onChange={(e) => setCustomerFormData({ ...customerFormData, notes: e.target.value })}
                placeholder="其他信息..."
                rows={3}
                className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button type="button" variant="outline" onClick={() => setCustomerDialogOpen(false)} className="border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                取消
              </Button>
              <Button type="submit" className="bg-zinc-900 text-white hover:bg-zinc-800">创建</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 创建项目对话框 */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">创建新项目</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-zinc-700">项目名称 *</Label>
              <Input
                id="name"
                value={projectFormData.name}
                onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                placeholder="例如：网站开发项目"
                className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
              />
            </div>
            <div>
              <Label htmlFor="customer_id" className="text-sm font-medium text-zinc-700">客户 *</Label>
              <Select value={projectFormData.customer_id} onValueChange={(value) => setProjectFormData({ ...projectFormData, customer_id: value })}>
                <SelectTrigger className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400">
                  <SelectValue placeholder="选择客户" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description" className="text-sm font-medium text-zinc-700">项目描述</Label>
              <Textarea
                id="description"
                value={projectFormData.description}
                onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                placeholder="项目的详细信息..."
                className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 resize-none"
              />
            </div>

            {/* 项目状态管理 */}
            <div className="border-t border-zinc-200 pt-5 mt-5">
              <h4 className="text-sm font-semibold mb-4 text-zinc-900">项目状态</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2.5">
                  <input
                    type="checkbox"
                    id="has_start_notice"
                    checked={projectFormData.has_start_notice}
                    onChange={(e) => setProjectFormData({ ...projectFormData, has_start_notice: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                  />
                  <Label htmlFor="has_start_notice" className="text-sm text-zinc-700">有开工函</Label>
                </div>
                <div className="flex items-center space-x-2.5">
                  <input
                    type="checkbox"
                    id="contract_signed"
                    checked={projectFormData.contract_signed}
                    onChange={(e) => setProjectFormData({ ...projectFormData, contract_signed: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                  />
                  <Label htmlFor="contract_signed" className="text-sm text-zinc-700">已签署合同</Label>
                </div>
              </div>
              <div className="mt-4">
                <Label htmlFor="settlement_stages" className="text-sm font-medium text-zinc-700">结算段数</Label>
                <Input
                  id="settlement_stages"
                  type="number"
                  min="1"
                  max="10"
                  value={projectFormData.settlement_stages}
                  onChange={(e) => setProjectFormData({ ...projectFormData, settlement_stages: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                  className="mt-2 w-32 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
                <p className="text-xs text-zinc-500 mt-1.5">设置项目分几段结算（最多10段）</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status" className="text-sm font-medium text-zinc-700">状态</Label>
                <Select value={projectFormData.status} onValueChange={(value) => setProjectFormData({ ...projectFormData, status: value })}>
                  <SelectTrigger className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">进行中</SelectItem>
                    <SelectItem value="won">已成交</SelectItem>
                    <SelectItem value="lost">已丢失</SelectItem>
                    <SelectItem value="on_hold">暂停</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="value" className="text-sm font-medium text-zinc-700">项目价值（元）</Label>
                <Input
                  id="value"
                  type="number"
                  value={projectFormData.value}
                  onChange={(e) => setProjectFormData({ ...projectFormData, value: e.target.value })}
                  placeholder="100000"
                  className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="probability" className="text-sm font-medium text-zinc-700">成功概率：{projectFormData.probability}%</Label>
              <Input
                id="probability"
                type="range"
                min="0"
                max="100"
                value={projectFormData.probability}
                onChange={(e) => setProjectFormData({ ...projectFormData, probability: parseInt(e.target.value) })}
                className="mt-2 accent-zinc-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date" className="text-sm font-medium text-zinc-700">开始日期</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={projectFormData.start_date}
                  onChange={(e) => setProjectFormData({ ...projectFormData, start_date: e.target.value })}
                  className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
              <div>
                <Label htmlFor="expected_close_date" className="text-sm font-medium text-zinc-700">预期成交日期</Label>
                <Input
                  id="expected_close_date"
                  type="date"
                  value={projectFormData.expected_close_date}
                  onChange={(e) => setProjectFormData({ ...projectFormData, expected_close_date: e.target.value })}
                  className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button type="button" variant="outline" onClick={() => setProjectDialogOpen(false)} className="border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                取消
              </Button>
              <Button type="submit" className="bg-zinc-900 text-white hover:bg-zinc-800">创建</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
