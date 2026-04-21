'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getProjects, getCustomers, createProject, updateProject, deleteProject, getSettlementStages, createTask, getSettlementStagesBatch } from '@/lib/supabase/queries'
import { SettlementStagesManager } from '@/components/projects/SettlementStagesManager'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Pencil, Trash2, Coins, Search, Filter, X, CheckSquare, RotateCcw, Upload, UserPlus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import type { Project, Customer } from '@/types'
import { ImportDialog } from '@/components/import/ImportDialog'
import { useTeamView } from '@/hooks/useTeamView'
import { AssignDialog } from '@/components/admin/AssignDialog'

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
  const { viewMode, toggle } = useTeamView()
  const [isManager, setIsManager] = useState(false)
  const [isSalesRep, setIsSalesRep] = useState(false)
  const [dataScope, setDataScope] = useState<'own' | 'team'>('own')
  const [assignTarget, setAssignTarget] = useState<string | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedProjectStages, setSelectedProjectStages] = useState<number>(1)
  const [selectedProjectValue, setSelectedProjectValue] = useState<number | null>(null)
  const [selectedProjectSettlements, setSelectedProjectSettlements] = useState<any[]>([])

  // 筛选状态 - 从localStorage恢复（默认包含已归档状态，确保已归档项目可见）
  const [filterProjectStatus, setFilterProjectStatus] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('projects-filterProjectStatus')
      // 如果没有保存的筛选条件，默认不筛选任何状态（显示所有状态，包括已归档）
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [filterContractStatus, setFilterContractStatus] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('projects-filterContractStatus')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [filterAcceptedStatus, setFilterAcceptedStatus] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('projects-filterAcceptedStatus')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [filterInvoicedStatus, setFilterInvoicedStatus] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('projects-filterInvoicedStatus')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [filterPaidStatus, setFilterPaidStatus] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('projects-filterPaidStatus')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [filterBelongYear, setFilterBelongYear] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('projects-filterBelongYear')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [filterMilestone, setFilterMilestone] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('projects-filterMilestone')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [settlementsMap, setSettlementsMap] = useState<Map<string, any[]>>(new Map())

  // 保存筛选器状态到localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('projects-filterProjectStatus', JSON.stringify(filterProjectStatus))
      localStorage.setItem('projects-filterContractStatus', JSON.stringify(filterContractStatus))
      localStorage.setItem('projects-filterAcceptedStatus', JSON.stringify(filterAcceptedStatus))
      localStorage.setItem('projects-filterInvoicedStatus', JSON.stringify(filterInvoicedStatus))
      localStorage.setItem('projects-filterPaidStatus', JSON.stringify(filterPaidStatus))
      localStorage.setItem('projects-filterBelongYear', JSON.stringify(filterBelongYear))
      localStorage.setItem('projects-filterMilestone', JSON.stringify(filterMilestone))
    }
  }, [filterProjectStatus, filterContractStatus, filterAcceptedStatus, filterInvoicedStatus, filterPaidStatus, filterBelongYear, filterMilestone])

  // 任务对话框状态
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    priority: 'medium',
    due_date: '',
    status: 'pending'
  })

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    customer_id: '',
    status: 'active',
    value: '',
    probability: 50,
    start_date: '',
    expected_close_date: '',
    signed_at: '',
    has_start_notice: false,
    contract_signed: false,
    settlement_stages: 1,
    belong_year: ''
  })

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      setIsManager(d.role === 'super_admin' || d.role === 'sales_manager')
      setIsSalesRep(d.role === 'sales_rep')
      setDataScope(d.dataScope ?? 'own')
    })
  }, [])

  useEffect(() => {
    loadData()

    // 检查是否需要自动打开项目创建对话框
    const shouldOpenDialog = sessionStorage.getItem('openProjectDialog')
    if (shouldOpenDialog === 'true') {
      setDialogOpen(true)
      sessionStorage.removeItem('openProjectDialog')
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [viewMode])

  const loadData = async () => {
    try {
      const [projectsData, customersData] = await Promise.all([
        getProjects({ teamView: viewMode === 'team' }),
        getCustomers()
      ])
      setProjects(projectsData)
      setCustomers(customersData)

      const projectIds = projectsData.map((p: any) => p.id)
      const map = await getSettlementStagesBatch(projectIds)
      setSettlementsMap(map)
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
          signed_at: formData.signed_at || null,
          settlement_stages: settlementStagesNumber,
          belong_year: formData.belong_year ? parseInt(formData.belong_year) : null
        }

        const KEY_FIELDS = ['value', 'status', 'expected_close_date']
        const hasKeyField = KEY_FIELDS.some(f => f in updateData)

        if (isSalesRep && hasKeyField) {
          await fetch('/api/approvals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'update_project', targetId: editingId, payload: updateData }),
          })
          toast('修改已提交审批，原数据继续生效')
        } else {
          try {
            const updatedProject = await updateProject(editingId, updateData)
            toast.success('项目更新成功')
            setProjects(prevProjects =>
              prevProjects.map(p =>
                p.id === editingId ? { ...p, ...updatedProject } : p
              )
            )
          } catch (updateError: any) {
            console.error('更新项目失败，详细错误:', updateError)
            throw updateError
          }
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
          signed_at: formData.signed_at || null,
          settlement_stages: settlementStagesNumber,
          belong_year: formData.belong_year ? parseInt(formData.belong_year) : null
        }

        if (isSalesRep) {
          await fetch('/api/approvals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'create_project', payload: createData }),
          })
          toast('已提交审批，等待经理审核')
        } else {
          const newProject = await createProject(createData)
          toast.success('项目创建成功')
          setProjects(prevProjects => [newProject, ...prevProjects])
        }
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
        signed_at: '',
        has_start_notice: false,
        contract_signed: false,
        settlement_stages: 1,
        belong_year: ''
      })
      setEditingId(null)

      // 不需要重新加载，已经在前面更新了本地状态
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
      signed_at: project.signed_at || '',
      has_start_notice: project.has_start_notice || false,
      contract_signed: project.contract_signed || false,
      settlement_stages: 1,
      belong_year: project.belong_year ? project.belong_year.toString() : ''
    })
    setEditingId(project.id)
    setDialogOpen(true)
  }

  const handleManageSettlements = async (project: any) => {
    setSelectedProjectId(project.id)
    setSelectedProjectStages(project.settlement_stages || 1)
    setSelectedProjectValue(project.value || null)

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
          settlement_stages: 1,
          belong_year: ''
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
      // 直接更新本地状态，避免页面跳转
      setProjects(prevProjects => prevProjects.filter(p => p.id !== id))
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
      case 'archived': return 'outline'
      default: return 'default'
    }
  }

  const getStatusText2 = (status: string) => {
    switch (status) {
      case 'active': return '跟进中'
      case 'won': return '已成交'
      case 'lost': return '已丢失'
      case 'on_hold': return '暂停'
      case 'archived': return '已归档'
      default: return status
    }
  }

  // 辅助函数：根据验收/开票/回款状态获取标签颜色
  const getSettlementTagColor = (count: number, total: number) => {
    if (total === 0) return 'bg-amber-100 text-amber-700' // 无结算段
    if (count === total) return 'bg-emerald-100 text-emerald-700' // 已完成
    return 'bg-amber-100 text-amber-700' // 未完成或部分完成
  }

  const filteredProjects = projects.filter(project => {
    // 搜索关键词筛选
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase()
      const projectName = project.name?.toLowerCase() || ''
      const customerName = project.customers?.name?.toLowerCase() || ''

      if (!projectName.includes(keyword) && !customerName.includes(keyword)) {
        return false
      }
    }

    // 项目状态筛选
    if (filterProjectStatus.length > 0) {
      if (!filterProjectStatus.includes(project.status)) {
        return false
      }
    }

    // 签约状态筛选
    if (filterContractStatus.length > 0) {
      const hasStartNotice = project.has_start_notice
      const hasContract = project.contract_signed

      const matches = filterContractStatus.some(status => {
        if (status === '未签约') return !hasStartNotice && !hasContract
        if (status === '开工函') return hasStartNotice
        if (status === '合同签约') return hasContract
        return false
      })

      if (!matches) return false
    }

    // 验收状态筛选
    if (filterAcceptedStatus.length > 0) {
      const acceptedCount = project.settlement_summary?.accepted || 0
      const totalCount = project.settlement_stages || 1

      const matches = filterAcceptedStatus.some(status => {
        if (status === '已验收') return acceptedCount === totalCount && totalCount > 0
        if (status === '未验收') return acceptedCount === 0
        if (status === '部分验收') return acceptedCount > 0 && acceptedCount < totalCount
        return false
      })

      if (!matches) return false
    }

    // 开票状态筛选
    if (filterInvoicedStatus.length > 0) {
      const invoicedCount = project.settlement_summary?.invoiced || 0
      const totalCount = project.settlement_stages || 1

      const matches = filterInvoicedStatus.some(status => {
        if (status === '已开票') return invoicedCount === totalCount && totalCount > 0
        if (status === '未开票') return invoicedCount === 0
        if (status === '部分开票') return invoicedCount > 0 && invoicedCount < totalCount
        return false
      })

      if (!matches) return false
    }

    // 回款状态筛选
    if (filterPaidStatus.length > 0) {
      const paidCount = project.settlement_summary?.paid || 0
      const totalCount = project.settlement_stages || 1

      const matches = filterPaidStatus.some(status => {
        if (status === '已回款') return paidCount === totalCount && totalCount > 0
        if (status === '未回款') return paidCount === 0
        if (status === '部分回款') return paidCount > 0 && paidCount < totalCount
        return false
      })

      if (!matches) return false
    }

    // 归属年份筛选
    if (filterBelongYear.length > 0) {
      const projectYear = project.belong_year ? String(project.belong_year) : null
      if (!projectYear || !filterBelongYear.includes(projectYear)) {
        return false
      }
    }

    // 关注节点筛选（未来30天 + 已逾期）
    if (filterMilestone.length > 0) {
      const today = new Date(new Date().toDateString())
      const future30 = new Date(today)
      future30.setDate(future30.getDate() + 30)
      future30.setHours(23, 59, 59)
      const stages = settlementsMap.get(project.id) || []

      const matches = filterMilestone.some(type => {
        if (type === '计划签约') {
          if (!project.expected_close_date || project.contract_signed || project.has_start_notice) return false
          const d = new Date(project.expected_close_date)
          return d <= future30
        }
        if (type === '计划验收') {
          return stages.some((s: any) => {
            if (s.accepted || !s.planned_accepted_date) return false
            return new Date(s.planned_accepted_date) <= future30
          })
        }
        if (type === '计划开票') {
          return stages.some((s: any) => {
            if (s.invoiced || !s.planned_invoiced_date) return false
            return new Date(s.planned_invoiced_date) <= future30
          })
        }
        if (type === '计划回款') {
          return stages.some((s: any) => {
            if (s.paid || !s.planned_paid_date) return false
            return new Date(s.planned_paid_date) <= future30
          })
        }
        return false
      })

      if (!matches) return false
    }

    return true
  })

  const handleOpenCreateTask = (projectId: string) => {
    setTaskFormData({
      title: '',
      description: '',
      project_id: projectId,
      priority: 'medium',
      due_date: '',
      status: 'pending'
    })
    setTaskDialogOpen(true)
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!taskFormData.title) {
      toast.error('请填写任务标题')
      return
    }

    if (!taskFormData.project_id) {
      toast.error('请选择项目')
      return
    }

    try {
      await createTask({
        title: taskFormData.title,
        description: taskFormData.description || null,
        project_id: taskFormData.project_id,
        priority: taskFormData.priority as any,
        due_date: taskFormData.due_date ? new Date(taskFormData.due_date).toISOString() : null,
        status: taskFormData.status as any
      })
      toast.success('任务创建成功')
      setTaskDialogOpen(false)
      setTaskFormData({
        title: '',
        description: '',
        project_id: '',
        priority: 'medium',
        due_date: '',
        status: 'pending'
      })
    } catch (error: any) {
      console.error('创建任务失败:', error)
      toast.error(error.message || '创建任务失败')
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-20">
          <div className="text-zinc-400 text-sm">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">项目管理</h1>
          <p className="mt-2 text-zinc-500 text-sm">管理您的所有销售项目</p>
        </div>
        <div className="flex gap-2 items-center">
          {dataScope === 'team' && (
            <button
              onClick={toggle}
              className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors px-3 py-1.5 rounded-full border border-zinc-200 hover:border-zinc-400"
            >
              {viewMode === 'mine' ? '查看全团队' : '只看我的'}
            </button>
          )}
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-zinc-400" />
            <Input
              placeholder="搜索项目或客户..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-48 h-8 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 text-sm"
            />
          </div>

          <Button
            onClick={() => setFilterDialogOpen(true)}
            variant="outline"
            className="rounded-full border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            size="sm"
          >
            <Filter className="w-4 h-4 mr-2" />
            筛选
            {(filterProjectStatus.length > 0 || filterContractStatus.length > 0 || filterAcceptedStatus.length > 0 ||
              filterInvoicedStatus.length > 0 || filterPaidStatus.length > 0 || filterBelongYear.length > 0 || filterMilestone.length > 0) && (
              <Badge variant="secondary" className="ml-2 bg-zinc-900 text-white">
                {filterProjectStatus.length + filterContractStatus.length + filterAcceptedStatus.length + filterInvoicedStatus.length + filterPaidStatus.length + filterBelongYear.length + filterMilestone.length}
              </Badge>
            )}
          </Button>

          <Button
            onClick={() => setImportDialogOpen(true)}
            className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full shadow-sm"
          >
            <Upload className="w-4 h-4 mr-2" />
            批量导入
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={customers.length === 0} className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                添加项目
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* 筛选器对话框 */}
      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent className="max-w-4xl rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <div className="flex items-center justify-between px-2">
              <DialogTitle className="text-lg font-semibold">筛选条件</DialogTitle>
              <Button
                onClick={() => {
                  setFilterProjectStatus([])
                  setFilterContractStatus([])
                  setFilterAcceptedStatus([])
                  setFilterInvoicedStatus([])
                  setFilterPaidStatus([])
                  setFilterBelongYear([])
                  setFilterMilestone([])
                }}
                variant="ghost"
                size="sm"
                className="text-zinc-500 hover:text-zinc-700"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                清空筛选
              </Button>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-7 gap-4 px-2">
            {/* 项目状态 */}
            <div>
              <Label className="text-xs font-medium text-zinc-700 mb-2 block">项目状态</Label>
              <div className="space-y-1.5">
                {[
                  { value: 'active', label: '跟进中' },
                  { value: 'won', label: '已成交' },
                  { value: 'lost', label: '已丢失' },
                  { value: 'on_hold', label: '暂停' },
                  { value: 'archived', label: '已归档' }
                ].map(status => (
                  <label key={status.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterProjectStatus.includes(status.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilterProjectStatus([...filterProjectStatus, status.value])
                        } else {
                          setFilterProjectStatus(filterProjectStatus.filter(s => s !== status.value))
                        }
                      }}
                      className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                    />
                    <span className="text-zinc-700">{status.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 签约状态 */}
            <div>
              <Label className="text-xs font-medium text-zinc-700 mb-2 block">签约状态</Label>
              <div className="space-y-1.5">
                {['未签约', '开工函', '合同签约'].map(status => (
                  <label key={status} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterContractStatus.includes(status)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilterContractStatus([...filterContractStatus, status])
                        } else {
                          setFilterContractStatus(filterContractStatus.filter(s => s !== status))
                        }
                      }}
                      className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                    />
                    <span className="text-zinc-700">{status}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 验收状态 */}
            <div>
              <Label className="text-xs font-medium text-zinc-700 mb-2 block">验收状态</Label>
              <div className="space-y-1.5">
                {['已验收', '未验收', '部分验收'].map(status => (
                  <label key={status} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterAcceptedStatus.includes(status)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilterAcceptedStatus([...filterAcceptedStatus, status])
                        } else {
                          setFilterAcceptedStatus(filterAcceptedStatus.filter(s => s !== status))
                        }
                      }}
                      className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                    />
                    <span className="text-zinc-700">{status}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 开票状态 */}
            <div>
              <Label className="text-xs font-medium text-zinc-700 mb-2 block">开票状态</Label>
              <div className="space-y-1.5">
                {['已开票', '未开票', '部分开票'].map(status => (
                  <label key={status} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterInvoicedStatus.includes(status)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilterInvoicedStatus([...filterInvoicedStatus, status])
                        } else {
                          setFilterInvoicedStatus(filterInvoicedStatus.filter(s => s !== status))
                        }
                      }}
                      className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                    />
                    <span className="text-zinc-700">{status}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 回款状态 */}
            <div>
              <Label className="text-xs font-medium text-zinc-700 mb-2 block">回款状态</Label>
              <div className="space-y-1.5">
                {['已回款', '未回款', '部分回款'].map(status => (
                  <label key={status} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterPaidStatus.includes(status)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilterPaidStatus([...filterPaidStatus, status])
                        } else {
                          setFilterPaidStatus(filterPaidStatus.filter(s => s !== status))
                        }
                      }}
                      className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                    />
                    <span className="text-zinc-700">{status}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 归属年份 */}
            <div>
              <Label className="text-xs font-medium text-zinc-700 mb-2 block">归属年份</Label>
              <div className="space-y-1.5">
                {/* 从现有项目中收集所有可能的归属年份 */}
                {Array.from(new Set(projects.map(p => p.belong_year).filter(Boolean)))
                  .sort((a, b) => (b as number) - (a as number))
                  .map(year => (
                    <label key={year} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filterBelongYear.includes(String(year))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilterBelongYear([...filterBelongYear, String(year)])
                          } else {
                            setFilterBelongYear(filterBelongYear.filter(y => y !== String(year)))
                          }
                        }}
                        className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                      />
                      <span className="text-zinc-700">{year}年</span>
                    </label>
                  ))}
                {projects.filter(p => p.belong_year).length === 0 && (
                  <span className="text-xs text-zinc-400">暂无年份数据</span>
                )}
              </div>
            </div>

            {/* 关注节点 */}
            <div>
              <Label className="text-xs font-medium text-zinc-700 mb-2 block">关注节点</Label>
              <div className="space-y-1.5">
                {['计划签约', '计划验收', '计划开票', '计划回款'].map(type => (
                  <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterMilestone.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilterMilestone([...filterMilestone, type])
                        } else {
                          setFilterMilestone(filterMilestone.filter(s => s !== type))
                        }
                      }}
                      className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
                    />
                    <span className="text-zinc-700">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-4 pr-2">
            <Button
              onClick={() => setFilterDialogOpen(false)}
              className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full px-8"
            >
              确定
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 项目创建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button style={{ display: 'none' }} />
        </DialogTrigger>
        <DialogContent className="max-w-3xl rounded-2xl shadow-xl border-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">{editingId ? "编辑项目" : "添加新项目"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 px-1">
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              <div>
                <Label htmlFor="description" className="text-sm font-medium text-zinc-700">项目描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="项目的详细信息..."
                  className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="status" className="text-sm font-medium text-zinc-700">状态</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">跟进中</SelectItem>
                      <SelectItem value="won">已成交</SelectItem>
                      <SelectItem value="lost">已丢失</SelectItem>
                      <SelectItem value="on_hold">暂停</SelectItem>
                      <SelectItem value="archived">已归档</SelectItem>
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
                <div>
                  <Label htmlFor="belong_year" className="text-sm font-medium text-zinc-700">归属年份</Label>
                  <Input
                    id="belong_year"
                    type="number"
                    min="2000"
                    max="2100"
                    value={formData.belong_year}
                    onChange={(e) => setFormData({ ...formData, belong_year: e.target.value })}
                    placeholder="2024"
                    className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                </div>
              </div>

              {/* 第四行：时间信息 */}
              <div className="grid grid-cols-3 gap-4">
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
                <div>
                  <Label htmlFor="signed_at" className="text-sm font-medium text-zinc-700">成交日期</Label>
                  <Input
                    id="signed_at"
                    type="date"
                    value={formData.signed_at}
                    onChange={(e) => setFormData({ ...formData, signed_at: e.target.value })}
                    className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                </div>
              </div>

              {/* 第五行：合同状态 + 成功概率 */}
              <div className="grid grid-cols-[auto_1fr] gap-6 mt-6">
                <div>
                  <Label className="text-sm font-medium text-zinc-700 mb-2 block">合同状态</Label>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="has_start_notice"
                        checked={formData.has_start_notice}
                        onChange={(e) => setFormData({ ...formData, has_start_notice: e.target.checked })}
                        className="w-4 h-4 rounded border-zinc-300 accent-zinc-600"
                      />
                      <Label htmlFor="has_start_notice" className="text-sm cursor-pointer">有开工函</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="contract_signed"
                        checked={formData.contract_signed}
                        onChange={(e) => setFormData({ ...formData, contract_signed: e.target.checked })}
                        className="w-4 h-4 rounded border-zinc-300 accent-zinc-600"
                      />
                      <Label htmlFor="contract_signed" className="text-sm cursor-pointer">已签署合同</Label>
                    </div>
                  </div>
                </div>
                <div className="flex-1 ml-8">
                  <Label htmlFor="probability" className="text-sm font-medium text-zinc-700 mb-2 block">成功概率：{formData.probability}%</Label>
                  <input
                    id="probability"
                    type="range"
                    min="0"
                    max="100"
                    value={formData.probability}
                    onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })}
                    className="w-full h-2 accent-zinc-600"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" onClick={() => setDialogOpen(false)} className="rounded-full border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                  取消
                </Button>
                <Button type="submit" className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full">
                  {editingId ? '保存' : '创建'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      {/* 项目列表 */}
      {projects.length === 0 ? (
        <Card className="rounded-xl shadow-sm border-0 bg-white">
          <CardContent className="text-center py-8">
            <p className="text-sm text-zinc-400 mb-3">
              {customers.length === 0 ? '请先添加客户' : '还没有项目'}
            </p>
            {customers.length > 0 && (
              <Button onClick={() => setDialogOpen(true)} size="sm" className="h-8 text-sm">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                创建第一个项目
              </Button>
            )}
          </CardContent>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card className="rounded-xl shadow-sm border-0 bg-white">
          <CardContent className="text-center py-8">
            <p className="text-sm text-zinc-400">没有找到匹配的项目</p>
            <Button onClick={() => setSearchKeyword('')} variant="outline" size="sm" className="mt-3 h-8 text-sm">
              清除搜索
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="rounded-xl shadow-sm hover:shadow-md transition-shadow border-0 bg-white overflow-hidden group">
              <CardHeader className="pb-3 pt-3 px-4 border-b border-zinc-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-zinc-500 shrink-0">{project.customers?.name}</span>
                    <h3 className="font-semibold text-sm truncate">{project.name}</h3>
                    <Badge variant={getStatusColor2(project.status) as any} className="shrink-0">
                      {getStatusText2(project.status)}
                    </Badge>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isManager && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                        onClick={() => setAssignTarget(project.id)}
                        title="分派"
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                      onClick={() => handleEdit(project)}
                      title="编辑项目"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                      onClick={() => handleManageSettlements(project)}
                      title="结算阶段"
                    >
                      <Coins className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                      onClick={() => handleOpenCreateTask(project.id)}
                      title="创建任务"
                    >
                      <CheckSquare className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-red-50 text-zinc-400 hover:text-rose-500"
                      onClick={() => handleDelete(project.id)}
                      title="删除项目"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {/* 归属年份标签 */}
                  {project.belong_year && (
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[11px] rounded-full font-medium">
                      {project.belong_year}年
                    </span>
                  )}
                  {project.has_start_notice && (
                    <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-[11px] rounded-full font-medium">✓ 有开工函</span>
                  )}
                  {project.contract_signed && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[11px] rounded-full font-medium">✓ 已签合同</span>
                  )}
                  {/* 验收、开票、回款状态 */}
                  <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${getSettlementTagColor(project.settlement_summary?.accepted || 0, project.settlement_summary?.total || 0)}`}>
                    验收: {project.settlement_summary?.accepted || 0}/{project.settlement_summary?.total || 0}
                  </span>
                  <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${getSettlementTagColor(project.settlement_summary?.invoiced || 0, project.settlement_summary?.total || 0)}`}>
                    开票: {project.settlement_summary?.invoiced || 0}/{project.settlement_summary?.total || 0}
                  </span>
                  <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${getSettlementTagColor(project.settlement_summary?.paid || 0, project.settlement_summary?.total || 0)}`}>
                    回款: {project.settlement_summary?.paid || 0}/{project.settlement_summary?.total || 0}
                  </span>
                </div>
                {project.description && (
                  <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{project.description}</p>
                )}
                <div className="grid grid-cols-5 gap-3 text-xs">
                  <div>
                    <p className="text-zinc-500 text-[11px]">项目价值</p>
                    <p className="font-semibold text-sm">{project.value ? `¥${project.value.toLocaleString()}` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-[11px]">成功概率</p>
                    <p className="font-semibold text-sm">{project.probability != null ? `${project.probability}%` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-[11px]">开始日期</p>
                    <p className="font-semibold text-sm">{project.start_date ? new Date(project.start_date).toLocaleDateString('zh-CN') : '-'}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-[11px]">预期成交</p>
                    <p className="font-semibold text-sm">{project.expected_close_date ? new Date(project.expected_close_date).toLocaleDateString('zh-CN') : '-'}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-[11px]">成交日期</p>
                    <p className={`font-semibold text-sm ${project.signed_at ? 'text-emerald-600' : ''}`}>{project.signed_at ? new Date(project.signed_at).toLocaleDateString('zh-CN') : '-'}</p>
                  </div>
                </div>
                {project.task_summary && project.task_summary.total > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-100">
                    <p className="text-[11px] text-zinc-500">已完成/总任务数：{project.task_summary.completed}/{project.task_summary.total}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 任务创建对话框 */}
      <Dialog open={taskDialogOpen} onOpenChange={(open) => {
        setTaskDialogOpen(open)
        if (!open) {
          setTaskFormData({
            title: '',
            description: '',
            project_id: '',
            priority: 'medium',
            due_date: '',
            status: 'pending'
          })
        }
      }}>
        <DialogContent className="rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">添加新任务</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-6">
            <div>
              <Label htmlFor="task-title" className="text-sm font-medium text-zinc-700">任务标题 *</Label>
              <Input
                id="task-title"
                value={taskFormData.title}
                onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                placeholder="例如：完成项目方案"
                className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
              />
            </div>

            <SearchableSelect
              value={taskFormData.project_id}
              onChange={(value) => setTaskFormData({ ...taskFormData, project_id: value })}
              options={projects}
              placeholder="搜索并选择项目"
              label="关联项目"
              required
            />

            <div>
              <Label htmlFor="task-description" className="text-sm font-medium text-zinc-700">任务描述</Label>
              <Textarea
                id="task-description"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                placeholder="任务的具体内容..."
                className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 resize-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="task-priority" className="text-sm font-medium text-zinc-700">优先级</Label>
                <Select value={taskFormData.priority} onValueChange={(value) => setTaskFormData({ ...taskFormData, priority: value })}>
                  <SelectTrigger id="task-priority" className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低优先级</SelectItem>
                    <SelectItem value="medium">中优先级</SelectItem>
                    <SelectItem value="high">高优先级</SelectItem>
                    <SelectItem value="urgent">紧急</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="task-due-date" className="text-sm font-medium text-zinc-700">截止日期</Label>
                <Input
                  id="task-due-date"
                  type="datetime-local"
                  value={taskFormData.due_date}
                  onChange={(e) => setTaskFormData({ ...taskFormData, due_date: e.target.value })}
                  className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" onClick={() => setTaskDialogOpen(false)} className="rounded-full border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                取消
              </Button>
              <Button type="submit" className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full">
                创建任务
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 结算段管理对话框 */}
      <Dialog open={settlementDialogOpen} onOpenChange={(open) => {
        setSettlementDialogOpen(open)
        if (!open) {
          setSelectedProjectId(null)
          setSelectedProjectStages(1)
          setSelectedProjectValue(null)
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
              projectValue={selectedProjectValue}
              onStagesChange={async () => {
                // 重新加载所有项目数据以获取最新的结算汇总信息
                try {
                  const projectsData = await getProjects()
                  setProjects(projectsData)

                  // 同时更新结算段数据
                  if (selectedProjectId) {
                    const settlements = await getSettlementStages(selectedProjectId)
                    setSelectedProjectSettlements(settlements)
                  }
                } catch (error) {
                  console.error('重新加载数据失败:', error)
                  toast.error('数据刷新失败，请刷新页面')
                }
              }}
              onClose={() => {
                setSettlementDialogOpen(false)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 分派对话框 */}
      {filteredProjects.map(project => (
        <AssignDialog
          key={project.id}
          open={assignTarget === project.id}
          onClose={() => setAssignTarget(null)}
          resourceType="project"
          resourceId={project.id}
          onSuccess={loadData}
        />
      ))}

      {/* 批量导入对话框 */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportSuccess={loadData}
        type="projects"
        title="批量导入项目"
        description="从CSV或Excel文件批量导入项目信息，请先下载模板并按照格式填写数据"
        templateLinks={[
          { label: '下载CSV模板', url: '/templates/projects_template.csv' },
          { label: '下载Excel模板', url: '/templates/projects_template.xlsx' }
        ]}
      />
    </div>
  )
}
