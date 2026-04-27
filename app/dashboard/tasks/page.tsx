'use client'

import { useState, useEffect, useRef } from 'react'
import { getTasks, getProjects, createTask, deleteTask, shareTask, unshareTask } from '@/lib/supabase/queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Share2, RotateCcw, Plus, Trash2, Check, Pencil, Search } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import type { Task, Project } from '@/types'
import { useTasks } from '@/context/TasksContext'

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
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareTaskId, setShareTaskId] = useState<string | null>(null)
  const [shareToUserId, setShareToUserId] = useState('')
  const [shareType, setShareType] = useState<'assign' | 'sync'>('sync')
  const [formData, setFormData] = useState({
    title: '', description: '', project_id: '', priority: 'medium', due_date: '', status: 'pending'
  })

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => setCurrentUserId(d.userId ?? '')).catch(() => {})
    fetch('/api/admin/users').then(r => r.json()).then(d => { if (Array.isArray(d)) setTeamMembers(d) }).catch(() => {})
    if (sessionStorage.getItem('openTaskDialog') === 'true') {
      setDialogOpen(true)
      sessionStorage.removeItem('openTaskDialog')
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
      const [tasksData, projectsData] = await Promise.all([getTasks({ mode: viewMode }), getProjects()])
      setTasks(tasksData)
      setProjects((projectsData as any[]).filter(p => {
        const paid = p.settlement_summary?.paid || 0
        const total = p.settlement_stages || 1
        return !(paid === total && total > 0)
      }))
    } catch { toast.error('加载数据失败') }
    finally {
      setLoading(false)
      setTableLoading(false)
      initialized.current = true
    }
  }

  const resetForm = () => {
    setFormData({ title: '', description: '', project_id: '', priority: 'medium', due_date: '', status: 'pending' })
    setEditingId(null)
  }

  const handleEdit = (task: Task) => {
    let localDueDate = ''
    if (task.due_date) {
      const d = new Date(task.due_date)
      localDueDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    }
    setFormData({ title: task.title, description: task.description || '', project_id: task.project_id || NO_PROJECT_ID, priority: task.priority, due_date: localDueDate, status: task.status })
    setEditingId(task.id)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title) { toast.error('请填写任务标题'); return }
    if (!formData.project_id) { toast.error('请选择项目'); return }
    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        project_id: formData.project_id === NO_PROJECT_ID ? undefined : formData.project_id,
        priority: formData.priority as any,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
        status: formData.status as any
      }
      if (editingId) {
        const res = await fetch(`/api/tasks/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success('任务更新成功')
      } else { await createTask(payload as any); toast.success('任务创建成功') }
      window.dispatchEvent(new Event('refresh-bell'))
      refreshTasks()
      setDialogOpen(false)
      resetForm()
      loadData()
    } catch (error: any) { toast.error(error.message || '操作失败') }
  }

  const handleToggleComplete = async (task: Task) => {
    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed'
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('任务状态已更新')
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
      refreshTasks()
      window.dispatchEvent(new Event('refresh-bell'))
    } catch (error: any) { toast.error(error.message || '更新任务失败') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个任务吗？')) return
    try {
      await deleteTask(id)
      toast.success('任务删除成功')
      setTasks(prev => prev.filter(t => t.id !== id))
      refreshTasks()
      window.dispatchEvent(new Event('refresh-bell'))
    } catch (error: any) { toast.error(error.message || '删除任务失败') }
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
  const getPriorityText = (p: string) => ({ urgent: '紧急', high: '高', medium: '中', low: '低' }[p] ?? p)
  const getStatusText = (s: string) => ({ pending: '待处理', in_progress: '进行中', completed: '已完成', cancelled: '已取消' }[s] ?? s)
  const isOverdue = (task: any) => task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'

  const getShareLabel = (task: any) => {
    if (task._shareDirection === 'out' && task._shareType === 'assign') return { text: '已指派', cls: 'bg-blue-100 text-blue-700 border-blue-200' }
    if (task._shareDirection === 'out' && task._shareType === 'sync') return { text: '已同步', cls: 'bg-green-100 text-green-700 border-green-200' }
    if (task._shareDirection === 'in' && task._shareType === 'assign') return { text: '被指派', cls: 'bg-orange-100 text-orange-700 border-orange-200' }
    if (task._shareDirection === 'in' && task._shareType === 'sync') return { text: '同步给我', cls: 'bg-purple-100 text-purple-700 border-purple-200' }
    return null
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const filteredTasks = tasks.filter(task => {
    if (task.status === 'completed') {
      if (!task.completed_at) return false
      if (new Date(task.completed_at) < thirtyDaysAgo) return false
    }
    if (filterStatus !== 'all' && task.status !== filterStatus) return false
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase()
      const pn = task.projects?.name?.toLowerCase() || ''
      const cn = task.projects?.customers?.name?.toLowerCase() || ''
      if (!pn.includes(kw) && !cn.includes(kw)) return false
    }
    return true
  })

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1
    if (a.status !== 'completed' && b.status === 'completed') return -1
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    if (a.due_date) return -1
    if (b.due_date) return 1
    const po = { urgent: 0, high: 1, medium: 2, low: 3 }
    return (po[a.priority as keyof typeof po] ?? 4) - (po[b.priority as keyof typeof po] ?? 4)
  })

  const otherMembers = teamMembers.filter(m => m.user_id !== currentUserId)

  if (loading) {
    return <div className="p-8"><div className="text-center py-20 text-zinc-400 text-sm">加载中...</div></div>
  }

  return (
    <div className="p-8">
      {/* 标题行 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">任务管理</h1>
          <p className="mt-2 text-zinc-500 text-sm">管理您的所有待办任务</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={() => setViewMode(viewMode === 'mine' ? 'shared' : 'mine')}
            className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors px-3 py-1.5 rounded-full border border-zinc-200 hover:border-zinc-400"
          >
            {viewMode === 'mine' ? '共享任务' : '只看我的'}
          </button>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-zinc-400" />
            <Input placeholder="搜索项目或客户..." value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} className="w-48 h-9 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 h-9 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="pending">待处理</SelectItem>
              <SelectItem value="in_progress">进行中</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
            </SelectContent>
          </Select>
          <Button disabled={projects.length === 0} onClick={() => setDialogOpen(true)} className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full shadow-sm">
            <Plus className="w-4 h-4 mr-2" />添加任务
          </Button>
        </div>
      </div>

      {/* 新建/编辑任务对话框（始终渲染，支持共享视图中编辑） */}
      <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm() }}>
        <DialogContent className="rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">{editingId ? '编辑任务' : '添加新任务'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {editingId && (() => {
              const ct = tasks.find(t => t.id === editingId) as any
              const cn = ct?.projects?.customers?.name
              return cn ? (
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3">
                  <p className="text-sm text-zinc-700"><span className="font-medium">当前关联客户：</span>{cn}</p>
                </div>
              ) : null
            })()}
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
              <Textarea id="description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="任务的详细信息..." className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                <Input id="due_date" type="datetime-local" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-zinc-700">任务状态</Label>
              <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                <SelectTrigger className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">待处理</SelectItem><SelectItem value="in_progress">进行中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem><SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-zinc-200 text-zinc-700 hover:bg-zinc-50">取消</Button>
              <Button type="submit" className="bg-zinc-900 text-white hover:bg-zinc-800">{editingId ? '保存' : '创建'}</Button>
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
              <table className="w-full">
                <thead className="bg-white border-b border-zinc-200 rounded-t-2xl">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-16 whitespace-nowrap rounded-tl-2xl">状态</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-64 whitespace-nowrap">任务标题</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase whitespace-nowrap" style={{ width: '260px' }}>项目</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-20 whitespace-nowrap">优先级</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-36 whitespace-nowrap">截止日期</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-32 whitespace-nowrap">任务状态</th>
                    {viewMode === 'shared' && (
                      <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-24 whitespace-nowrap">类型</th>
                    )}
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-24 whitespace-nowrap rounded-tr-2xl"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map((task: any) => {
                    const shareLabel = getShareLabel(task)
                    return (
                      <tr
                        key={task.id}
                        className={`border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 transition-colors ${task.status === 'completed' ? 'opacity-40 bg-zinc-50' : ''} ${isOverdue(task) ? 'bg-red-50/50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          {(viewMode === 'mine' || (task._shareDirection === 'in' && task._shareType === 'assign') || (task._shareDirection === 'out' && task._shareType === 'sync')) ? (
                            <button
                              onClick={() => handleToggleComplete(task)}
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${task.status === 'completed' ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-300 hover:border-zinc-900'}`}
                            >
                              {task.status === 'completed' && <Check className="w-3 h-3" />}
                            </button>
                          ) : (
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${task.status === 'completed' ? 'bg-zinc-900 border-zinc-900 text-white' : 'border-zinc-200'}`}>
                              {task.status === 'completed' && <Check className="w-3 h-3" />}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <div className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
                              {task.title}
                            </div>
                            {task.description && (
                              <div className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">{task.description}</div>
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
                            <div className="text-sm text-zinc-600 truncate max-w-[260px]">
                              {task.projects?.name ?? '非项目任务'}
                            </div>
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-xs ${task.status === 'completed' ? 'text-zinc-900' : task.status === 'in_progress' ? 'text-zinc-700' : task.status === 'cancelled' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            {getStatusText(task.status)}
                          </span>
                        </td>
                        {viewMode === 'shared' && (
                          <td className="px-4 py-3">
                            {shareLabel && (
                              <Badge className={`text-xs border ${shareLabel.cls}`}>{shareLabel.text}</Badge>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex justify-start gap-1">
                            {viewMode === 'mine' && !task._shareDirection && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(task)} className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900" title="编辑">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { setShareTaskId(task.id); setShareDialogOpen(true) }} className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900" title="同步给别人">
                                  <Share2 className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(task.id)} className="h-8 w-8 hover:bg-red-50 text-zinc-400 hover:text-rose-500" title="删除">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {viewMode === 'mine' && task._shareDirection === 'in' && (
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(task)} className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900" title="编辑">
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            {viewMode === 'shared' && task._shareDirection === 'out' && task._shareType === 'assign' && (
                              <Button variant="ghost" size="icon" onClick={() => handleUnshare(task)} className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900" title="撤回">
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            )}
                            {viewMode === 'shared' && task._shareDirection === 'out' && task._shareType === 'sync' && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(task)} className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900" title="编辑">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleUnshare(task)} className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900" title="撤回">
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {viewMode === 'shared' && task._shareDirection === 'in' && task._shareType === 'assign' && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(task)} className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900" title="编辑">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleToggleComplete(task)} className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900" title="完成">
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
              <Button type="button" variant="outline" onClick={() => setShareDialogOpen(false)} className="border-zinc-200 text-zinc-700 hover:bg-zinc-50">取消</Button>
              <Button onClick={handleShare} className="bg-zinc-900 text-white hover:bg-zinc-800">确认</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
