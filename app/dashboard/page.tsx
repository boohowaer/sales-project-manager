'use client'

import { useState, useEffect } from 'react'
import { getDashboardStats, getUpcomingTasks, getCustomers, createCustomer, createProject } from '@/lib/supabase/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, FolderKanban, CheckSquare, TrendingUp, Info } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button } from '@/components/ui/button'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
      const [statsData, tasksData, customersData] = await Promise.all([
        getDashboardStats(),
        getUpcomingTasks(),
        getCustomers()
      ])
      setStats(statsData)
      setUpcomingTasks(tasksData)
      setCustomers(customersData)
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
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">仪表板</h1>
        <p className="mt-2 text-gray-600">欢迎回来！这是您的项目概览。</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 gap-6 mb-8 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              总项目数
            </CardTitle>
            <FolderKanban className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalProjects}</div>
            <div className="flex items-center gap-1 mt-1 group relative">
              <p className="text-xs text-gray-600">
                其中 {stats.activeProjects} 个活跃项目
              </p>
              <Info className="w-3 h-3 text-gray-400 cursor-help" />
              {/* Tooltip */}
              <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <p className="font-medium mb-1">活跃项目（Active Projects）</p>
                <p className="text-gray-300">
                  状态为"进行中"的项目数量
                </p>
                <p className="text-gray-400 mt-2">
                  项目状态包括：进行中、已成交、已丢失、暂停
                </p>
                {/* 小三角 */}
                <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              今日任务
            </CardTitle>
            <CheckSquare className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.todayTasks}</div>
            <p className="text-xs text-gray-600 mt-1">
              本周还有 {stats.weekTasks} 个任务到期
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              项目总价值
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ¥{(stats.totalValue || 0).toLocaleString()}
            </div>
            <div className="flex items-center gap-1 mt-1 group relative">
              <p className="text-xs text-gray-600">
                预期收入 ¥{(stats.expectedValue || 0).toLocaleString()}
              </p>
              <Info className="w-3 h-3 text-gray-400 cursor-help" />
              {/* Tooltip */}
              <div className="absolute left-0 top-full mt-2 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <p className="font-medium mb-1">预期收入（Expected Revenue）</p>
                <p className="text-gray-300">
                  基于项目成功概率的加权预期收入。计算公式：Σ(项目价值 × 成功概率%)
                </p>
                <p className="text-gray-400 mt-2">
                  例如：¥100万项目 × 50%概率 = ¥50万预期收入
                </p>
                {/* 小三角 */}
                <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              快速操作
            </CardTitle>
            <Users className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              onClick={() => setCustomerDialogOpen(true)}
            >
              添加客户
            </Button>
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              onClick={() => setProjectDialogOpen(true)}
            >
              创建项目
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 即将到期的任务 */}
      <Card>
        <CardHeader>
          <CardTitle>即将到期的任务</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无即将到期的任务
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingTasks.map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{task.title}</h3>
                    <p className="text-sm text-gray-600">
                      {task.projects?.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {new Date(task.due_date).toLocaleDateString('zh-CN')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {task.priority === 'urgent' && '紧急'}
                      {task.priority === 'high' && '高优先级'}
                      {task.priority === 'medium' && '中优先级'}
                      {task.priority === 'low' && '低优先级'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 添加客户对话框 */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加新客户</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCustomer} className="space-y-4">
            <div>
              <Label htmlFor="name">客户名称 *</Label>
              <Input
                id="name"
                value={customerFormData.name}
                onChange={(e) => setCustomerFormData({ ...customerFormData, name: e.target.value })}
                placeholder="例如：张三"
              />
            </div>
            <div>
              <Label htmlFor="company">公司名称</Label>
              <Input
                id="company"
                value={customerFormData.company}
                onChange={(e) => setCustomerFormData({ ...customerFormData, company: e.target.value })}
                placeholder="例如：某某科技有限公司"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerFormData.email}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                  placeholder="example@mail.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">电话</Label>
                <Input
                  id="phone"
                  value={customerFormData.phone}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, phone: e.target.value })}
                  placeholder="13800138000"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">备注</Label>
              <Textarea
                id="notes"
                value={customerFormData.notes}
                onChange={(e) => setCustomerFormData({ ...customerFormData, notes: e.target.value })}
                placeholder="其他信息..."
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setCustomerDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">创建</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 创建项目对话框 */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>创建新项目</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <Label htmlFor="name">项目名称 *</Label>
              <Input
                id="name"
                value={projectFormData.name}
                onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                placeholder="例如：网站开发项目"
              />
            </div>
            <div>
              <Label htmlFor="customer_id">客户 *</Label>
              <Select value={projectFormData.customer_id} onValueChange={(value) => setProjectFormData({ ...projectFormData, customer_id: value })}>
                <SelectTrigger>
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
              <Label htmlFor="description">项目描述</Label>
              <Textarea
                id="description"
                value={projectFormData.description}
                onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                placeholder="项目的详细信息..."
              />
            </div>

            {/* 项目状态管理 */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-4">项目状态</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="has_start_notice"
                    checked={projectFormData.has_start_notice}
                    onChange={(e) => setProjectFormData({ ...projectFormData, has_start_notice: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <Label htmlFor="has_start_notice" className="text-sm">有开工函</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="contract_signed"
                    checked={projectFormData.contract_signed}
                    onChange={(e) => setProjectFormData({ ...projectFormData, contract_signed: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <Label htmlFor="contract_signed" className="text-sm">已签署合同</Label>
                </div>
              </div>
              <div className="mt-4">
                <Label htmlFor="settlement_stages">结算段数</Label>
                <Input
                  id="settlement_stages"
                  type="number"
                  min="1"
                  max="10"
                  value={projectFormData.settlement_stages}
                  onChange={(e) => setProjectFormData({ ...projectFormData, settlement_stages: parseInt(e.target.value) || 1 })}
                  placeholder="1"
                  className="w-32"
                />
                <p className="text-xs text-gray-600 mt-1">设置项目分几段结算（最多10段）</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">状态</Label>
                <Select value={projectFormData.status} onValueChange={(value) => setProjectFormData({ ...projectFormData, status: value })}>
                  <SelectTrigger>
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
                <Label htmlFor="value">项目价值（元）</Label>
                <Input
                  id="value"
                  type="number"
                  value={projectFormData.value}
                  onChange={(e) => setProjectFormData({ ...projectFormData, value: e.target.value })}
                  placeholder="100000"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="probability">成功概率：{projectFormData.probability}%</Label>
              <Input
                id="probability"
                type="range"
                min="0"
                max="100"
                value={projectFormData.probability}
                onChange={(e) => setProjectFormData({ ...projectFormData, probability: parseInt(e.target.value) })}
                className="mt-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">开始日期</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={projectFormData.start_date}
                  onChange={(e) => setProjectFormData({ ...projectFormData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="expected_close_date">预期成交日期</Label>
                <Input
                  id="expected_close_date"
                  type="date"
                  value={projectFormData.expected_close_date}
                  onChange={(e) => setProjectFormData({ ...projectFormData, expected_close_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setProjectDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">创建</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
