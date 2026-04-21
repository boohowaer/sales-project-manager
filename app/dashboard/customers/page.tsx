'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/lib/supabase/queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Trash2, Upload, UserPlus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { Customer } from '@/types'
import { ImportDialog } from '@/components/import/ImportDialog'
import { useTeamView } from '@/hooks/useTeamView'
import { AssignDialog } from '@/components/admin/AssignDialog'

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [assignTarget, setAssignTarget] = useState<string | null>(null)
  const [isManager, setIsManager] = useState(false)
  const [isSalesRep, setIsSalesRep] = useState(false)
  const [dataScope, setDataScope] = useState<'own' | 'team'>('own')
  const { viewMode, toggle } = useTeamView()
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    notes: ''
  })

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      setIsManager(d.role === 'super_admin' || d.role === 'sales_manager')
      setIsSalesRep(d.role === 'sales_rep')
      setDataScope(d.dataScope ?? 'own')
    })
  }, [])

  const loadCustomers = useCallback(async () => {
    try {
      const data = await getCustomers({ teamView: viewMode === 'team' })
      setCustomers(data)
    } catch (error: any) {
      toast.error('加载客户列表失败')
    } finally {
      setLoading(false)
    }
  }, [viewMode])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name) {
      toast.error('请输入客户名称')
      return
    }

    try {
      if (editingId) {
        // 更新客户
        await updateCustomer(editingId, {
          name: formData.name,
          company: formData.company || null,
          email: formData.email || null,
          phone: formData.phone || null,
          notes: formData.notes || null
        })
        toast.success('客户更新成功')
      } else {
        const payload = {
          name: formData.name,
          company: formData.company || null,
          email: formData.email || null,
          phone: formData.phone || null,
          notes: formData.notes || null
        }
        if (isSalesRep) {
          await fetch('/api/approvals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'create_customer', payload }),
          })
          toast('已提交审批，等待经理审核')
        } else {
          // 创建新客户
          await createCustomer(payload)
          toast.success('客户创建成功')
        }
      }
      setDialogOpen(false)
      setFormData({ name: '', company: '', email: '', phone: '', notes: '' })
      setEditingId(null)
      loadCustomers()
    } catch (error: any) {
      toast.error(error.message || '操作失败')
    }
  }

  const handleEdit = (customer: Customer) => {
    setFormData({
      name: customer.name,
      company: customer.company || '',
      email: customer.email || '',
      phone: customer.phone || '',
      notes: customer.notes || ''
    })
    setEditingId(customer.id)
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
  }

  // 当对话框关闭时重置表单
  useEffect(() => {
    if (!dialogOpen) {
      setTimeout(() => {
        setFormData({ name: '', company: '', email: '', phone: '', notes: '' })
        setEditingId(null)
      }, 100)
    }
  }, [dialogOpen])

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个客户吗？相关的项目和任务也会被删除。')) {
      return
    }

    try {
      await deleteCustomer(id)
      toast.success('客户删除成功')
      loadCustomers()
    } catch (error: any) {
      toast.error(error.message || '删除客户失败')
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
          <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">客户管理</h1>
          <p className="mt-2 text-zinc-500 text-sm">管理您的所有客户信息</p>
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
          <Button
            onClick={() => setImportDialogOpen(true)}
            className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full shadow-sm"
          >
            <Upload className="w-4 h-4 mr-2" />
            批量导入
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                添加客户
              </Button>
            </DialogTrigger>
          <DialogContent className="rounded-2xl shadow-xl border-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">{editingId ? "编辑客户" : "添加新客户"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-zinc-700">客户名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="张三"
                  className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
              <div>
                <Label htmlFor="company" className="text-sm font-medium text-zinc-700">公司名称</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="某某公司"
                  className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-zinc-700">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="customer@example.com"
                  className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-sm font-medium text-zinc-700">电话</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+86 138 0000 0000"
                  className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
              <div>
                <Label htmlFor="notes" className="text-sm font-medium text-zinc-700">备注</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="客户的其他信息..."
                  className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 resize-none"
                />
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

      {/* 客户列表 */}
      {customers.length === 0 ? (
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="text-center py-16">
            <p className="text-zinc-400 mb-4">还没有客户</p>
            <Button onClick={() => setDialogOpen(true)} className="bg-zinc-900 text-white hover:bg-zinc-800">
              <Plus className="w-4 h-4 mr-2" />
              添加第一个客户
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => (
            <Card key={customer.id} className="rounded-2xl shadow-sm hover:shadow-md transition-all border-0 bg-white group">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-zinc-900">{customer.name}</h3>
                    {customer.company && (
                      <p className="text-sm text-zinc-500 mt-1">{customer.company}</p>
                    )}
                  </div>
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isManager && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setAssignTarget(customer.id)}
                        className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                        title="分派"
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(customer)}
                      className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(customer.id)}
                      className="h-8 w-8 hover:bg-red-50 text-zinc-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {customer.email && (
                  <p className="text-sm text-zinc-600 flex items-center gap-2">
                    <span className="text-zinc-400">📧</span>
                    {customer.email}
                  </p>
                )}
                {customer.phone && (
                  <p className="text-sm text-zinc-600 flex items-center gap-2">
                    <span className="text-zinc-400">📱</span>
                    {customer.phone}
                  </p>
                )}
                {customer.notes && (
                  <p className="text-sm text-zinc-500 mt-3 pt-3 border-t border-zinc-100 line-clamp-2">
                    {customer.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 分派对话框 */}
      {customers.map(customer => (
        <AssignDialog
          key={customer.id}
          open={assignTarget === customer.id}
          onClose={() => setAssignTarget(null)}
          resourceType="customer"
          resourceId={customer.id}
          onSuccess={loadCustomers}
        />
      ))}

      {/* 批量导入对话框 */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportSuccess={loadCustomers}
        type="customers"
        title="批量导入客户"
        description="从CSV或Excel文件批量导入客户信息，请先下载模板并按照格式填写数据"
        templateLinks={[
          { label: '下载CSV模板', url: '/templates/customers_template.csv' },
          { label: '下载Excel模板', url: '/templates/customers_template.xlsx' }
        ]}
      />
    </div>
  )
}
