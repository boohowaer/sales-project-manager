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
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2, Check, Pencil } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Badge } from '@/components/ui/badge'
import type { Task, Project } from '@/types'

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    priority: 'medium',
    due_date: '',
    status: 'pending'
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [tasksData, projectsData] = await Promise.all([
        getTasks(),
        getProjects()
      ])
      setTasks(tasksData)
      setProjects(projectsData)
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
    setSelectedProjectIds([])
    setEditingId(null)
  }

  const handleEdit = (task: Task) => {
    setFormData({
      title: task.title,
      description: task.description || '',
      project_id: task.project_id || '',
      priority: task.priority,
      due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '',
      status: task.status
    })
    setSelectedProjectIds(task.project_id ? [task.project_id] : [])
    setEditingId(task.id)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title) {
      toast.error('请填写任务标题')
      return
    }

    if (selectedProjectIds.length === 0) {
      toast.error('请至少选择一个项目')
      return
    }

    try {
      // 使用第一个选中的项目作为主项目
      const primaryProjectId = selectedProjectIds[0]

      if (editingId) {
        await updateTask(editingId, {
          title: formData.title,
          description: formData.description || null,
          project_id: primaryProjectId,
          priority: formData.priority as any,
          due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
          status: formData.status as any
        })
        toast.success('任务更新成功')
      } else {
        await createTask({
          title: formData.title,
          description: formData.description || null,
          project_id: primaryProjectId,
          priority: formData.priority as any,
          due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
          status: formData.status as any
        })
        toast.success('任务创建成功')
      }

      setDialogOpen(false)
      resetForm()
      loadData()
    } catch (error: any) {
      toast.error(error.message || '操作失败')
    }
  }

  const handleToggleComplete = async (task: Task) => {
    try {
      await updateTask(task.id, {
        status: task.status === 'completed' ? 'pending' : 'completed',
        completed_at: task.status === 'completed' ? null : new Date().toISOString()
      })
      toast.success('任务状态已更新')
      loadData()
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
      loadData()
    } catch (error: any) {
      toast.error(error.message || '删除任务失败')
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive'
      case 'high': return 'warning'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'default'
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

  if (loading) {
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">任务管理</h1>
          <p className="mt-1 text-sm text-gray-600">管理您的所有待办任务</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="搜索项目或客户..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-48 h-9"
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 h-9">
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
              <Button disabled={projects.length === 0} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                添加任务
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? '编辑任务' : '添加新任务'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {editingId && (() => {
                  const currentTask = tasks.find(t => t.id === editingId) as any
                  const customerName = currentTask?.projects?.customers?.name
                  return customerName ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-sm text-blue-800">
                        <span className="font-medium">当前关联客户：</span>{customerName}
                      </p>
                    </div>
                  ) : null
                })()}
                <div>
                  <Label htmlFor="title">任务标题 *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="例如：给客户发送报价单"
                  />
                </div>
                <div>
                  <Label htmlFor="projects">关联项目 *（可多选）</Label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                    {projects.map((project: any) => (
                      <div key={project.id} className="flex items-center justify-between space-x-2">
                        <div className="flex items-center space-x-2 flex-1">
                          <Checkbox
                            id={`project-${project.id}`}
                            checked={selectedProjectIds.includes(project.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProjectIds([...selectedProjectIds, project.id])
                              } else {
                                setSelectedProjectIds(selectedProjectIds.filter(id => id !== project.id))
                              }
                            }}
                          />
                          <Label htmlFor={`project-${project.id}`} className="text-sm cursor-pointer flex-1">
                            {project.name}
                          </Label>
                        </div>
                        <span className="text-xs text-gray-500">
                          {project.customers?.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">已选择 {selectedProjectIds.length} 个项目</p>
                </div>
                <div>
                  <Label htmlFor="description">任务描述</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="任务的详细信息..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority">优先级</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger>
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
                    <Label htmlFor="due_date">截止日期</Label>
                    <Input
                      id="due_date"
                      type="datetime-local"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="status">任务状态</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
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
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit">{editingId ? '保存' : '创建'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 表头 */}
      <Card>
        <CardContent className="p-0">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {projects.length === 0 ? '请先创建项目' : '还没有任务'}
              </p>
              {projects.length > 0 && (
                <Button onClick={() => setDialogOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  创建第一个任务
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10">状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-64">任务标题</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-48">项目</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-20">优先级</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-36">截止日期</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32 whitespace-nowrap">任务状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24 whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTasks.map((task: any) => (
                    <tr
                      key={task.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        task.status === 'completed' ? 'opacity-50 bg-gray-50' : ''
                      } ${isOverdue(task) ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleComplete(task)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            task.status === 'completed'
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-gray-300 hover:border-green-500'
                          }`}
                        >
                          {task.status === 'completed' && <Check className="w-3 h-3" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {task.title}
                          </div>
                          {task.description && (
                            <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                              {task.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600 whitespace-nowrap">
                          {task.projects?.name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getPriorityColor(task.priority) as any} className="text-xs">
                          {getPriorityText(task.priority)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {task.due_date ? (
                          <div className={`text-xs whitespace-nowrap ${isOverdue(task) ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                            {new Date(task.due_date).toLocaleDateString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {isOverdue(task) && <span className="ml-1">(已过期)</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs ${
                          task.status === 'completed' ? 'text-green-600' :
                          task.status === 'in_progress' ? 'text-blue-600' :
                          task.status === 'cancelled' ? 'text-gray-500' :
                          'text-gray-600'
                        }`}>
                          {getStatusText(task.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-start gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(task)}
                            className="h-8 w-8"
                          >
                            <Pencil className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(task.id)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
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
    </div>
  )
}
