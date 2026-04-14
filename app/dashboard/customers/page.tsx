'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/lib/supabase/queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { Customer } from '@/types'

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    notes: ''
  })

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const data = await getCustomers()
      setCustomers(data)
    } catch (error: any) {
      toast.error('加载客户列表失败')
    } finally {
      setLoading(false)
    }
  }

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
        // 创建新客户
        await createCustomer({
          name: formData.name,
          company: formData.company || null,
          email: formData.email || null,
          phone: formData.phone || null,
          notes: formData.notes || null
        })
        toast.success('客户创建成功')
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
        <div className="text-center py-12">
          <div className="text-gray-500">加载中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">客户管理</h1>
          <p className="mt-2 text-gray-600">管理您的所有客户信息</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              添加客户
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "编辑客户" : "添加新客户"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">客户名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="张三"
                />
              </div>
              <div>
                <Label htmlFor="company">公司名称</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="某某公司"
                />
              </div>
              <div>
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="customer@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">电话</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+86 138 0000 0000"
                />
              </div>
              <div>
                <Label htmlFor="notes">备注</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="客户的其他信息..."
                />
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

      {/* 客户列表 */}
      {customers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-500 mb-4">还没有客户</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              添加第一个客户
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => (
            <Card key={customer.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{customer.name}</h3>
                    {customer.company && (
                      <p className="text-sm text-gray-600 mt-1">{customer.company}</p>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(customer)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(customer.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {customer.email && (
                  <p className="text-sm text-gray-600">
                    📧 {customer.email}
                  </p>
                )}
                {customer.phone && (
                  <p className="text-sm text-gray-600">
                    📱 {customer.phone}
                  </p>
                )}
                {customer.notes && (
                  <p className="text-sm text-gray-600 mt-2">
                    📝 {customer.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
