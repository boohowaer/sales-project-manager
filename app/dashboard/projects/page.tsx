'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getProjects, getCustomers, createProject, updateProject, deleteProject, createTask, getProjectWeeklyUpdates, createWeeklyUpdate, updateWeeklyUpdate } from '@/lib/supabase/queries'
import { SettlementStagesManager } from '@/components/projects/SettlementStagesManager'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { DictSelect } from '@/components/ui/dict-select'
import { DatePicker } from '@/components/ui/date-picker'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Pencil, Trash2, Coins, Search, Filter, X, CheckSquare, RotateCcw, Upload, UserPlus, Calendar, Info, FileText } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import type { Project, Customer } from '@/types'
import { ImportDialog } from '@/components/import/ImportDialog'
import { useTeamView } from '@/hooks/useTeamView'
import { AssignDialog } from '@/components/admin/AssignDialog'
import { useUser, useTeamMembers } from '@/context/UserContext'
import { useDictionaries } from '@/context/DictionaryContext'
import { readPageCache, writePageCache } from '@/lib/page-cache'
import { PageLoading } from '@/components/ui/page-loading'

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
  const me = useUser()
  const isManager = me?.role === 'super_admin' || me?.role === 'sales_manager'
  const isSalesRep = me?.role === 'sales_rep'
  const dataScope: 'own' | 'team' = me?.dataScope ?? 'own'
  const [assignTarget, setAssignTarget] = useState<string | null>(null)
  // 缓存读取放到 useEffect 中执行，避免 SSR/CSR 初始 state 不一致引发 hydration mismatch
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

  // 筛选状态 - 从localStorage恢复
  const getSavedFilter = (key: string): string[] => {
    if (typeof window === 'undefined') return []
    const saved = localStorage.getItem('projects-filterState')
    if (!saved) {
      // 兼容旧格式
      const old = localStorage.getItem(`projects-${key}`)
      return old ? JSON.parse(old) : []
    }
    return JSON.parse(saved)[key] || []
  }

  const [filterProjectStatus, setFilterProjectStatus] = useState<string[]>(() => getSavedFilter('filterProjectStatus'))
  const [filterContractStatus, setFilterContractStatus] = useState<string[]>(() => getSavedFilter('filterContractStatus'))
  const [filterAcceptedStatus, setFilterAcceptedStatus] = useState<string[]>(() => getSavedFilter('filterAcceptedStatus'))
  const [filterInvoicedStatus, setFilterInvoicedStatus] = useState<string[]>(() => getSavedFilter('filterInvoicedStatus'))
  const [filterPaidStatus, setFilterPaidStatus] = useState<string[]>(() => getSavedFilter('filterPaidStatus'))
  const [filterBelongYear, setFilterBelongYear] = useState<string[]>(() => getSavedFilter('filterBelongYear'))
  const [filterSales, setFilterSales] = useState<string[]>(() => getSavedFilter('filterSales'))
  const { members: teamMembers, ensureMembers } = useTeamMembers()
  const [filterMilestone, setFilterMilestone] = useState<string[]>(() => getSavedFilter('filterMilestone'))
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [settlementsMap, setSettlementsMap] = useState<Map<string, any[]>>(new Map())

  // 字典数据来自全局 DictionaryContext（按需懒加载 + 跨页缓存）
  const dicts = useDictionaries(['customer_source', 'industry', 'project_status'])
  const buildCascade = (entries: any[]) => {
    const active = entries.filter(e => e.is_active)
    const parents = active.filter((e: any) => !e.parent_id || e.level === 1)
    return parents.map((parent: any) => ({
      key: parent.key,
      label: parent.label,
      children: active
        .filter((c: any) => c.parent_id === parent.id)
        .map((c: any) => ({ key: c.key, label: c.label })),
    }))
  }
  const customerSourceOptions = useMemo(() => buildCascade(dicts.customer_source || []), [dicts.customer_source])
  const industryOptions = useMemo(() => buildCascade(dicts.industry || []), [dicts.industry])
  const DEFAULT_PROJECT_STATUS = [
    { key: 'prospect', label: '初步接触' },
    { key: 'qualifying', label: '需求确认' },
    { key: 'proposal', label: '方案报价' },
    { key: 'negotiation', label: '谈判中' },
    { key: 'won', label: '已成交' },
    { key: 'lost', label: '已失败' },
    { key: 'archived', label: '已归档' },
  ]

  const projectStatusOptions = useMemo(() => {
    const dictItems = (dicts.project_status || []).filter(e => e.is_active).map(e => ({ key: e.key, label: e.label }))
    return dictItems.length > 0 ? dictItems : DEFAULT_PROJECT_STATUS
  }, [dicts.project_status])

  // 保存筛选器状态到localStorage（合并为一次写入）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const filterState = {
        filterProjectStatus,
        filterContractStatus,
        filterAcceptedStatus,
        filterInvoicedStatus,
        filterPaidStatus,
        filterBelongYear,
        filterMilestone,
        filterSales
      }
      localStorage.setItem('projects-filterState', JSON.stringify(filterState))
    }
  }, [filterProjectStatus, filterContractStatus, filterAcceptedStatus, filterInvoicedStatus, filterPaidStatus, filterBelongYear, filterMilestone, filterSales])

  // 任务对话框状态
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    priority: 'medium',
    due_date: ''
  })

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    customer_id: '',
    customer_source: '',
    industry: '',
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

  // 编辑进展弹窗状态
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [updateProject, setUpdateProject] = useState<any>(null)
  const [updateEditingId, setUpdateEditingId] = useState<string | null>(null)
  const [updateContent, setUpdateContent] = useState('')

  const getCurrentWeek = () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
    const monday = new Date(now.setDate(diff))
    const year = monday.getFullYear()
    const month = String(monday.getMonth() + 1).padStart(2, '0')
    const day = String(monday.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getWeekDisplay = (week: string) => {
    if (!week) return ''
    const [year, month, day] = week.split('-')
    const monday = new Date(`${year}-${month}-${day}`)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return `${monday.getMonth() + 1}月${monday.getDate()}日 - ${sunday.getMonth() + 1}月${sunday.getDate()}日`
  }

  const handleOpenUpdate = async (project: any) => {
    setUpdateProject(project)
    setUpdateEditingId(null)
    setUpdateContent('')
    try {
      const updates = await getProjectWeeklyUpdates(project.id)
      const currentWeek = getCurrentWeek()
      const existing = updates.find((u: any) => u.week === currentWeek)
      if (existing) {
        setUpdateEditingId(existing.id)
        setUpdateContent(existing.content || '')
      }
    } catch {}
    setUpdateDialogOpen(true)
  }

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!updateContent.trim()) { toast.error('请填写本周进展内容'); return }
    if (!updateProject) return
    try {
      const currentWeek = getCurrentWeek()
      const settlements = settlementsMap.get(updateProject.id) || []
      const totalStages = updateProject.settlement_stages || 1
      const acceptedCount = settlements.filter((s: any) => s.accepted).length
      const invoicedCount = settlements.filter((s: any) => s.invoiced).length
      const paidCount = settlements.filter((s: any) => s.paid).length

      if (updateEditingId) {
        await updateWeeklyUpdate(updateEditingId, { content: updateContent })
        toast.success('进展更新成功')
      } else {
        await createWeeklyUpdate({
          project_id: updateProject.id,
          week: currentWeek,
          content: updateContent,
          contract_signed: updateProject.contract_signed,
          settlement_accepted: acceptedCount,
          settlement_invoiced: invoicedCount,
          settlement_paid: paidCount,
          settlement_total: totalStages
        } as any)
        toast.success('进展添加成功')
      }
      setUpdateDialogOpen(false)
      setUpdateProject(null)
      setUpdateContent('')
      setUpdateEditingId(null)
    } catch (error: any) {
      toast.error(error.message || '操作失败')
    }
  }

  const initialLoadDone = useRef(false)

  useEffect(() => {
    if (!initialLoadDone.current) {
      // 客户端读缓存：有则立即填充以避免骨架屏闪烁
      const cp = readPageCache<any[]>('projects:' + dataScope)
      const cc = readPageCache<Customer[]>('customers:' + dataScope)
      if (cp) {
        setProjects(cp)
        const map = new Map<string, any[]>()
        cp.forEach((p: any) => map.set(p.id, p._settlements || []))
        setSettlementsMap(map)
        setLoading(false)
      }
      if (cc) setCustomers(cc)

      const shouldOpenDialog = sessionStorage.getItem('openProjectDialog')
      if (shouldOpenDialog === 'true') {
        setDialogOpen(true)
        sessionStorage.removeItem('openProjectDialog')
      }
      initialLoadDone.current = true
    }
    loadData()
  }, [viewMode])

  const loadData = async () => {
    try {
      // team view 时按需触发成员缓存加载（不阻塞主请求）
      if (viewMode === 'team') ensureMembers()

      const [projectsData, customersData] = await Promise.all([
        getProjects({ teamView: viewMode === 'team' }),
        getCustomers(),
      ])
      setProjects(projectsData)
      setCustomers(customersData)
      writePageCache('projects:' + (viewMode === 'team' ? 'team' : 'own'), projectsData)
      writePageCache('customers:' + (viewMode === 'team' ? 'team' : 'own'), customersData)

      const map = new Map<string, any[]>()
      projectsData.forEach((p: any) => map.set(p.id, p._settlements || []))
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

      if (editingId) {
        const updateData = {
          name: formData.name,
          description: formData.description || null,
          customer_id: formData.customer_id,
          customer_source: formData.customer_source || null,
          industry: formData.industry || null,
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
          window.dispatchEvent(new Event('refresh-bell'))
        } else {
          try {
            const oldProject = projects.find((p: any) => p.id === editingId)
            const updatedProject = await updateProject(editingId, updateData)
            toast.success('项目更新成功')
            setProjects(prevProjects =>
              prevProjects.map(p =>
                p.id === editingId ? { ...p, ...updatedProject } : p
              )
            )
            window.dispatchEvent(new Event('refresh-bell'))

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
          customer_source: formData.customer_source || null,
          industry: formData.industry || null,
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
          window.dispatchEvent(new Event('refresh-bell'))
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
        customer_source: '',
        industry: '',
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
      customer_source: project.customer_source || '',
      industry: project.industry || '',
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
    setSelectedProjectSettlements(project._settlements || [])
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
          customer_source: '',
          industry: '',
          status: 'active',
          value: '',
          probability: 50,
          start_date: '',
          expected_close_date: '',
          has_start_notice: false,
          contract_signed: false,
          signed_at: '',
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

  // 获取状态文本的颜色（纯文字，无背景）
  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'won': return 'text-emerald-600'
      case 'lost': return 'text-red-500'
      case 'on_hold': return 'text-zinc-500'
      case 'archived': return 'text-zinc-400'
      default: return 'text-zinc-900'
    }
  }

  // 状态默认映射（字典加载完成前的 fallback）
  const statusDefaultLabels: Record<string, string> = {
    active: '跟进中',
    won: '已成交',
    lost: '已丢失',
    on_hold: '暂停',
    archived: '已归档'
  }

  const getStatusText2 = (status: string) => {
    const found = projectStatusOptions.find(o => o.key === status)
    return found ? found.label : (statusDefaultLabels[status] || status)
  }

  // 在级联选项中查找标签
  const findCascadeLabel = (options: { key: string; label: string; children?: { key: string; label: string }[] }[], key: string): string | undefined => {
    for (const opt of options) {
      if (opt.key === key) return opt.label
      if (opt.children) {
        const child = opt.children.find(c => c.key === key)
        if (child) return child.label
      }
    }
    return undefined
  }

  // 辅助函数：根据验收/开票/回款状态获取标签颜色
  const getSettlementTagColor = (count: number, total: number) => {
    if (total === 0) return 'bg-amber-100 text-amber-700' // 无结算段
    if (count === total) return 'bg-emerald-100 text-emerald-700' // 已完成
    return 'bg-amber-100 text-amber-700' // 未完成或部分完成
  }

  const filteredProjects = useMemo(() => projects.filter(project => {
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

    // 归属销售筛选（仅团队视图）
    if (filterSales.length > 0) {
      if (!filterSales.includes(project.user_id)) return false
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
          if (!project.expected_close_date || project.contract_signed) return false
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
  }), [projects, searchKeyword, filterProjectStatus, filterContractStatus, filterAcceptedStatus, filterInvoicedStatus, filterPaidStatus, filterBelongYear, filterSales, filterMilestone, settlementsMap])

  const handleOpenCreateTask = (projectId: string) => {
    setTaskFormData({
      title: '',
      description: '',
      project_id: projectId,
      priority: 'medium',
      due_date: ''
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
        status: 'pending'
      })
      toast.success('任务创建成功')
      setTaskDialogOpen(false)
      setTaskFormData({
        title: '',
        description: '',
        project_id: '',
        priority: 'medium',
        due_date: ''
      })
    } catch (error: any) {
      console.error('创建任务失败:', error)
      toast.error(error.message || '创建任务失败')
    }
  }

  if (loading) {
    return <PageLoading variant="card-list" />
  }

  return (
    <div className="p-4 md:p-8">
      {/* 页面标题 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 tracking-tight">项目管理</h1>
          <p className="mt-2 text-zinc-500 text-sm">管理您的所有销售项目</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap -translate-y-1">
          <div className="relative flex items-center h-9">
            <Search className="w-4 h-4 text-zinc-400 absolute left-4 pointer-events-none" />
            <Input
              placeholder="搜索项目或客户..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="h-9 w-full md:w-56 pl-10 pr-4 rounded-full bg-transparent border-zinc-200 focus:border-zinc-300 placeholder:text-zinc-400 text-sm"
            />
          </div>
          <Button
            onClick={() => setFilterDialogOpen(true)}
            variant="outline"
            className="h-9 px-3"
          >
            <Filter className="w-4 h-4 mr-1.5" />
            筛选
            {(filterProjectStatus.length > 0 || filterContractStatus.length > 0 || filterAcceptedStatus.length > 0 ||
              filterInvoicedStatus.length > 0 || filterPaidStatus.length > 0 || filterBelongYear.length > 0 || filterMilestone.length > 0 || filterSales.length > 0) && (
              <Badge variant="secondary" className="ml-1.5 bg-zinc-900 text-white">
                {filterProjectStatus.length + filterContractStatus.length + filterAcceptedStatus.length + filterInvoicedStatus.length + filterPaidStatus.length + filterBelongYear.length + filterMilestone.length + filterSales.length}
              </Badge>
            )}
          </Button>
          {dataScope === 'team' && (
            <div className="inline-flex items-center bg-zinc-100 rounded-full p-1 h-9 whitespace-nowrap shadow-sm">
              <button
                onClick={() => viewMode !== 'mine' && toggle()}
                className={`h-7 px-4 text-xs font-medium rounded-full transition-all duration-200 ${viewMode === 'mine' ? 'bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'text-zinc-500 hover:text-zinc-800'}`}
              >
                只看我的
              </button>
              <button
                onClick={() => viewMode !== 'team' && toggle()}
                className={`h-7 px-4 text-xs font-medium rounded-full transition-all duration-200 ${viewMode === 'team' ? 'bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'text-zinc-500 hover:text-zinc-800'}`}
              >
                查看全团队
              </button>
            </div>
          )}

          <Button
            onClick={() => setImportDialogOpen(true)}
            className="h-9 shadow-sm"
          >
            <Upload className="w-4 h-4 mr-2" />
            批量导入
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={customers.length === 0} className="h-9 shadow-sm">
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
                  setFilterSales([])                }}
                variant="ghost"
                size="sm"
                className="text-zinc-500 hover:text-zinc-700"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                清空筛选
              </Button>
            </div>
          </DialogHeader>

          <div className={`grid ${viewMode === 'team' && teamMembers.length > 0 ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-7'} gap-4 px-2`}>
            {/* 项目状态 */}
            <div>
              <Label className="text-xs font-medium text-zinc-700 mb-2 block">项目状态</Label>
              <div className="space-y-1.5">
                {projectStatusOptions.map(status => (
                  <label key={status.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={filterProjectStatus.includes(status.key)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilterProjectStatus([...filterProjectStatus, status.key])
                        } else {
                          setFilterProjectStatus(filterProjectStatus.filter(s => s !== status.key))
                        }
                      }}
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
                    <Checkbox
                      checked={filterContractStatus.includes(status)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilterContractStatus([...filterContractStatus, status])
                        } else {
                          setFilterContractStatus(filterContractStatus.filter(s => s !== status))
                        }
                      }}
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
                    <Checkbox
                      checked={filterAcceptedStatus.includes(status)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilterAcceptedStatus([...filterAcceptedStatus, status])
                        } else {
                          setFilterAcceptedStatus(filterAcceptedStatus.filter(s => s !== status))
                        }
                      }}
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
                    <Checkbox
                      checked={filterInvoicedStatus.includes(status)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilterInvoicedStatus([...filterInvoicedStatus, status])
                        } else {
                          setFilterInvoicedStatus(filterInvoicedStatus.filter(s => s !== status))
                        }
                      }}
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
                    <Checkbox
                      checked={filterPaidStatus.includes(status)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilterPaidStatus([...filterPaidStatus, status])
                        } else {
                          setFilterPaidStatus(filterPaidStatus.filter(s => s !== status))
                        }
                      }}
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
                      <Checkbox
                        checked={filterBelongYear.includes(String(year))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilterBelongYear([...filterBelongYear, String(year)])
                          } else {
                            setFilterBelongYear(filterBelongYear.filter(y => y !== String(year)))
                          }
                        }}
                      />
                      <span className="text-zinc-700">{year}年</span>
                    </label>
                  ))}
                {projects.filter(p => p.belong_year).length === 0 && (
                  <span className="text-xs text-zinc-400">暂无年份数据</span>
                )}
              </div>
            </div>

            {/* 归属销售（仅团队视图） */}
            {viewMode === 'team' && teamMembers.length > 0 && (
              <div>
                <Label className="text-xs font-medium text-zinc-700 mb-2 block">归属销售</Label>
                <div className="space-y-1.5">
                  {teamMembers.map(m => (
                    <label key={m.user_id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={filterSales.includes(m.user_id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilterSales([...filterSales, m.user_id])
                          } else {
                            setFilterSales(filterSales.filter(id => id !== m.user_id))
                          }
                        }}
                      />
                      <span className="text-zinc-700">{m.name || '未知'}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 关注节点 */}            <div>
              <Label className="text-xs font-medium text-zinc-700 mb-2 block">关注节点</Label>
              <div className="space-y-1.5">
                {['计划签约', '计划验收', '计划开票', '计划回款'].map(type => (
                  <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={filterMilestone.includes(type)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilterMilestone([...filterMilestone, type])
                        } else {
                          setFilterMilestone(filterMilestone.filter(s => s !== type))
                        }
                      }}
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
        <DialogContent className="max-w-4xl rounded-2xl shadow-xl border-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">{editingId ? "编辑项目" : "添加新项目"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 px-1">
              {/* 基本信息 */}
              <div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">基本信息</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.6fr_1.2fr_0.6fr_0.6fr] gap-5">
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
                    <Label className="text-sm font-medium text-zinc-700">客户 *</Label>
                    <DictSelect
                      value={formData.customer_id}
                      onChange={(value) => setFormData({ ...formData, customer_id: value })}
                      options={customers.map((c) => ({ key: c.id, label: c.name, subLabel: c.company || undefined }))}
                      placeholder="搜索选择客户"
                      className="mt-2"
                      showClear={false}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-zinc-700">客户来源</Label>
                    <DictSelect
                      value={formData.customer_source}
                      onChange={(value) => setFormData({ ...formData, customer_source: value })}
                      options={customerSourceOptions}
                      placeholder="选择客户来源"
                      className="mt-2"
                      cascade
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-zinc-700">行业归属</Label>
                    <DictSelect
                      value={formData.industry}
                      onChange={(value) => setFormData({ ...formData, industry: value })}
                      options={industryOptions}
                      placeholder="搜索选择行业"
                      className="mt-2"
                      cascade
                    />
                  </div>
                </div>
                <div className="mt-4">
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
              </div>

              {/* 状态信息 */}
              <div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">状态信息</div>
                <div className="grid grid-cols-4 gap-5">
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
                    <Label className="text-sm font-medium text-zinc-700">状态</Label>
                    <DictSelect
                      value={formData.status}
                      onChange={(value) => setFormData({ ...formData, status: value })}
                      options={
                        formData.contract_signed
                          ? projectStatusOptions.filter(o => o.key === 'won' || o.key === 'archived')
                          : projectStatusOptions
                      }
                      placeholder="选择状态"
                      className="mt-2"
                      showClear={false}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-zinc-700">开工函</Label>
                    <div className="flex gap-1.5 mt-2 h-10 items-center">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, has_start_notice: false })}
                        className={`flex-1 h-10 px-3 rounded-full text-xs font-medium transition-colors ${
                          !formData.has_start_notice
                            ? 'bg-zinc-900 text-white'
                            : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                        }`}
                      >
                        无
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, has_start_notice: true })}
                        className={`flex-1 h-10 px-3 rounded-full text-xs font-medium transition-colors ${
                          formData.has_start_notice
                            ? 'bg-emerald-500 text-white'
                            : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                        }`}
                      >
                        有
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-zinc-700">签署合同</Label>
                    <div className="flex gap-1.5 mt-2 h-10 items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, contract_signed: false })
                        }}
                        className={`flex-1 h-10 px-3 rounded-full text-xs font-medium transition-colors ${
                          !formData.contract_signed
                            ? 'bg-zinc-900 text-white'
                            : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                        }`}
                      >
                        未签
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            contract_signed: true,
                            status: 'won'
                          })
                        }}
                        className={`flex-1 h-10 px-3 rounded-full text-xs font-medium transition-colors ${
                          formData.contract_signed
                            ? 'bg-emerald-500 text-white'
                            : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                        }`}
                      >
                        已签
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 时间信息 */}
              <div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">时间信息</div>
                <div className="grid grid-cols-4 gap-5">
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
                  <div>
                    <Label className="text-sm font-medium text-zinc-700">开始日期</Label>
                    <DatePicker
                      value={formData.start_date}
                      onChange={(value) => setFormData({ ...formData, start_date: value })}
                      placeholder="选择开始日期"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-zinc-700">预期成交日期</Label>
                    <DatePicker
                      value={formData.expected_close_date}
                      onChange={(value) => setFormData({ ...formData, expected_close_date: value })}
                      placeholder="选择预期成交日期"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-sm font-medium text-zinc-700">成交日期</Label>
                      <div className="relative group">
                        <Info className="w-3 h-3 text-zinc-300 cursor-help" />
                        <div className="absolute left-0 top-full mt-2 w-72 bg-zinc-900 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50" style={{ marginLeft: '-6px' }}>
                          <div className="absolute -top-1.5 left-[6px] w-3 h-3 bg-zinc-900" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></div>
                          <div className="p-3 text-white text-xs">
                            <p className="font-medium mb-1.5">成交日期</p>
                            <p className="text-zinc-300">代表收到开工函或合同签约的日期，用于统计本月新增签约金额。</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <DatePicker
                      value={formData.signed_at}
                      onChange={(value) => setFormData({ ...formData, signed_at: value })}
                      placeholder="选择成交日期"
                      className="mt-2"
                      disabled={!formData.contract_signed && !formData.has_start_notice}
                    />
                  </div>
                </div>
              </div>

              {/* 成功概率 */}
              <div>
                <Label htmlFor="probability" className="text-sm font-medium text-zinc-700">成功概率：{formData.probability}%</Label>
                <input
                  id="probability"
                  type="range"
                  min="0"
                  max="100"
                  value={formData.probability}
                  onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })}
                  className="w-full h-2 accent-zinc-600 mt-2"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="cancel" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit">
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
            <Button onClick={() => setSearchKeyword('')} variant="outline" size="sm" className="mt-3">
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
                    <span className="text-xs text-zinc-500 shrink-0">{project.customers?.name || '客户已删除'}</span>
                    <h3 className="font-semibold text-sm truncate">{project.name}</h3>
                    <span className={`shrink-0 text-xs font-semibold ${getStatusTextColor(project.status)}`}>
                      {getStatusText2(project.status)}
                    </span>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isManager && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-zinc-600 hover:text-zinc-900"
                        onClick={() => setAssignTarget(project.id)}
                        title="分派"
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-zinc-600 hover:text-zinc-900"
                      onClick={() => handleEdit(project)}
                      title="编辑项目"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-zinc-600 hover:text-zinc-900"
                      onClick={() => handleManageSettlements(project)}
                      title="结算阶段"
                    >
                      <Coins className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-zinc-600 hover:text-zinc-900"
                      onClick={() => handleOpenUpdate(project)}
                      title="编辑进展"
                    >
                      <FileText className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-zinc-600 hover:text-zinc-900"
                      onClick={() => handleOpenCreateTask(project.id)}
                      title="创建任务"
                    >
                      <CheckSquare className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-red-50 text-zinc-400 hover:text-rose-500"
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
                    <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${project.belong_year === new Date().getFullYear() ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-500'}`}>
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
                <div className="grid grid-cols-7 gap-3 text-xs">
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
                  <div>
                    <p className="text-zinc-500 text-[11px]">客户来源</p>
                    <p className="font-semibold text-sm">{project.customer_source ? (findCascadeLabel(customerSourceOptions, project.customer_source) || (customerSourceOptions.length > 0 ? project.customer_source : '-')) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-[11px]">行业归属</p>
                    <p className="font-semibold text-sm">{project.industry ? (findCascadeLabel(industryOptions, project.industry) || (industryOptions.length > 0 ? project.industry : '-')) : '-'}</p>
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
            due_date: ''
          })
        }
      }}>
        <DialogContent className="max-w-[32rem] rounded-2xl shadow-xl border-0">
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
                placeholder="例如：给客户发送报价单"
                className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
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
                placeholder="任务的详细信息..."
                className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 resize-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-[7rem_1fr] gap-4">
              <div>
                <Label htmlFor="task-priority" className="text-sm font-medium text-zinc-700">优先级</Label>
                <Select value={taskFormData.priority} onValueChange={(value) => setTaskFormData({ ...taskFormData, priority: value })}>
                  <SelectTrigger id="task-priority" className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="urgent">紧急</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="task-due-date" className="text-sm font-medium text-zinc-700">截止日期</Label>
                <div className="relative mt-2">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  <Input
                    id="task-due-date"
                    type="datetime-local"
                    value={taskFormData.due_date}
                    onChange={(e) => setTaskFormData({ ...taskFormData, due_date: e.target.value })}
                    className="pl-9 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button type="button" variant="cancel" onClick={() => setTaskDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">
                创建
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
                try {
                  const projectsData = await getProjects({ teamView: viewMode === 'team' })
                  setProjects(projectsData)
                  const map = new Map<string, any[]>()
                  projectsData.forEach((p: any) => map.set(p.id, p._settlements || []))
                  setSettlementsMap(map)
                  if (selectedProjectId) {
                    setSelectedProjectSettlements(map.get(selectedProjectId) || [])
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

      {/* 编辑本周进展对话框 */}
      <Dialog open={updateDialogOpen} onOpenChange={(open) => {
        setUpdateDialogOpen(open)
        if (!open) { setUpdateProject(null); setUpdateContent(''); setUpdateEditingId(null) }
      }}>
        <DialogContent className="max-w-2xl rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {updateEditingId ? '编辑本周进展' : `填写本周进展 - ${updateProject?.name}`}
              <span className="text-xs text-zinc-400 font-normal ml-2">{getWeekDisplay(getCurrentWeek())}</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitUpdate} className="space-y-6">
            <div>
              <Label htmlFor="update-content" className="text-sm font-medium text-zinc-700">本周进展内容 *</Label>
              <Textarea
                id="update-content"
                value={updateContent}
                onChange={(e) => setUpdateContent(e.target.value)}
                placeholder="填写本周的项目进展、关键里程碑、遇到的问题和解决方案等..."
                rows={6}
                className="mt-2 resize-none border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="cancel" onClick={() => setUpdateDialogOpen(false)}>取消</Button>
              <Button type="submit">{updateEditingId ? '保存' : '提交'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
