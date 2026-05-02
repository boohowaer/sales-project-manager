'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, FileText } from 'lucide-react'
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
    planned_accepted_date: '',
    planned_invoiced_date: '',
    planned_paid_date: '',
    notes: ''
  })

  useEffect(() => {
    setStageList(existingStages)
    setHasChanges(false)
  }, [existingStages])

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
      planned_accepted_date: formData.planned_accepted_date || null,
      planned_invoiced_date: formData.planned_invoiced_date || null,
      planned_paid_date: formData.planned_paid_date || null,
      notes: formData.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (editingId) {
      setStageList(prev => prev.map(s => s.id === editingId ? newStage : s))
    } else {
      setStageList(prev => [...prev, newStage])
    }

    setHasChanges(true)
    setDialogOpen(false)
    resetForm()
  }

  const handleDeleteStage = (id: string) => {
    if (!confirm('确定要删除这个结算段吗？')) return
    setStageList(prev => prev.filter(s => s.id !== id))
    setHasChanges(true)
    toast.success('结算段已删除（未保存）')
  }

  const handleSaveAll = async () => {
    const totalAmount = stageList.reduce((sum, stage) => sum + (stage.amount || 0), 0)
    if (projectValue && Math.abs(totalAmount - projectValue) > 0.01) {
      setShowConfirmDialog(true)
      return
    }
    await performSaveAll()
  }

  const performSaveAll = async () => {
    try {
      const existingStagesData = await getSettlementStages(projectId)
      const existingIds = existingStagesData.map(s => s.id)

      const toAdd = stageList.filter(s => s.id.startsWith('temp-'))
      const toUpdate = stageList.filter(s => !s.id.startsWith('temp-') && existingIds.includes(s.id))
      const toDelete = existingStagesData.filter(s => !stageList.find(ns => ns.id === s.id))

      for (const stage of toDelete) {
        await deleteSettlementStage(stage.id)
      }

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
          planned_accepted_date: stage.planned_accepted_date,
          planned_invoiced_date: stage.planned_invoiced_date,
          planned_paid_date: stage.planned_paid_date,
          notes: stage.notes
        })
      }

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
          planned_accepted_date: stage.planned_accepted_date,
          planned_invoiced_date: stage.planned_invoiced_date,
          planned_paid_date: stage.planned_paid_date,
          notes: stage.notes
        })
        setStageList(prev => prev.map(s => s.id === stage.id ? { ...s, id: newStage.id } : s))
      }

      setShowConfirmDialog(false)
      setHasChanges(false)
      toast.success('结算阶段保存成功')
      window.dispatchEvent(new Event('refresh-bell'))

      setTimeout(() => {
        onStagesChange()
        onClose?.()
      }, 100)
    } catch (error: any) {
      console.error('保存结算段失败:', error?.message || error?.details || error?.hint || JSON.stringify(error))
      toast.error(error?.message || error?.details || '保存失败，请重试')
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
      planned_accepted_date: '',
      planned_invoiced_date: '',
      planned_paid_date: '',
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
      planned_accepted_date: stage.planned_accepted_date || '',
      planned_invoiced_date: stage.planned_invoiced_date || '',
      planned_paid_date: stage.planned_paid_date || '',
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
    return Math.round((stageList.filter(s => s.paid).length / stageList.length) * 100)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">结算阶段管理</h3>
          <p className="text-sm text-zinc-600">共 {stageList.length} 段 · 已完成 {getProgressPercentage()}%</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />添加结算段
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[500px] max-w-none rounded-2xl shadow-xl border-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">{editingId ? '编辑结算段' : '添加结算段'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 px-1">
              {/* 基本信息 */}
              <div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">基本信息</div>
                <div className="flex gap-3">
                  <div className="w-16 shrink-0">
                    <Label className="text-sm font-medium text-zinc-700">段号</Label>
                    <Input type="number" value={formData.stage_number} onChange={(e) => setFormData({ ...formData, stage_number: parseInt(e.target.value) })} min={1} max={stages} className="mt-2 text-center h-9 text-sm" />
                  </div>
                  <div className="w-36 shrink-0">
                    <Label className="text-sm font-medium text-zinc-700">金额（元）</Label>
                    <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0" className="mt-2 h-9 text-sm" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-sm font-medium text-zinc-700">阶段名称</Label>
                    <Input value={formData.stage_name} onChange={(e) => setFormData({ ...formData, stage_name: e.target.value })} placeholder="如：首付款、验收款、尾款" className="mt-2 h-9 text-sm" />
                  </div>
                </div>
              </div>

              {/* 备注 */}
              <div className="-mt-2">
                <Label className="text-sm font-medium text-zinc-700">备注</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="其他信息..." rows={2} className="mt-2 text-sm resize-none" />
              </div>

              {/* 回款进度 */}
              <div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">回款进度</div>
                <div className="rounded-2xl overflow-hidden border border-zinc-200">
                  {[
                    { id: 'accepted', label: '验收', checked: formData.accepted, onCheck: (v: boolean) => setFormData({ ...formData, accepted: v }), planned: formData.planned_accepted_date, onPlanned: (v: string) => setFormData({ ...formData, planned_accepted_date: v }), done: formData.accepted_date, onDone: (v: string) => setFormData({ ...formData, accepted_date: v }) },
                    { id: 'invoiced', label: '开票', checked: formData.invoiced, onCheck: (v: boolean) => setFormData({ ...formData, invoiced: v }), planned: formData.planned_invoiced_date, onPlanned: (v: string) => setFormData({ ...formData, planned_invoiced_date: v }), done: formData.invoiced_date, onDone: (v: string) => setFormData({ ...formData, invoiced_date: v }) },
                    { id: 'paid', label: '回款', checked: formData.paid, onCheck: (v: boolean) => setFormData({ ...formData, paid: v }), planned: formData.planned_paid_date, onPlanned: (v: string) => setFormData({ ...formData, planned_paid_date: v }), done: formData.paid_date, onDone: (v: string) => setFormData({ ...formData, paid_date: v }) },
                  ].map((item, i, arr) => (
                    <div key={item.id} className={`flex items-center px-4 py-3 gap-4 ${i < arr.length - 1 ? 'border-b border-zinc-200' : ''}`}>
                      <label className="flex items-center gap-3 cursor-pointer w-16 shrink-0">
                        <Checkbox id={item.id} checked={item.checked} onCheckedChange={(checked) => item.onCheck(Boolean(checked))} />
                        <span className={`text-sm font-medium ${item.checked ? 'text-zinc-900' : 'text-zinc-500'}`}>{item.label}</span>
                      </label>
                      <div className="flex items-center gap-1.5 flex-1">
                        <span className="text-xs text-zinc-400 shrink-0">计划</span>
                        <DatePicker value={item.planned} onChange={(v) => item.onPlanned(v)} size="compact" className="w-[140px]" />
                      </div>
                      <div className="flex items-center gap-1.5 flex-1">
                        <span className="text-xs text-zinc-400 shrink-0">完成</span>
                        <DatePicker value={item.done} onChange={(v) => item.onDone(v)} size="compact" className="w-[140px]" disabled={!item.checked} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="cancel" onClick={() => setDialogOpen(false)}>取消</Button>
                <Button onClick={handleAddEditStage}>保存</Button>
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {stageList.sort((a, b) => a.stage_number - b.stage_number).map((stage) => (
              <Card key={stage.id} className={stage.paid ? 'rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0 bg-white border-l-4 border-l-emerald-500' : 'rounded-2xl shadow-sm hover:shadow-md transition-shadow border-0 bg-white'}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center justify-center w-8 h-8 bg-sky-100 text-sky-600 rounded-full font-semibold">{stage.stage_number}</div>
                        <div>
                          <h4 className="font-semibold text-zinc-900">{stage.stage_name || `第${stage.stage_number}段`}</h4>
                          {stage.amount && <p className="text-sm text-zinc-600">¥{stage.amount.toLocaleString()}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {getStatusBadge(stage.accepted, stage.invoiced, stage.paid)}
                        {stage.notes && <span className="text-xs text-zinc-600 inline-flex items-center">备注：{stage.notes}</span>}
                        {stage.accepted_date && <span className="text-xs text-zinc-600">验收：{new Date(stage.accepted_date).toLocaleDateString('zh-CN')}</span>}
                        {stage.invoiced_date && <span className="text-xs text-zinc-600">开票：{new Date(stage.invoiced_date).toLocaleDateString('zh-CN')}</span>}
                        {stage.paid_date && <span className="text-xs text-zinc-600">回款：{new Date(stage.paid_date).toLocaleDateString('zh-CN')}</span>}
                      </div>
                      {(stage.planned_accepted_date || stage.planned_invoiced_date || stage.planned_paid_date) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-zinc-400">
                          {stage.planned_accepted_date && <span>计划验收 {new Date(stage.planned_accepted_date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</span>}
                          {stage.planned_invoiced_date && <span>计划开票 {new Date(stage.planned_invoiced_date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</span>}
                          {stage.planned_paid_date && <span>计划回款 {new Date(stage.planned_paid_date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(stage)} className="h-8 w-8 hover:bg-zinc-100 text-zinc-600"><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteStage(stage.id)} className="h-8 w-8 hover:bg-red-50 text-zinc-400 hover:text-rose-500"><Trash2 className="w-4 h-4 text-rose-500" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="bg-zinc-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              {projectValue && (
                <div>
                  <p className="text-sm text-zinc-600">项目价值</p>
                  <p className="text-2xl font-semibold text-zinc-900 mt-1">¥{projectValue.toLocaleString()}</p>
                </div>
              )}
              <div className="text-right">
                <p className="text-sm text-zinc-600">结算段金额总和</p>
                <p className="text-2xl font-semibold text-zinc-900 mt-1">¥{stageList.reduce((sum, stage) => sum + (stage.amount || 0), 0).toLocaleString()}</p>
                {projectValue && (
                  <div className="mt-1">
                    {Math.abs(stageList.reduce((sum, stage) => sum + (stage.amount || 0), 0) - projectValue) < 0.01
                      ? <p className="text-sm text-emerald-600">✓ 金额一致</p>
                      : <p className="text-sm text-amber-600">⚠ 金额不一致</p>}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button type="button" variant="cancel" onClick={() => { setStageList(existingStages); setHasChanges(false); toast.success('已取消未保存的修改') }} disabled={!hasChanges}>取消修改</Button>
            <Button onClick={handleSaveAll} disabled={!hasChanges}>保存结算阶段</Button>
          </div>
        </div>
      )}

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">确认保存</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-zinc-700">当前结算阶段设置金额总和（¥{stageList.reduce((sum, stage) => sum + (stage.amount || 0), 0).toLocaleString()}）与项目信息中项目价值（¥{projectValue?.toLocaleString()}）不一致，是否确认保存？</p>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="cancel" onClick={() => setShowConfirmDialog(false)}>取消</Button>
              <Button onClick={performSaveAll}>确认保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
