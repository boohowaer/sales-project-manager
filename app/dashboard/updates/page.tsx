'use client'

import { useState, useEffect } from 'react'
import { getProjects, getWeeklyUpdates, getProjectWeeklyUpdates, createWeeklyUpdate, updateWeeklyUpdate, deleteWeeklyUpdate, getSettlementStages, createTask } from '@/lib/supabase/queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil, Trash2, Clock, Search, CheckCircle, Edit3, Filter, X, RotateCcw, CheckSquare } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function UpdatesPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [weeklyUpdates, setWeeklyUpdates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState<any>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [currentWeek, setCurrentWeek] = useState('')
  const [searchKeyword, setSearchKeyword] = useState<string>('')

  // 筛选状态 - 从localStorage恢复
  const [filterContractStatus, setFilterContractStatus] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('updates-filterContractStatus')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [filterAcceptedStatus, setFilterAcceptedStatus] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('updates-filterAcceptedStatus')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [filterInvoicedStatus, setFilterInvoicedStatus] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('updates-filterInvoicedStatus')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [filterPaidStatus, setFilterPaidStatus] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('updates-filterPaidStatus')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [filterBelongYear, setFilterBelongYear] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('updates-filterBelongYear')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)

  // 保存筛选器状态到localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('updates-filterContractStatus', JSON.stringify(filterContractStatus))
      localStorage.setItem('updates-filterAcceptedStatus', JSON.stringify(filterAcceptedStatus))
      localStorage.setItem('updates-filterInvoicedStatus', JSON.stringify(filterInvoicedStatus))
      localStorage.setItem('updates-filterPaidStatus', JSON.stringify(filterPaidStatus))
      localStorage.setItem('updates-filterBelongYear', JSON.stringify(filterBelongYear))
    }
  }, [filterContractStatus, filterAcceptedStatus, filterInvoicedStatus, filterPaidStatus, filterBelongYear])

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
    content: ''
  })

  useEffect(() => {
    const week = getCurrentWeek()
    setCurrentWeek(week)
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [projectsData, updatesData] = await Promise.all([
        getProjects(),
        getWeeklyUpdates()
      ])

      // 为每个项目获取最新的进展和结算段状态
      const projectIds = projectsData.map((p: any) => p.id)
      const settlementsPromises = projectIds.map(id => getSettlementStages(id))
      const settlementsArray = await Promise.all(settlementsPromises)

      const projectWithUpdates = projectsData.map((project: any) => {
        const projectUpdates = updatesData.filter((u: any) => u.project_id === project.id)
        const latestUpdate = projectUpdates[0]
        const settlements = settlementsArray[projectIds.indexOf(project.id)] || []
        const currentWeekUpdate = projectUpdates.find((u: any) => u.week === currentWeek)

        // 计算结算段状态
        const totalStages = project.settlement_stages || 1
        const acceptedCount = settlements.filter((s: any) => s.accepted).length
        const invoicedCount = settlements.filter((s: any) => s.invoiced).length
        const paidCount = settlements.filter((s: any) => s.paid).length

        return {
          ...project,
          latest_update: latestUpdate,
          current_week_update: currentWeekUpdate,
          settlement_summary: {
            total: totalStages,
            accepted: acceptedCount,
            invoiced: invoicedCount,
            paid: paidCount
          }
        }
      })

      setProjects(projectWithUpdates)
      setWeeklyUpdates(updatesData)
    } catch (error: any) {
      console.error('加载数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  // 获取当前周的标识（周一的日期）
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

  // 获取周的显示文本（周一到周日）
  const getWeekDisplay = (week: string) => {
    if (!week) return ''
    const [year, month, day] = week.split('-')
    const monday = new Date(`${year}-${month}-${day}`)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    return `${monday.getMonth() + 1}月${monday.getDate()}日 - ${sunday.getMonth() + 1}月${sunday.getDate()}日`
  }

  // 获取周一日期显示
  const getMondayDisplay = (week: string) => {
    if (!week) return ''
    const [year, month, day] = week.split('-')
    return `${month}月${day}日`
  }

  const handleOpenHistory = async (project: any) => {
    setCurrentProject(project)
    const updates = await getProjectWeeklyUpdates(project.id)
    setCurrentProject({ ...project, history: updates })
    setHistoryDialogOpen(true)
  }

  const handleEditThisWeek = (project: any) => {
    setCurrentProject(project)
    setEditingId(project.current_week_update?.id || null)
    setFormData({ content: project.current_week_update?.content || '' })
    setEditDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.content.trim()) {
      toast.error('请填写本周进展内容')
      return
    }

    if (!currentProject) {
      toast.error('请选择项目')
      return
    }

    try {
      const project = currentProject
      const settlements = await getSettlementStages(project.id)
      const totalStages = project.settlement_stages || 1
      const acceptedCount = settlements.filter((s: any) => s.accepted).length
      const invoicedCount = settlements.filter((s: any) => s.invoiced).length
      const paidCount = settlements.filter((s: any) => s.paid).length

      if (editingId) {
        await updateWeeklyUpdate(editingId, {
          content: formData.content
        })
        toast.success('进展更新成功')
      } else {
        await createWeeklyUpdate({
          project_id: project.id,
          week: currentWeek,
          content: formData.content,
          contract_signed: project.contract_signed,
          settlement_accepted: acceptedCount,
          settlement_invoiced: invoicedCount,
          settlement_paid: paidCount,
          settlement_total: totalStages
        })
        toast.success('进展添加成功')
      }

      setEditDialogOpen(false)
      setFormData({ content: '' })
      setEditingId(null)
      loadData()
    } catch (error: any) {
      console.error('保存进展失败:', error)
      toast.error(error.message || '操作失败')
    }
  }

  const handleDeleteUpdate = async (id: string) => {
    if (!confirm('确定要删除这条进展记录吗？')) {
      return
    }

    try {
      await deleteWeeklyUpdate(id)
      toast.success('进展删除成功')
      if (currentProject) {
        const updates = await getProjectWeeklyUpdates(currentProject.id)
        setCurrentProject({ ...currentProject, history: updates })
      }
      loadData()
    } catch (error: any) {
      toast.error(error.message || '删除失败')
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!taskFormData.title || !taskFormData.project_id) {
      toast.error('请填写任务标题和选择项目')
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

  const getStatusBadge = (type: string, count: number, total: number) => {
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

  // 过滤项目
  const filteredProjects = projects.filter(project => {
    // 搜索关键词筛选
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase()
      const projectName = project.name?.toLowerCase() || ''

      if (!projectName.includes(keyword)) {
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

    return true
  })

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-zinc-400">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">项目进展</h1>
          <p className="mt-1 text-sm text-zinc-500">每周填写项目进展，记录签署、验收、开票、回款情况</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-zinc-400" />
            <Input
              placeholder="搜索项目..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-48 h-9 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
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
            {(filterContractStatus.length > 0 || filterAcceptedStatus.length > 0 ||
              filterInvoicedStatus.length > 0 || filterPaidStatus.length > 0 || filterBelongYear.length > 0) && (
              <Badge variant="secondary" className="ml-2 bg-zinc-900 text-white">
                {filterContractStatus.length + filterAcceptedStatus.length + filterInvoicedStatus.length + filterPaidStatus.length + filterBelongYear.length}
              </Badge>
            )}
          </Button>

          <Button
            onClick={() => setTaskDialogOpen(true)}
            disabled={projects.length === 0}
            className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full"
          >
            <CheckSquare className="w-4 h-4 mr-2" />
            添加任务
          </Button>
        </div>
      </div>

      {/* 项目列表 - 表格形式 */}
      {filteredProjects.length === 0 ? (
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="text-center py-12">
            <p className="text-zinc-400">{searchKeyword ? '未找到匹配的项目' : '还没有项目'}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b border-zinc-200 rounded-t-2xl">
                <tr>
                  <th className="text-left py-4 px-4 text-xs font-medium text-zinc-500 uppercase min-w-[200px] rounded-tl-2xl">项目名称</th>
                  <th className="text-left py-4 px-4 text-xs font-medium text-zinc-500 uppercase min-w-[100px]">项目价值</th>
                  <th className="text-left py-4 px-4 text-xs font-medium text-zinc-500 uppercase min-w-[280px]">结算状态</th>
                  <th className="text-left py-4 px-4 text-xs font-medium text-zinc-500 uppercase min-w-[200px]">最新进展</th>
                  <th className="text-right py-4 px-4 text-xs font-medium text-zinc-500 uppercase min-w-[100px] rounded-tr-2xl">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredProjects.map((project: any) => (
                  <tr key={project.id} className="hover:bg-zinc-50 transition-colors">

                    <td className="py-3 px-4">
                      <div className="flex flex-col items-start justify-start">
                        {project.belong_year && (
                          <span className="text-xs text-indigo-600 font-medium mb-1">{project.belong_year}年</span>
                        )}
                        <div className="font-medium text-sm whitespace-nowrap">{project.name}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-500">
                      {project.value ? `¥${project.value.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center">
                        {/* 合同签署 */}
                        {project.contract_signed ? (
                          <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 text-xs rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            已签合同
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 text-xs rounded-full">
                            未签合同
                          </span>
                        )}
                        {/* 结算段数（与合同签署间距0.25rem） */}
                        <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 text-xs rounded-full ml-1">
                          {project.settlement_stages}段
                        </span>
                        {/* 验收、开票、回款（与前一个间距1px） */}
                        <div className="flex items-center" style={{ gap: '1px' }}>
                          {getStatusBadge('accepted', project.settlement_summary?.accepted || 0, project.settlement_summary?.total || 0)}
                          {getStatusBadge('invoiced', project.settlement_summary?.invoiced || 0, project.settlement_summary?.total || 0)}
                          {getStatusBadge('paid', project.settlement_summary?.paid || 0, project.settlement_summary?.total || 0)}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {project.latest_update ? (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs text-zinc-400">
                              {getMondayDisplay(project.latest_update.week)}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                              最新
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-500 line-clamp-1">
                            {project.latest_update.content}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-zinc-400">暂无进展</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditThisWeek(project)}
                          title={project.current_week_update ? '编辑本周进展' : '填写本周进展'}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenHistory(project)}
                          title="查看历史"
                        >
                          <Clock className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 填写/编辑本周进展对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open)
        if (!open) {
          setEditingId(null)
          setFormData({ content: '' })
          setCurrentProject(null)
        }
      }}>
        <DialogContent className="max-w-2xl rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {editingId ? '编辑本周进展' : `填写本周进展 - ${currentProject?.name}`}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="week" className="text-sm font-medium text-zinc-700">周次</Label>
              <Input
                id="week"
                value={currentWeek}
                readOnly
                className="mt-2 bg-zinc-50 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
              />
              <p className="text-xs text-zinc-400 mt-1">{getWeekDisplay(currentWeek)}</p>
            </div>

            <div>
              <Label htmlFor="content" className="text-sm font-medium text-zinc-700">本周进展内容 *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="填写本周的项目进展、关键里程碑、遇到的问题和解决方案等..."
                rows={6}
                className="mt-2 resize-none border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
              />
            </div>

            {currentProject && (
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
                <h4 className="text-sm font-semibold text-zinc-900 mb-3">同步的项目状态（只读）</h4>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-600">合同签署：</span>
                      {currentProject.contract_signed ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <span className="text-zinc-400">未签署</span>
                      )}
                    </div>
                    <p className="text-zinc-600">项目价值：<span className="font-medium text-zinc-900">¥{(currentProject.value || 0).toLocaleString()}</span></p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-zinc-600">结算状态：</span>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs">共{currentProject.settlement_summary?.total || 0}段</Badge>
                      {getStatusBadge('accepted', currentProject.settlement_summary?.accepted || 0, currentProject.settlement_summary?.total || 0)}
                      {getStatusBadge('invoiced', currentProject.settlement_summary?.invoiced || 0, currentProject.settlement_summary?.total || 0)}
                      {getStatusBadge('paid', currentProject.settlement_summary?.paid || 0, currentProject.settlement_summary?.total || 0)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button type="button" onClick={() => setEditDialogOpen(false)} className="rounded-full border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                取消
              </Button>
              <Button type="submit" className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full">
                {editingId ? '保存' : '提交'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 历史记录对话框 */}
      <Dialog open={historyDialogOpen} onOpenChange={(open) => {
        setHistoryDialogOpen(open)
        if (!open) setCurrentProject(null)
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              历史进展记录 - {currentProject?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {currentProject?.history && currentProject.history.length > 0 ? (
              currentProject.history.map((update: any) => (
                <Card key={update.id} className="rounded-2xl shadow-sm border-0">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-zinc-900">
                            {getMondayDisplay(update.week)} 周
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {new Date(update.created_at).toLocaleDateString('zh-CN')}
                          </Badge>
                        </div>
                        <p className="text-sm text-zinc-500 whitespace-pre-wrap">
                          {update.content}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteUpdate(update.id)}
                        >
                          <Trash2 className="w-4 h-4 text-rose-500" />
                        </Button>
                      </div>
                    </div>

                    {/* 只读的同步状态 */}
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        {update.contract_signed && (
                          <span className="px-2 py-1 bg-zinc-100 text-zinc-700 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            已签合同
                          </span>
                        )}
                        <span className="px-2 py-1 bg-zinc-100 text-zinc-700 rounded-full">
                          {update.settlement_total}段结算
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          验收: {update.settlement_accepted}/{update.settlement_total}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          开票: {update.settlement_invoiced}/{update.settlement_total}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          回款: {update.settlement_paid}/{update.settlement_total}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="rounded-2xl shadow-sm border-0 bg-white">
                <CardContent className="text-center py-8">
                  <p className="text-zinc-400">还没有历史记录</p>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 筛选器对话框 */}
      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent className="max-w-4xl rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">筛选条件</DialogTitle>
              <Button
                onClick={() => {
                  setFilterContractStatus([])
                  setFilterAcceptedStatus([])
                  setFilterInvoicedStatus([])
                  setFilterPaidStatus([])
                  setFilterBelongYear([])
                }}
                variant="ghost"
                size="sm"
                className="text-zinc-500 hover:text-zinc-700 mr-2"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                清空筛选
              </Button>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-5 gap-4">
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
          </div>

          <div className="flex justify-end mt-4">
            <Button
              onClick={() => setFilterDialogOpen(false)}
              className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full"
            >
              确定
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 任务创建对话框 */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">添加新任务</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-6">
            <div>
              <Label htmlFor="title" className="text-sm font-medium text-zinc-700">任务标题 *</Label>
              <Input
                id="title"
                value={taskFormData.title}
                onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                placeholder="例如：给客户发送报价单"
                className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
              />
            </div>
            <div>
              <Label htmlFor="project_id" className="text-sm font-medium text-zinc-700">关联项目 *</Label>
              <Select value={taskFormData.project_id} onValueChange={(value) => setTaskFormData({ ...taskFormData, project_id: value })}>
                <SelectTrigger className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400">
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project: any) => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description" className="text-sm font-medium text-zinc-700">任务描述</Label>
              <Textarea
                id="description"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                placeholder="任务的详细信息..."
                className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 resize-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority" className="text-sm font-medium text-zinc-700">优先级</Label>
                <Select value={taskFormData.priority} onValueChange={(value) => setTaskFormData({ ...taskFormData, priority: value })}>
                  <SelectTrigger className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400">
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
                <Label htmlFor="due_date" className="text-sm font-medium text-zinc-700">截止日期</Label>
                <Input
                  id="due_date"
                  type="datetime-local"
                  value={taskFormData.due_date}
                  onChange={(e) => setTaskFormData({ ...taskFormData, due_date: e.target.value })}
                  className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="status" className="text-sm font-medium text-zinc-700">任务状态</Label>
              <Select value={taskFormData.status} onValueChange={(value) => setTaskFormData({ ...taskFormData, status: value })}>
                <SelectTrigger className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="in_progress">进行中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button type="button" variant="outline" onClick={() => setTaskDialogOpen(false)} className="border-zinc-200 text-zinc-700 hover:bg-zinc-50">
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
