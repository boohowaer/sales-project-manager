'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { DictSelect } from '@/components/ui/dict-select'
import { useUser } from '@/context/UserContext'
import { useDictionary, useDictionaryActions } from '@/context/DictionaryContext'
import { PageLoading } from '@/components/ui/page-loading'

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [assignTarget, setAssignTarget] = useState<string | null>(null)
  const me = useUser()
  const isManager = me?.role === 'super_admin' || me?.role === 'sales_manager'
  const isSalesRep = me?.role === 'sales_rep'
  const dataScope: 'own' | 'team' = me?.dataScope ?? 'own'
  const { viewMode, toggle } = useTeamView()
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    notes: ''
  })
  const companyEntries = useDictionary('company')
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
  const companyOptions = useMemo(() => buildCascade(companyEntries), [companyEntries])
  const { reloadCategory } = useDictionaryActions()
  const [companyLoading, setCompanyLoading] = useState(false)

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
          window.dispatchEvent(new Event('refresh-bell'))
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
    if (!confirm('确定要删除这个客户吗？关联项目的客户信息将被清空，项目本身不会被删除。')) {
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

  // 创建新公司字典条目
  const handleCreateCompany = async (label: string) => {
    setCompanyLoading(true)
    try {
      const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^\w\u4e00-\u9fa5]/g, '')
      const res = await fetch('/api/admin/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'company',
          key,
          label,
          module: 'customer',
          field_key: 'company',
          sort_order: companyOptions.length,
          is_active: true,
          level: 1,
        }),
      })
      if (res.ok) {
        reloadCategory('company')
        setFormData(prev => ({ ...prev, company: label }))
        toast.success('公司已添加到字典')
      }
    } catch {
      // 静默失败，仍允许使用输入的名称
      setFormData(prev => ({ ...prev, company: label }))
    } finally {
      setCompanyLoading(false)
    }
  }

  if (loading) {
    return <PageLoading variant="cards" />
  }

  return (
    <div className="p-8">
      {/* 页面标题 */}
      <div className="flex items-end justify-between mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">客户管理</h1>
            <p className="mt-2 text-zinc-500 text-sm">管理您的所有客户信息</p>
          </div>
        </div>
        <div className="flex gap-3 items-center -translate-y-1">
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
              <Button className="h-9 shadow-sm">
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
                <DictSelect
                  value={companyOptions.flatMap(o => [o, ...(o.children || [])]).find(o => o.label === formData.company)?.key || ''}
                  onChange={(key) => {
                    const all = companyOptions.flatMap(o => [o, ...(o.children || [])])
                    const opt = all.find(o => o.key === key)
                    setFormData({ ...formData, company: opt?.label || '' })
                  }}
                  options={companyOptions}
                  placeholder="搜索或选择公司"
                  className="mt-2"
                  cascade
                  allowCreate
                  onCreate={handleCreateCompany}
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
                <Button type="button" variant="cancel" onClick={() => setDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit">{editingId ? '保存' : '创建'}</Button>
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
                    <div className="flex items-center gap-2 mt-1 min-h-[20px]">
                      {customer.company && (
                        <span className="text-sm text-zinc-500">{customer.company}</span>
                      )}
                    </div>
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
