'use client'

import { useState, useEffect, useRef } from 'react'
import { getTasks, getProjects, getProjectsForTaskSelect, createTask, deleteTask, shareTask, unshareTask, cleanupOldCompletedTasks, getProjectWeeklyUpdates, createWeeklyUpdate, updateWeeklyUpdate } from '@/lib/supabase/queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Share2, RotateCcw, Plus, Trash2, Check, Pencil, Search, Calendar, FileText } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import type { Task, Project } from '@/types'
import { useTasks } from '@/context/TasksContext'
import { useUser, useTeamMembers } from '@/context/UserContext'
import { PageLoading } from '@/components/ui/page-loading'

const NO_PROJECT_ID = '__no_project__'
type ViewMode = 'mine' | 'shared'
interface TeamMember { user_id: string; email: string; name?: string }

export default function TasksPage() {
  const { refresh: refreshTasks } = useTasks()
  const [tasks, setTasks] = useState<any[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)
  const initialized = useRef(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('mine')
  const me = useUser()
  const currentUserId = me?.userId ?? ''
  const { members: teamMembers, ensureMembers } = useTeamMembers()
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareTaskId, setShareTaskId] = useState<string | null>(null)
  const [shareToUserId, setShareToUserId] = useState('')
  const [shareType, setShareType] = useState<'assign' | 'sync'>('sync')
  const [formData, setFormData] = useState({
    title: '', description: '', project_id: '', priority: 'medium', due_date: ''
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
    if (!project?.id) return
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
      if (updateEditingId) {
        await updateWeeklyUpdate(updateEditingId, { content: updateContent })
        toast.success('进展更新成功')
      } else {
        await createWeeklyUpdate({
          project_id: updateProject.id,
          week: currentWeek,
          content: updateContent,
          contract_signed: updateProject.contract_signed || false,
          settlement_accepted: 0,
          settlement_invoiced: 0,
          settlement_paid: 0,
          settlement_total: 1
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

  useEffect(() => {
    // me 来自 UserContext；团队成员按需懒加载（共享 cache）
    ensureMembers()

    if (sessionStorage.getItem('openTaskDialog') === 'true') {
      setDialogOpen(true)
      sessionStorage.removeItem('openTaskDialog')
    }

    // 项目列表只加载一次
    getProjectsForTaskSelect().then(data => {
      setProjects(data.filter(p => {
        const paid = p.settlement_summary?.paid || 0
        const total = p.settlement_summary?.total || 1
        return !(paid === total && total > 0)
      }) as any[])
    }).catch(() => {})

    // 清理 14 天前已完成的任务（每天最多一次）；推迟到浏览器空闲时机，不与首屏请求竞争
    const today = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem('tasks_cleanup_date') !== today) {
      const runCleanup = () => {
        cleanupOldCompletedTasks()
          .then(() => localStorage.setItem('tasks_cleanup_date', today))
          .catch(() => {})
      }
      const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined
      if (ric) ric(runCleanup, { timeout: 4000 })
      else setTimeout(runCleanup, 2000)
    }
  }, [])

  useEffect(() => { loadData() }, [viewMode])

  const loadData = async () => {
    if (!initialized.current) {
      setLoading(true)
    } else {
      setTableLoading(true)
    }
    try {
      const tasksData = await getTasks({ mode: viewMode })
      setTasks(tasksData)
    } catch { toast.error('加载数据失败') }
    finally {
      setLoading(false)
      setTableLoading(false)
      initialized.current = true
    }
  }

  const resetForm = () => {
    setFormData({ title: '', description: '', project_id: '', priority: 'medium', due_date: '' })
    setEditingId(null)
  }

  const handleEdit = (task: Task) => {
    let localDueDate = ''
    if (task.due_date) {
      const d = new Date(task.due_date)
      localDueDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    }
    setFormData({ title: task.title, description: task.description || '', project_id: task.project_id || NO_PROJECT_ID, priority: task.priority, due_date: localDueDate })
    setEditingId(task.id)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title) { toast.error('请填写任务标题'); return }
    if (!formData.project_id) { toast.error('请选择项目'); return }
    try {
      const basePayload = {
        title: formData.title,
        description: formData.description || null,
        project_id: formData.project_id === NO_PROJECT_ID ? undefined : formData.project_id,
        priority: formData.priority as any,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
      }
      if (editingId) {
        const res = await fetch(`/api/tasks/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(basePayload) })
        if (!res.ok) throw new Error((await res.json()).error)
        setTasks(prev => prev.map(t => t.id === editingId ? { ...t, ...basePayload } : t))
        toast.success('任务更新成功')
      } else {
        await createTask({ ...basePayload, status: 'pending' } as any)
        loadData()
        toast.success('任务创建成功')
      }
      setDialogOpen(false)
      resetForm()
    } catch (error: any) { toast.error(error.message || '操作失败') }
  }

  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    const newCompletedAt = newStatus === 'completed' ? new Date().toISOString() : null
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus, completed_at: newCompletedAt } : t))
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, completed_at: newCompletedAt }),
      })
      if (!res.ok) {
        const text = await res.text()
        let msg = '更新任务失败'
        try { msg = JSON.parse(text).error || msg } catch {}
        throw new Error(msg)
      }
      toast.success('任务状态已更新')
    } catch (err: any) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t))
      toast.error(err?.message || '更新任务失败')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个任务吗？')) return
    const deleted = tasks.find(t => t.id === id)
    setTasks(prev => prev.filter(t => t.id !== id))
    try {
      await deleteTask(id)
      toast.success('任务删除成功')
    } catch (error: any) {
      if (deleted) setTasks(prev => [...prev, deleted])
      toast.error(error.message || '删除任务失败')
    }
  }

  const handleShare = async () => {
    if (!shareTaskId || !shareToUserId) { toast.error('请选择团队成员'); return }
    try {
      await shareTask(shareTaskId, shareToUserId, shareType)
      toast.success(shareType === 'assign' ? '任务已指派' : '任务已同步')
      setShareDialogOpen(false); setShareTaskId(null); setShareToUserId(''); setShareType('sync')
      loadData()
    } catch (error: any) { toast.error(error.message || '操作失败') }
  }

  const handleUnshare = async (task: any) => {
    if (!task._shareWithUserId) return
    try {
      await unshareTask(task.id, task._shareWithUserId)
      toast.success('已撤回')
      loadData()
    } catch (error: any) { toast.error(error.message || '撤回失败') }
  }

  const getPriorityColor = (p: string) => {
    if (p === 'urgent') return 'bg-rose-100 text-rose-700 border-rose-200'
    if (p === 'high') return 'bg-orange-200 text-orange-800 border-orange-300'
    if (p === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    if (p === 'low') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    return 'bg-zinc-100 text-zinc-700 border-zinc-200'
  }
  const getPriorityText = (p: string) => ({ urgent: '急', high: '高', medium: '中', low: '低' }[p] ?? p)
  const isOverdue = (task: any) => task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'

  const getShareLabel = (task: any) => {
    if (task._shareDirection === 'out' && task._shareType === 'assign') return { text: '已指派', cls: 'bg-blue-100 text-blue-700 border-blue-200' }
    if (task._shareDirection === 'out' && task._shareType === 'sync') return { text: '已同步', cls: 'bg-green-100 text-green-700 border-green-200' }
    if (task._shareDirection === 'in' && task._shareType === 'assign') return { text: '被指派', cls: 'bg-orange-100 text-orange-700 border-orange-200' }
    if (task._shareDirection === 'in' && task._shareType === 'sync') return { text: '被同步', cls: 'bg-purple-100 text-purple-700 border-purple-200' }
    return null
  }

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const filteredTasks = tasks.filter(task => {
    if (task.status === 'completed') {
      if (!task.completed_at) return false
      if (new Date(task.completed_at) < fourteenDaysAgo) return false
    }
    if (filterStatus === 'pending' && task.status === 'completed') return false
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase()
      const pn = task.projects?.name?.toLowerCase() || ''
      const cn = task.projects?.customers?.name?.toLowerCase() || ''
      if (!pn.includes(kw) && !cn.includes(kw)) return false
    }
    return true
  })

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // 已完成排在已完成内部、未完成排在前面
    if (a.status === 'completed' && b.status !== 'completed') return 1
    if (a.status !== 'completed' && b.status === 'completed') return -1
    // 都已完成：按完成时间从晚到早
    if (a.status === 'completed' && b.status === 'completed') {
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0
      return bTime - aTime
    }
    // 都未完成：按截止时间从早到晚
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    if (a.due_date) return -1
    if (b.due_date) return 1
    const po = { urgent: 0, high: 1, medium: 2, low: 3 }
    return (po[a.priority as keyof typeof po] ?? 4) - (po[b.priority as keyof typeof po] ?? 4)
  })

  const otherMembers = teamMembers.filter(m => m.user_id !== currentUserId)

  if (loading) {
    return <PageLoading variant="list" />
  }

  return (
    <div className="p-8">
      {/* 标题行 */}
      <div className="flex items-end justify-between mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">任务管理</h1>
            <p className="mt-2 text-zinc-500 text-sm">管理您的所有待办任务</p>
          </div>
        </div>
        <div className="flex gap-3 items-center flex-wrap -translate-y-1">
          {/* 搜索 */}
          <div className="relative flex items-center h-9">
            <Search className="w-4 h-4 text-zinc-400 absolute left-4 pointer-events-none" />
            <Input
              placeholder="搜索项目或客户..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              className="h-9 w-56 pl-10 pr-4 rounded-full bg-transparent border-zinc-200 focus:border-zinc-300 placeholder:text-zinc-400 text-sm"
            />
          </div>

          {/* 分段控件组：状态 + 视图 */}
          <div className="inline-flex items-center bg-zinc-100 rounded-full p-1 h-9 whitespace-nowrap shadow-sm">
            <button
              onClick={() => setFilterStatus('all')}
              className={`h-7 px-4 text-xs font-medium rounded-full transition-all duration-200 ${filterStatus === 'all' ? 'bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'text-zinc-500 hover:text-zinc-800'}`}
            >
              全部
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`h-7 px-4 text-xs font-medium rounded-full transition-all duration-200 ${filterStatus === 'pending' ? 'bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'text-zinc-500 hover:text-zinc-800'}`}
            >
              未完成
            </button>
            <span className="mx-1.5 w-px h-4 bg-zinc-300/70" aria-hidden />
            <button
              onClick={() => setViewMode('mine')}
              className={`h-7 px-4 text-xs font-medium rounded-full transition-all duration-200 ${viewMode === 'mine' ? 'bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'text-zinc-500 hover:text-zinc-800'}`}
            >
              只看我的
            </button>
            <button
              onClick={() => setViewMode('shared')}
              className={`h-7 px-4 text-xs font-medium rounded-full transition-all duration-200 ${viewMode === 'shared' ? 'bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'text-zinc-500 hover:text-zinc-800'}`}
            >
              共享任务
            </button>
          </div>

          <Button onClick={() => { if (projects.length === 0) { toast.error('请先创建项目'); return } setDialogOpen(true) }} className="h-9 shadow-sm">
            <Plus className="w-4 h-4 mr-2 shrink-0" />添加任务
          </Button>
        </div>
      </div>

      {/* 新建/编辑任务对话框（始终渲染，支持共享视图中编辑） */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-[32rem] rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{editingId ? '编辑任务' : '添加新任务'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="title" className="text-sm font-medium text-zinc-700">任务标题 *</Label>
              <Input id="title" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="例如：给客户发送报价单" className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400" />
            </div>
            <SearchableSelect
              value={formData.project_id}
              onChange={value => setFormData({ ...formData, project_id: value })}
              options={[{ id: NO_PROJECT_ID, name: '非项目任务' }, ...projects.map(p => ({ id: p.id, name: p.name, belong_year: (p as any).belong_year ?? undefined, value: (p as any).value ?? undefined }))]}
              placeholder="搜索并选择项目" label="关联项目" required
            />
            <div>
              <Label htmlFor="description" className="text-sm font-medium text-zinc-700">任务描述</Label>
              <Textarea id="description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="任务的详细信息..." rows={3} className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 resize-none" />
            </div>
            <div className="grid grid-cols-[7rem_1fr] gap-4">
              <div>
                <Label className="text-sm font-medium text-zinc-700">优先级</Label>
                <Select value={formData.priority} onValueChange={v => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem><SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem><SelectItem value="urgent">紧急</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="due_date" className="text-sm font-medium text-zinc-700">截止日期</Label>
                <div className="relative mt-2">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  <Input id="due_date" type="datetime-local" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} className="pl-9 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button type="button" variant="cancel" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button type="submit">{editingId ? '保存' : '创建'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 表格 */}
      <Card className="rounded-2xl shadow-sm border-0 bg-white overflow-hidden">
        <CardContent className="p-0">
          {tableLoading ? (
            <div className="flex items-center justify-center h-40 text-zinc-400 text-sm">加载中...</div>
          ) : sortedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40">
              <p className="text-zinc-400 mb-4">
                {viewMode === 'mine' && projects.length === 0 ? '请先创建项目' : '暂无任务'}
              </p>
              {projects.length > 0 && (
                <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800">
                  <Plus className="w-4 h-4 mr-2" />创建第一个任务
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead className="bg-white border-b border-zinc-200 rounded-t-2xl">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-10 whitespace-nowrap rounded-tl-2xl">状态</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-[240px] whitespace-nowrap">任务标题</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-[220px] whitespace-nowrap">关联项目</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-20 whitespace-nowrap">优先级</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-28 whitespace-nowrap">截止日期</th>
                    <th className="px-4 py-4 text-right text-xs font-medium text-zinc-500 uppercase w-[172px] whitespace-nowrap rounded-tr-2xl"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map((task: any) => {
                    const shareLabel = getShareLabel(task)
                    return (
                      <tr
                        key={task.id}
                        className={`border-b border-zinc-100 last:border-b-0 transition-colors ${task.status === 'completed' ? 'opacity-40 bg-zinc-50 hover:bg-zinc-100' : ''} ${isOverdue(task) ? 'bg-red-50/50 hover:bg-red-100/60' : 'hover:bg-zinc-50'}`}
                      >
                        <td className="px-4 py-3">
                          {(viewMode === 'mine' || (task._shareDirection === 'in' && task._shareType === 'assign') || (task._shareDirection === 'out' && task._shareType === 'sync')) ? (
                            <Checkbox
                              checked={task.status === 'completed'}
                              onCheckedChange={() => handleToggleComplete(task)}
                            />
                          ) : (
                            <Checkbox
                              checked={task.status === 'completed'}
                              disabled
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-sm font-medium truncate ${task.status === 'completed' ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
                                {task.title}
                              </span>
                              {shareLabel && (
                                <Badge className={`text-[11px] border px-1.5 py-0 h-4 shrink-0 ${shareLabel.cls}`}>{shareLabel.text}</Badge>
                              )}
                            </div>
                            {task.description && (
                              <div className="text-xs text-zinc-500 mt-0.5 truncate">{task.description}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-start justify-start">
                            <div className="flex items-center gap-2 mb-1">
                              {task.projects?.belong_year && (
                                <span className="text-xs text-zinc-500 font-medium">{task.projects.belong_year}年</span>
                              )}
                              {task.projects?.value && (
                                <span className="text-xs text-zinc-500">¥{task.projects.value.toLocaleString()}</span>
                              )}
                            </div>
                            <span className="font-medium text-sm text-zinc-500 truncate">{task.projects?.name ?? '非项目任务'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs border ${getPriorityColor(task.priority)}`}>
                            {getPriorityText(task.priority)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {task.due_date ? (
                            <div className={`text-xs whitespace-nowrap ${isOverdue(task) ? 'text-rose-600 font-medium' : 'text-zinc-600'}`}>
                              {new Date(task.due_date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              {isOverdue(task) && <span className="ml-1">(已过期)</span>}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {viewMode === 'mine' && !task._shareDirection && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(task)} className="text-zinc-600 hover:text-zinc-900" title="编辑">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { setShareTaskId(task.id); setShareDialogOpen(true) }} className="text-zinc-600 hover:text-zinc-900" title="同步给别人">
                                  <Share2 className="w-4 h-4" />
                                </Button>
                                {task.projects?.id && (
                                  <Button variant="ghost" size="icon" onClick={() => handleOpenUpdate(task.projects)} className="text-zinc-600 hover:text-zinc-900" title="编辑进展">
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(task.id)} className="hover:bg-red-50 text-zinc-400 hover:text-rose-500" title="删除">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {viewMode === 'mine' && task._shareDirection === 'in' && (
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(task)} className="text-zinc-600 hover:text-zinc-900" title="编辑">
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            {viewMode === 'shared' && task._shareDirection === 'out' && task._shareType === 'assign' && (
                              <Button variant="ghost" size="icon" onClick={() => handleUnshare(task)} className="text-zinc-600 hover:text-zinc-900" title="撤回">
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            )}
                            {viewMode === 'shared' && task._shareDirection === 'out' && task._shareType === 'sync' && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(task)} className="text-zinc-600 hover:text-zinc-900" title="编辑">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleUnshare(task)} className="text-zinc-600 hover:text-zinc-900" title="撤回">
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {viewMode === 'shared' && task._shareDirection === 'in' && task._shareType === 'assign' && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(task)} className="text-zinc-600 hover:text-zinc-900" title="编辑">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleToggleComplete(task)} className="text-zinc-600 hover:text-zinc-900" title="完成">
                                  <Check className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {/* in + sync: 只读，无按钮 */}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* 共享对话框 */}
      <Dialog open={shareDialogOpen} onOpenChange={open => { setShareDialogOpen(open); if (!open) { setShareTaskId(null); setShareToUserId(''); setShareType('sync') } }}>
        <DialogContent className="rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">同步给团队成员</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm font-medium text-zinc-700">选择成员</Label>
              <Select value={shareToUserId} onValueChange={setShareToUserId}>
                <SelectTrigger className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400">
                  <SelectValue placeholder="请选择团队成员" />
                </SelectTrigger>
                <SelectContent>
                  {otherMembers.length === 0 ? (
                    <SelectItem value="__none__" disabled>暂无其他成员</SelectItem>
                  ) : (
                    otherMembers.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.name || m.email}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium text-zinc-700">共享类型</Label>
              <Select value={shareType} onValueChange={v => setShareType(v as 'assign' | 'sync')}>
                <SelectTrigger className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assign">指派（对方负责完成）</SelectItem>
                  <SelectItem value="sync">同步（仅共享查看）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button type="button" variant="cancel" onClick={() => setShareDialogOpen(false)}>取消</Button>
              <Button onClick={handleShare}>确认</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
