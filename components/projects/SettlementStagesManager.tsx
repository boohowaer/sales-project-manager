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
  projectValue: number | null
  onStagesChange: () => void
  onClose?: () => void
}

export function SettlementStagesManager({
  projectId,
  stages,
  existingStages,
  projectValue,
  onStagesChange,
  onClose
}: SettlementStagesManagerProps) {
  const [stageList, setStageList] = useState<SettlementStage[]>(existingStages)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
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
    setHasChanges(false)
  }, [existingStages])

  // 添加/编辑结算段 - 只更新本地状态
  const handleAddEditStage = () => {
    const newStage: SettlementStage = {
      id: editingId || `temp-${Date.now()}`,
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
      notes: formData.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (editingId) {
      // 编辑现有结算段
      setStageList(prev => prev.map(s => s.id === editingId ? newStage : s))
    } else {
      // 添加新结算段
      setStageList(prev => [...prev, newStage])
    }

    setHasChanges(true)
    setDialogOpen(false)
    resetForm()
  }

  // 删除结算段 - 只更新本地状态
  const handleDeleteStage = (id: string) => {
    if (!confirm('确定要删除这个结算段吗？')) {
      return
    }

    setStageList(prev => prev.filter(s => s.id !== id))
    setHasChanges(true)
    toast.success('结算段已删除（未保存）')
  }

  // 总保存按钮 - 验证并批量保存到数据库
  const handleSaveAll = async () => {
    // 计算所有结算段的金额总和
    const totalAmount = stageList.reduce((sum, stage) => sum + (stage.amount || 0), 0)

    // 如果项目价值存在且金额总和与项目价值不一致，显示确认对话框
    if (projectValue && Math.abs(totalAmount - projectValue) > 0.01) {
      setShowConfirmDialog(true)
      return
    }

    // 直接保存
    await performSaveAll()
  }

  const performSaveAll = async () => {
    try {
      // 获取数据库中现有的结算段
      const existingStagesData = await getSettlementStages(projectId)
      const existingIds = existingStagesData.map(s => s.id)

      // 找出需要添加、更新、删除的结算段
      const toAdd = stageList.filter(s => s.id.startsWith('temp-'))
      const toUpdate = stageList.filter(s => !s.id.startsWith('temp-') && existingIds.includes(s.id))
      const toDelete = existingStagesData.filter(s => !stageList.find(ns => ns.id === s.id))

      // 执行删除
      for (const stage of toDelete) {
        await deleteSettlementStage(stage.id)
      }

      // 执行更新
      for (const stage of toUpdate) {
        await updateSettlementStage(stage.id, {
          stage_number: stage.stage_number,
          stage_name: stage.stage_name,
          amount: stage.amount,
          accepted: stage.accepted,
          accepted_date: stage.accepted_date,
          invoiced: stage.invoiced,
          invoiced_date: stage.invoiced_date,
          paid: stage.paid,
          paid_date: stage.paid_date,
          notes: stage.notes
        })
      }

      // 执行添加
      for (const stage of toAdd) {
        const newStage = await createSettlementStage({
          project_id: projectId,
          stage_number: stage.stage_number,
          stage_name: stage.stage_name,
          amount: stage.amount,
          accepted: stage.accepted,
          accepted_date: stage.accepted_date,
          invoiced: stage.invoiced,
          invoiced_date: stage.invoiced_date,
          paid: stage.paid,
          paid_date: stage.paid_date,
          notes: stage.notes
        })
        // 更新本地列表中的ID
        setStageList(prev => prev.map(s => s.id === stage.id ? { ...s, id: newStage.id } : s))
      }

      setShowConfirmDialog(false)
      setHasChanges(false)
      toast.success('结算阶段保存成功')

      // 延迟调用 onStagesChange 和 onClose
      setTimeout(() => {
        onStagesChange()
        onClose?.()
      }, 100)
    } catch (error: any) {
      console.error('保存结算段失败:', error)
      toast.error(error.message || '保存失败')
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
            共 {stageList.length} 段 · 已完成 {getProgressPercentage()}%
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full">
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
                <Button onClick={handleAddEditStage} className="bg-zinc-900 text-white hover:bg-zinc-800">
                  确定
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 结算阶段列表 */}
      {stageList.length === 0 ? (
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardContent className="text-center py-8 text-zinc-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>还没有创建结算段</p>
            <p className="text-sm">点击"添加结算段"开始管理项目结算</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
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
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {getStatusBadge(stage.accepted, stage.invoiced, stage.paid)}
                          {stage.notes && (
                            <span className="text-xs text-zinc-600 inline-flex items-center">
                              备注：{stage.notes}
                            </span>
                          )}
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
                          onClick={() => handleDeleteStage(stage.id)}
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

          {/* 金额统计 */}
          <div className="bg-zinc-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              {projectValue && (
                <div>
                  <p className="text-sm text-zinc-600">项目价值</p>
                  <p className="text-2xl font-semibold text-zinc-900 mt-1">
                    ¥{projectValue.toLocaleString()}
                  </p>
                </div>
              )}
              <div className="text-right">
                <p className="text-sm text-zinc-600">结算段金额总和</p>
                <p className="text-2xl font-semibold text-zinc-900 mt-1">
                  ¥{stageList.reduce((sum, stage) => sum + (stage.amount || 0), 0).toLocaleString()}
                </p>
                {projectValue && (
                  <div className="mt-1">
                    {Math.abs(stageList.reduce((sum, stage) => sum + (stage.amount || 0), 0) - projectValue) < 0.01 ? (
                      <p className="text-sm text-emerald-600">✓ 金额一致</p>
                    ) : (
                      <p className="text-sm text-amber-600">⚠ 金额不一致</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 总保存按钮 */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // 重置为原始数据
                setStageList(existingStages)
                setHasChanges(false)
                toast.info('已取消未保存的修改')
              }}
              disabled={!hasChanges}
              className="border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            >
              取消修改
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={!hasChanges}
              className="bg-zinc-900 text-white hover:bg-zinc-800"
            >
              保存结算阶段
            </Button>
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">确认保存</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-zinc-700">
              当前结算阶段设置金额总和（¥{stageList.reduce((sum, stage) => sum + (stage.amount || 0), 0).toLocaleString()}）与项目信息中项目价值（¥{projectValue?.toLocaleString()}）不一致，是否确认保存？
            </p>
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
                className="border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              >
                取消
              </Button>
              <Button
                onClick={performSaveAll}
                className="bg-zinc-900 text-white hover:bg-zinc-800"
              >
                确认保存
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
