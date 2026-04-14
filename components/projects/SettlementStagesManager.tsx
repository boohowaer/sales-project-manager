'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Check, X, FileText, DollarSign } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { SettlementStage } from '@/types'
import { getSettlementStages, createSettlementStage, updateSettlementStage, deleteSettlementStage } from '@/lib/supabase/queries'

interface SettlementStagesManagerProps {
  projectId: string
  stages: number
  existingStages: SettlementStage[]
  onStagesChange: () => void
}

export function SettlementStagesManager({
  projectId,
  stages,
  existingStages,
  onStagesChange
}: SettlementStagesManagerProps) {
  const [stageList, setStageList] = useState<SettlementStage[]>(existingStages)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    stage_number: 1,
    stage_name: '',
    amount: '',
    accepted: false,
    accepted_date: '',
    invoiced: false,
    invoiced_date: '',
    paid: false,
    paid_date: '',
    notes: ''
  })

  useEffect(() => {
    setStageList(existingStages)
  }, [existingStages])

  const handleSave = async () => {
    try {
      if (editingId) {
        await updateSettlementStage(editingId, {
          stage_number: formData.stage_number,
          stage_name: formData.stage_name || null,
          amount: formData.amount ? parseFloat(formData.amount) : null,
          accepted: formData.accepted,
          accepted_date: formData.accepted_date || null,
          invoiced: formData.invoiced,
          invoiced_date: formData.invoiced_date || null,
          paid: formData.paid,
          paid_date: formData.paid_date || null,
          notes: formData.notes || null
        })
        toast.success('结算段更新成功')
      } else {
        const newStage = await createSettlementStage({
          project_id: projectId,
          stage_number: formData.stage_number,
          stage_name: formData.stage_name || null,
          amount: formData.amount ? parseFloat(formData.amount) : null,
          accepted: formData.accepted,
          accepted_date: formData.accepted_date || null,
          invoiced: formData.invoiced,
          invoiced_date: formData.invoiced_date || null,
          paid: formData.paid,
          paid_date: formData.paid_date || null,
          notes: formData.notes || null
        })
        toast.success('结算段创建成功')
        // 立即添加到本地列表
        setStageList(prev => [...prev, newStage])
      }
      setDialogOpen(false)
      resetForm()
      // 延迟调用 onStagesChange，确保数据库操作完成
      setTimeout(() => {
        onStagesChange()
      }, 100)
    } catch (error: any) {
      console.error('保存结算段失败:', error)
      toast.error(error.message || '操作失败')
    }
  }

  const resetForm = () => {
    setFormData({
      stage_number: stageList.length + 1,
      stage_name: '',
      amount: '',
      accepted: false,
      accepted_date: '',
      invoiced: false,
      invoiced_date: '',
      paid: false,
      paid_date: '',
      notes: ''
    })
    setEditingId(null)
  }

  const handleEdit = (stage: SettlementStage) => {
    setFormData({
      stage_number: stage.stage_number,
      stage_name: stage.stage_name || '',
      amount: stage.amount?.toString() || '',
      accepted: stage.accepted,
      accepted_date: stage.accepted_date || '',
      invoiced: stage.invoiced,
      invoiced_date: stage.invoiced_date || '',
      paid: stage.paid,
      paid_date: stage.paid_date || '',
      notes: stage.notes || ''
    })
    setEditingId(stage.id)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个结算段吗？')) {
      return
    }

    try {
      await deleteSettlementStage(id)
      toast.success('结算段删除成功')
      // 立即从本地列表中移除
      setStageList(prev => prev.filter(s => s.id !== id))
      // 延迟调用 onStagesChange，确保数据库操作完成
      setTimeout(() => {
        onStagesChange()
      }, 100)
    } catch (error: any) {
      console.error('删除结算段失败:', error)
      toast.error(error.message || '删除失败')
    }
  }

  const getStatusBadge = (accepted: boolean, invoiced: boolean, paid: boolean) => {
    if (paid) return <Badge variant="success">已回款</Badge>
    if (invoiced) return <Badge variant="info">已开票</Badge>
    if (accepted) return <Badge variant="default">已验收</Badge>
    return <Badge variant="secondary">进行中</Badge>
  }

  const getProgressPercentage = () => {
    if (stageList.length === 0) return 0
    const completedCount = stageList.filter(s => s.paid).length
    return Math.round((completedCount / stageList.length) * 100)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">结算阶段管理</h3>
          <p className="text-sm text-zinc-600">
            共 {stages} 段 · 已完成 {getProgressPercentage()}%
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={stageList.length >= stages} className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full">
              <Plus className="w-4 h-4 mr-1" />
              添加结算段
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl shadow-xl border-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">{editingId ? '编辑结算段' : '添加结算段'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stage_number" className="text-sm font-medium text-zinc-700">段号</Label>
                  <Input
                    id="stage_number"
                    type="number"
                    value={formData.stage_number}
                    onChange={(e) => setFormData({ ...formData, stage_number: parseInt(e.target.value) })}
                    min={1}
                    max={stages}
                    className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <Label htmlFor="amount" className="text-sm font-medium text-zinc-700">金额（元）</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="100000"
                    className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="stage_name" className="text-sm font-medium text-zinc-700">阶段名称</Label>
                <Input
                  id="stage_name"
                  value={formData.stage_name}
                  onChange={(e) => setFormData({ ...formData, stage_name: e.target.value })}
                  placeholder="例如：首付款、进度款、尾款"
                  className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="accepted"
                    checked={formData.accepted}
                    onCheckedChange={(checked) => setFormData({ ...formData, accepted: checked })}
                  />
                  <Label htmlFor="accepted" className="text-sm">已验收</Label>
                </div>
                {formData.accepted && (
                  <Input
                    type="date"
                    value={formData.accepted_date}
                    onChange={(e) => setFormData({ ...formData, accepted_date: e.target.value })}
                    placeholder="验收日期"
                    className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="invoiced"
                    checked={formData.invoiced}
                    onCheckedChange={(checked) => setFormData({ ...formData, invoiced: checked })}
                  />
                  <Label htmlFor="invoiced" className="text-sm">已开票</Label>
                </div>
                {formData.invoiced && (
                  <Input
                    type="date"
                    value={formData.invoiced_date}
                    onChange={(e) => setFormData({ ...formData, invoiced_date: e.target.value })}
                    placeholder="开票日期"
                    className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="paid"
                    checked={formData.paid}
                    onCheckedChange={(checked) => setFormData({ ...formData, paid: checked })}
                  />
                  <Label htmlFor="paid" className="text-sm">已回款</Label>
                </div>
                {formData.paid && (
                  <Input
                    type="date"
                    value={formData.paid_date}
                    onChange={(e) => setFormData({ ...formData, paid_date: e.target.value })}
                    placeholder="回款日期"
                    className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                )}
              </div>

              <div>
                <Label htmlFor="notes" className="text-sm font-medium text-zinc-700">备注</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="其他信息..."
                  rows={3}
                  className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                  取消
                </Button>
                <Button onClick={handleSave} className="bg-zinc-900 text-white hover:bg-zinc-800">
                  {editingId ? '保存' : '添加'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {stageList.length === 0 ? (
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="text-center py-8 text-zinc-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>还没有创建结算段</p>
            <p className="text-sm">点击"添加结算段"开始管理项目结算</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {stageList
            .sort((a, b) => a.stage_number - b.stage_number)
            .map((stage) => (
              <Card key={stage.id} className={stage.paid ? 'rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0 bg-white border-l-4 border-l-emerald-500' : 'rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0 bg-white'}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center w-8 h-8 bg-sky-100 text-sky-600 rounded-full font-semibold">
                          {stage.stage_number}
                        </div>
                        <div>
                          <h4 className="font-semibold text-zinc-900">
                            {stage.stage_name || `第${stage.stage_number}段`}
                          </h4>
                          {stage.amount && (
                            <p className="text-sm text-zinc-600">
                              ¥{stage.amount.toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {getStatusBadge(stage.accepted, stage.invoiced, stage.paid)}
                        {stage.accepted_date && (
                          <span className="text-xs text-zinc-600">
                            验收：{new Date(stage.accepted_date).toLocaleDateString('zh-CN')}
                          </span>
                        )}
                        {stage.invoiced_date && (
                          <span className="text-xs text-zinc-600">
                            开票：{new Date(stage.invoiced_date).toLocaleDateString('zh-CN')}
                          </span>
                        )}
                        {stage.paid_date && (
                          <span className="text-xs text-zinc-600">
                            回款：{new Date(stage.paid_date).toLocaleDateString('zh-CN')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(stage)}
                        className="h-8 w-8 hover:bg-zinc-100 text-zinc-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(stage.id)}
                        className="h-8 w-8 hover:bg-red-50 text-zinc-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}
