'use client'

import { useState, useEffect } from 'react'
import { getTasks, getProjects, createTask, updateTask, deleteTask } from '@/lib/supabase/queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2, Check, Pencil, Search, UserPlus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import type { Task, Project } from '@/types'
import { useTeamView } from '@/hooks/useTeamView'
import { AssignDialog } from '@/components/admin/AssignDialog'

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  const [isManager, setIsManager] = useState(false)
  const [dataScope, setDataScope] = useState<'own' | 'team'>('own')
  const [assignTarget, setAssignTarget] = useState<string | null>(null)
  const { viewMode, toggle } = useTeamView()
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    priority: 'medium',
    due_date: '',
    status: 'pending'
  })

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      setIsManager(d.role === 'super_admin' || d.role === 'sales_manager')
      setDataScope(d.dataScope ?? 'own')
    })

    // 检查是否需要自动打开任务创建对话框
    const shouldOpenDialog = sessionStorage.getItem('openTaskDialog')
    if (shouldOpenDialog === 'true') {
      setDialogOpen(true)
      sessionStorage.removeItem('openTaskDialog')
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [viewMode])

  const loadData = async () => {
    try {
      const [tasksData, projectsData] = await Promise.all([
        getTasks({ teamView: viewMode === 'team' }),
        getProjects()
      ])
      setTasks(tasksData)
      // 过滤掉回款已完成的项目
      const filteredProjects = projectsData.filter(project => {
        const paidCount = project.settlement_summary?.paid || 0
        const totalCount = project.settlement_stages || 1
        // 如果回款数量等于总段数，则排除该项目
        return !(paidCount === totalCount && totalCount > 0)
      })
      setProjects(filteredProjects)
    } catch (error: any) {
      toast.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      project_id: '',
      priority: 'medium',
      due_date: '',
      status: 'pending'
    })
    setEditingId(null)
  }

  const handleEdit = (task: Task) => {
    // 将 UTC 时间转换为本地时间格式用于输入框
    let localDueDate = ''
    if (task.due_date) {
      const date = new Date(task.due_date)
      // 获取本地时间的年月日时分
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      localDueDate = `${year}-${month}-${day}T${hours}:${minutes}`
    }

    setFormData({
      title: task.title,
      description: task.description || '',
      project_id: task.project_id || '',
      priority: task.priority,
      due_date: localDueDate,
      status: task.status
    })
    setEditingId(task.id)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title) {
      toast.error('请填写任务标题')
      return
    }

    if (!formData.project_id) {
      toast.error('请选择项目')
      return
    }

    try {
      if (editingId) {
        await updateTask(editingId, {
          title: formData.title,
          description: formData.description || null,
          project_id: formData.project_id,
          priority: formData.priority as any,
          due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
          status: formData.status as any
        })
        toast.success('任务更新成功')

        // 重新加载任务数据以获取完整的关联信息
        await loadData()
      } else {
        await createTask({
          title: formData.title,
          description: formData.description || null,
          project_id: formData.project_id,
          priority: formData.priority as any,
          due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
          status: formData.status as any
        })
        toast.success('任务创建成功')
        await loadData()
      }

      setDialogOpen(false)
      resetForm()
    } catch (error: any) {
      toast.error(error.message || '操作失败')
    }
  }

  const handleToggleComplete = async (task: Task) => {
    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed'
      await updateTask(task.id, {
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null
      })
      toast.success('任务状态已更新')

      // 直接更新本地状态，立即反映排序变化
      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.id === task.id
            ? { ...t, status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }
            : t
        )
      )
    } catch (error: any) {
      toast.error(error.message || '更新任务失败')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个任务吗？')) {
      return
    }

    try {
      await deleteTask(id)
      toast.success('任务删除成功')

      // 直接更新本地状态，避免页面跳转
      setTasks(prevTasks => prevTasks.filter(t => t.id !== id))
    } catch (error: any) {
      toast.error(error.message || '删除任务失败')
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-rose-100 text-rose-700 border-rose-200'
      case 'high': return 'bg-orange-200 text-orange-800 border-orange-300'
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      default: return 'bg-zinc-100 text-zinc-700 border-zinc-200'
    }
  }

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'urgent': return '紧急'
      case 'high': return '高'
      case 'medium': return '中'
      case 'low': return '低'
      default: return priority
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待处理'
      case 'in_progress': return '进行中'
      case 'completed': return '已完成'
      case 'cancelled': return '已取消'
      default: return status
    }
  }

  const isOverdue = (task: Task) => {
    return task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'
  }

  const filteredTasks = tasks.filter(task => {
    // 状态筛选
    if (filterStatus !== 'all' && task.status !== filterStatus) return false

    // 搜索筛选：按项目名或客户名
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase()
      const projectName = (task as any).projects?.name?.toLowerCase() || ''
      const customerName = (task as any).projects?.customers?.name?.toLowerCase() || ''

      if (!projectName.includes(keyword) && !customerName.includes(keyword)) {
        return false
      }
    }

    return true
  })

  // 排序任务：已完成的任务排在最后，未完成的按截止日期和优先级排序
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // 已完成的任务排在最后
    if (a.status === 'completed' && b.status !== 'completed') return 1
    if (a.status !== 'completed' && b.status === 'completed') return -1

    // 如果都已完成或都未完成，按截止日期排序
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    }
    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1

    // 如果都没有截止日期，按优先级排序
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
    return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]
  })

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-20 text-zinc-400 text-sm">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">任务管理</h1>
          <p className="mt-2 text-zinc-500 text-sm">管理您的所有待办任务</p>
        </div>
        <div className="flex gap-2">
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
              className="w-48 h-9 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 h-9 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="pending">待处理</SelectItem>
              <SelectItem value="in_progress">进行中</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button disabled={projects.length === 0} className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                添加任务
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl shadow-xl border-0">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">{editingId ? '编辑任务' : '添加新任务'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {editingId && (() => {
                  const currentTask = tasks.find(t => t.id === editingId) as any
                  const customerName = currentTask?.projects?.customers?.name
                  return customerName ? (
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3">
                      <p className="text-sm text-zinc-700">
                        <span className="font-medium">当前关联客户：</span>{customerName}
                      </p>
                    </div>
                  ) : null
                })()}
                <div>
                  <Label htmlFor="title" className="text-sm font-medium text-zinc-700">任务标题 *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="例如：给客户发送报价单"
                    className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                </div>
                <SearchableSelect
                  value={formData.project_id}
                  onChange={(value) => setFormData({ ...formData, project_id: value })}
                  options={projects}
                  placeholder="搜索并选择项目"
                  label="关联项目"
                  required
                />
                <div>
                  <Label htmlFor="description" className="text-sm font-medium text-zinc-700">任务描述</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="任务的详细信息..."
                    className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority" className="text-sm font-medium text-zinc-700">优先级</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
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
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="status" className="text-sm font-medium text-zinc-700">任务状态</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
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
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                    取消
                  </Button>
                  <Button type="submit" className="bg-zinc-900 text-white hover:bg-zinc-800">{editingId ? '保存' : '创建'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 表格 */}
      <Card className="rounded-2xl shadow-sm border-0 bg-white">
        <CardContent className="p-0">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-zinc-400 mb-4">
                {projects.length === 0 ? '请先创建项目' : '还没有任务'}
              </p>
              {projects.length > 0 && (
                <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800">
                  <Plus className="w-4 h-4 mr-2" />
                  创建第一个任务
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white border-b border-zinc-200 rounded-t-2xl">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-10 rounded-tl-2xl">状态</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-64">任务标题</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase" style={{ width: '260px' }}>项目</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-20">优先级</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-36">截止日期</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-32 whitespace-nowrap">任务状态</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-24 whitespace-nowrap rounded-tr-2xl"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {sortedTasks.map((task: any) => (
                    <tr
                      key={task.id}
                      className={`hover:bg-zinc-50 transition-colors ${
                        task.status === 'completed' ? 'opacity-40 bg-zinc-50' : ''
                      } ${isOverdue(task) ? 'bg-red-50/50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleComplete(task)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                            task.status === 'completed'
                              ? 'bg-zinc-900 border-zinc-900 text-white'
                              : 'border-zinc-300 hover:border-zinc-900'
                          }`}
                        >
                          {task.status === 'completed' && <Check className="w-3 h-3" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">
                              {task.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start justify-start">
                          <div className="flex items-center gap-2 mb-1">
                            {(task.projects as any)?.belong_year && (
                              <span className="text-xs text-zinc-500 font-medium">{(task.projects as any).belong_year}年</span>
                            )}
                            {(task.projects as any)?.value && (
                              <span className="text-xs text-zinc-500">¥{(task.projects as any).value.toLocaleString()}</span>
                            )}
                          </div>
                          <div className="text-sm text-zinc-600 truncate max-w-[260px]">
                            {task.projects?.name}
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
                            {new Date(task.due_date).toLocaleDateString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {isOverdue(task) && <span className="ml-1">(已过期)</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs ${
                          task.status === 'completed' ? 'text-zinc-900' :
                          task.status === 'in_progress' ? 'text-zinc-700' :
                          task.status === 'cancelled' ? 'text-zinc-400' :
                          'text-zinc-600'
                        }`}>
                          {getStatusText(task.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-start gap-1">
                          {isManager && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setAssignTarget(task.id)}
                              className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                              title="分派"
                            >
                              <UserPlus className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(task)}
                            className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(task.id)}
                            className="h-8 w-8 hover:bg-red-50 text-zinc-400 hover:text-rose-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分派对话框 */}
      <AssignDialog
        open={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        resourceType="task"
        resourceId={assignTarget ?? ''}
        onSuccess={loadData}
      />
    </div>
  )
}
