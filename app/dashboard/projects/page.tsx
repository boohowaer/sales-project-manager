'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getProjects, getCustomers, createProject, updateProject, deleteProject, getSettlementStages } from '@/lib/supabase/queries'
import { SettlementStagesManager } from '@/components/projects/SettlementStagesManager'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Coins, Search } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import type { Project, Customer } from '@/types'

// 辅助函数：获取验收/开票/回款状态Badge
const getStatusBadge = (type: 'accepted' | 'invoiced' | 'paid', count: number, total: number) => {
  const labels: Record<string, string> = {
    accepted: '验收',
    invoiced: '开票',
    paid: '回款'
  }

  if (total === 0) return <Badge variant="secondary" className="text-xs">{labels[type]}: 未</Badge>
  if (count === 0) return <Badge variant="secondary" className="text-xs">{labels[type]}: 未</Badge>
  if (count === total) return <Badge variant="default" className="text-xs">{labels[type]}: 完成</Badge>
  return <Badge variant="secondary" className="text-xs">{labels[type]}: {count}/{total}</Badge>
}

export default function ProjectsPage() {
  // 辅助函数：生成验收/开票/回款状态文本
  const getStatusText = (type: 'accepted' | 'invoiced' | 'paid', count: number, total: number) => {
    if (total === 0) return `未${type === 'accepted' ? '验收' : type === 'invoiced' ? '开票' : '回款'}`
    if (count === 0) return `未${type === 'accepted' ? '验收' : type === 'invoiced' ? '开票' : '回款'}`
    if (count === total) return `已完整${type === 'accepted' ? '验收' : type === 'invoiced' ? '开票' : '回款'}`
    return `已${type === 'accepted' ? '验收' : type === 'invoiced' ? '开票' : '回款'}${count}段`
  }

  // 获取状态标签的颜色
  const getStatusColor = (type: 'accepted' | 'invoiced' | 'paid', count: number, total: number) => {
    if (count === 0) return 'bg-zinc-100 text-zinc-700'
    if (count === total) return 'bg-emerald-100 text-emerald-700'
    return 'bg-amber-100 text-amber-700'
  }

  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedProjectStages, setSelectedProjectStages] = useState<number>(1)
  const [selectedProjectSettlements, setSelectedProjectSettlements] = useState<any[]>([])
  const [formData, setFormData] = useState({
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

    // 检查是否需要自动打开项目创建对话框
    const shouldOpenDialog = sessionStorage.getItem('openProjectDialog')
    if (shouldOpenDialog === 'true') {
      setDialogOpen(true)
      sessionStorage.removeItem('openProjectDialog')
    }
  }, [])

  const loadData = async () => {
    try {
      const [projectsData, customersData] = await Promise.all([
        getProjects(),
        getCustomers()
      ])
      setProjects(projectsData)
      setCustomers(customersData)
    } catch (error: any) {
      console.error('加载数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.customer_id) {
      toast.error('请填写项目名称和选择客户')
      return
    }

    try {
      // 确保settlement_stages是数字
      const settlementStagesNumber = typeof formData.settlement_stages === 'number'
        ? formData.settlement_stages
        : parseInt(formData.settlement_stages as any) || 1

      console.log('准备保存项目数据:', {
        ...formData,
        settlement_stages: settlementStagesNumber
      })

      if (editingId) {
        const updateData = {
          name: formData.name,
          description: formData.description || null,
          customer_id: formData.customer_id,
          status: formData.status as any,
          value: formData.value ? parseFloat(formData.value) : null,
          probability: formData.probability,
          start_date: formData.start_date || null,
          expected_close_date: formData.expected_close_date || null,
          has_start_notice: formData.has_start_notice,
          contract_signed: formData.contract_signed,
          settlement_stages: settlementStagesNumber
        }

        console.log('更新项目 - ID:', editingId)
        console.log('更新项目 - 数据:', updateData)

        try {
          const updatedProject = await updateProject(editingId, updateData)
          console.log('更新成功 - 返回数据:', updatedProject)
          toast.success('项目更新成功')

          // 立即更新本地状态，不需要重新加载
          setProjects(prevProjects =>
            prevProjects.map(p =>
              p.id === editingId ? { ...p, ...updatedProject } : p
            )
          )
        } catch (updateError: any) {
          console.error('更新项目失败，详细错误:', updateError)
          throw updateError
        }
      } else {
        const createData = {
          name: formData.name,
          description: formData.description || null,
          customer_id: formData.customer_id,
          status: formData.status as any,
          value: formData.value ? parseFloat(formData.value) : null,
          probability: formData.probability,
          start_date: formData.start_date || null,
          expected_close_date: formData.expected_close_date || null,
          actual_close_date: null,
          has_start_notice: formData.has_start_notice,
          contract_signed: formData.contract_signed,
          settlement_stages: settlementStagesNumber
        }

        console.log('创建项目:', createData)
        const newProject = await createProject(createData)
        toast.success('项目创建成功')

        // 添加到本地列表
        setProjects(prevProjects => [newProject, ...prevProjects])
      }

      setDialogOpen(false)
      setFormData({
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
      setEditingId(null)

      // 延迟重新加载，确保数据库操作完成
      setTimeout(() => {
        loadData()
      }, 200)
    } catch (error: any) {
      console.error('保存项目失败:', error)
      toast.error(error.message || '操作失败')
    }
  }

  const handleEdit = (project: any) => {
    setFormData({
      name: project.name,
      description: project.description || '',
      customer_id: project.customer_id,
      status: project.status,
      value: project.value ? project.value.toString() : '',
      probability: project.probability,
      start_date: project.start_date || '',
      expected_close_date: project.expected_close_date || '',
      has_start_notice: project.has_start_notice || false,
      contract_signed: project.contract_signed || false,
      settlement_stages: project.settlement_stages || 1
    })
    setEditingId(project.id)
    setDialogOpen(true)
  }

  const handleManageSettlements = async (project: any) => {
    setSelectedProjectId(project.id)
    setSelectedProjectStages(project.settlement_stages || 1)

    // 从数据库获取结算段数据
    try {
      const settlements = await getSettlementStages(project.id)
      setSelectedProjectSettlements(settlements)
    } catch (error) {
      console.error('获取结算段数据失败:', error)
      setSelectedProjectSettlements([])
    }

    setSettlementDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
  }

  // 当对话框关闭时重置表单
  useEffect(() => {
    if (!dialogOpen) {
      setTimeout(() => {
        setFormData({
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
        setEditingId(null)
      }, 100)
    }
  }, [dialogOpen])

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个项目吗？相关的任务也会被删除。')) {
      return
    }

    try {
      await deleteProject(id)
      toast.success('项目删除成功')
      loadData()
    } catch (error: any) {
      toast.error(error.message || '删除项目失败')
    }
  }

  const getStatusColor2 = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'won': return 'success'
      case 'lost': return 'destructive'
      case 'on_hold': return 'secondary'
      default: return 'default'
    }
  }

  const getStatusText2 = (status: string) => {
    switch (status) {
      case 'active': return '进行中'
      case 'won': return '已成交'
      case 'lost': return '已丢失'
      case 'on_hold': return '暂停'
      default: return status
    }
  }

  const filteredProjects = projects.filter(project => {
    if (!searchKeyword.trim()) return true

    const keyword = searchKeyword.toLowerCase()
    const projectName = project.name?.toLowerCase() || ''
    const customerName = project.customers?.name?.toLowerCase() || ''

    return projectName.includes(keyword) || customerName.includes(keyword)
  })

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="text-zinc-400">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900">项目管理</h1>
          <p className="mt-2 text-zinc-500">管理您的所有销售项目</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-zinc-400" />
            <Input
              placeholder="搜索项目或客户..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-48 h-9 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={customers.length === 0} className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full">
                <Plus className="w-4 h-4 mr-2" />
                添加项目
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl border-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">{editingId ? "编辑项目" : "添加新项目"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-zinc-700">项目名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：网站开发项目"
                    className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
              <div>
                <Label htmlFor="customer_id" className="text-sm font-medium text-zinc-700">客户 *</Label>
                <Select value={formData.customer_id} onValueChange={(value) => setFormData({ ...formData, customer_id: value })}>
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
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="项目的详细信息..."
                      className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>

              {/* 项目状态管理 */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold mb-4">项目状态</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="has_start_notice"
                      checked={formData.has_start_notice}
                      onChange={(e) => setFormData({ ...formData, has_start_notice: e.target.checked })}
                      className="w-4 h-4 rounded border-zinc-300"
                    />
                    <Label htmlFor="has_start_notice" className="text-sm">有开工函</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="contract_signed"
                      checked={formData.contract_signed}
                      onChange={(e) => setFormData({ ...formData, contract_signed: e.target.checked })}
                      className="w-4 h-4 rounded border-zinc-300"
                    />
                    <Label htmlFor="contract_signed" className="text-sm">已签署合同</Label>
                  </div>
                </div>
                <div className="mt-4">
                  <Label htmlFor="settlement_stages" className="text-sm font-medium text-zinc-700">结算段数</Label>
                  <Input
                    id="settlement_stages"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.settlement_stages}
                    onChange={(e) => setFormData({ ...formData, settlement_stages: parseInt(e.target.value) || 1 })}
                    placeholder="1"
                    className="mt-2 w-32 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                  <p className="text-xs text-zinc-500 mt-1">设置项目分几段结算（最多10段）</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status" className="text-sm font-medium text-zinc-700">状态</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
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
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="100000"
                      className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="probability" className="text-sm font-medium text-zinc-700">成功概率：{formData.probability}%</Label>
                <Input
                  id="probability"
                  type="range"
                  min="0"
                  max="100"
                  value={formData.probability}
                  onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) })}
                  className="mt-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date" className="text-sm font-medium text-zinc-700">开始日期</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <Label htmlFor="expected_close_date" className="text-sm font-medium text-zinc-700">预期成交日期</Label>
                  <Input
                    id="expected_close_date"
                    type="date"
                    value={formData.expected_close_date}
                    onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                    className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" onClick={() => setDialogOpen(false)} className="rounded-full border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                  取消
                </Button>
                <Button type="submit">{editingId ? '保存' : '创建'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* 项目列表 */}
      {projects.length === 0 ? (
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="text-center py-12">
            <p className="text-zinc-400 mb-4">
              {customers.length === 0 ? '请先添加客户' : '还没有项目'}
            </p>
            {customers.length > 0 && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                创建第一个项目
              </Button>
            )}
          </CardContent>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="text-center py-12">
            <p className="text-zinc-400">没有找到匹配的项目</p>
            <Button onClick={() => setSearchKeyword('')} variant="outline" className="mt-4">
              清除搜索
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0 bg-white">
              <CardHeader className="pb-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-0">
                      <span className="text-sm text-zinc-400">{project.customers?.name}</span>
                      <h3 className="font-semibold text-lg">{project.name}</h3>
                      <Badge variant={getStatusColor2(project.status) as any}>
                        {getStatusText2(project.status)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(project)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleManageSettlements(project)}
                    >
                      <Coins className="w-4 h-4 text-amber-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(project.id)}
                    >
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2 mb-4 -mt-2">
                  {project.has_start_notice && (
                    <span className="px-2 py-1 bg-sky-100 text-sky-700 text-xs rounded-full">✓ 有开工函</span>
                  )}
                  {project.contract_signed && (
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">✓ 已签合同</span>
                  )}
                  {/* 显示结算段信息 */}
                  <span className="px-2 py-1 bg-zinc-100 text-zinc-700 text-xs rounded-full">
                    {project.settlement_stages}段结算
                  </span>
                  {/* 验收、开票、回款状态 */}
                  {getStatusBadge('accepted', project.settlement_summary?.accepted || 0, project.settlement_summary?.total || 0)}
                  {getStatusBadge('invoiced', project.settlement_summary?.invoiced || 0, project.settlement_summary?.total || 0)}
                  {getStatusBadge('paid', project.settlement_summary?.paid || 0, project.settlement_summary?.total || 0)}
                </div>
                {project.description && (
                  <p className="text-sm text-zinc-500 mb-4">{project.description}</p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {project.value && (
                    <div>
                      <p className="text-zinc-500">项目价值</p>
                      <p className="font-semibold">¥{project.value.toLocaleString()}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-zinc-500">成功概率</p>
                    <p className="font-semibold">{project.probability}%</p>
                  </div>
                  {project.start_date && (
                    <div>
                      <p className="text-zinc-500">开始日期</p>
                      <p className="font-semibold">
                        {new Date(project.start_date).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  )}
                  {project.expected_close_date && (
                    <div>
                      <p className="text-zinc-500">预期成交</p>
                      <p className="font-semibold">
                        {new Date(project.expected_close_date).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 结算段管理对话框 */}
      <Dialog open={settlementDialogOpen} onOpenChange={(open) => {
        setSettlementDialogOpen(open)
        if (!open) {
          setSelectedProjectId(null)
          setSelectedProjectStages(1)
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">结算阶段管理</DialogTitle>
          </DialogHeader>
          {selectedProjectId && (
            <SettlementStagesManager
              projectId={selectedProjectId}
              stages={selectedProjectStages}
              existingStages={selectedProjectSettlements}
              onStagesChange={async () => {
                // 重新加载结算段数据
                if (selectedProjectId) {
                  try {
                    const settlements = await getSettlementStages(selectedProjectId)
                    setSelectedProjectSettlements(settlements)
                    // 同时更新项目列表中的该项目数据
                    setProjects(prevProjects =>
                      prevProjects.map(p =>
                        p.id === selectedProjectId
                          ? { ...p, settlement_stages: settlements.length || 1 }
                          : p
                      )
                    )
                  } catch (error) {
                    console.error('重新加载结算段数据失败:', error)
                  }
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
