'use client'
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Pencil, Coins } from 'lucide-react'
import { getCustomers, updateProject, getSettlementStages } from '@/lib/supabase/queries'
import { SettlementStagesManager } from '@/components/projects/SettlementStagesManager'
import { toast } from 'react-hot-toast'

const getStatusText = (s: string) =>
  ({ active: '跟进中', won: '已成交', lost: '已丢失', on_hold: '暂停', archived: '已归档' }[s] ?? s)

const getStatusVariant = (s: string) =>
  ({ active: 'default', won: 'success', lost: 'destructive', on_hold: 'secondary', archived: 'outline' }[s] ?? 'outline') as any

const getSettlementTagColor = (count: number, total: number) => {
  if (count === total) return 'bg-emerald-100 text-emerald-700'
  return 'bg-amber-100 text-amber-700'
}

const EMPTY_FORM = { name: '', description: '', customer_id: '', status: 'active', value: '', probability: 50, start_date: '', expected_close_date: '', signed_at: '', has_start_notice: false, contract_signed: false, settlement_stages: 1, belong_year: '' }

interface Props {
  project: any
  open: boolean
  onClose: () => void
  onUpdated: (updated: any) => void
  onDeleted?: (id: string) => void
}

export function ProjectDetailModal({ project, open, onClose, onUpdated, onDeleted }: Props) {
  const [localProject, setLocalProject] = useState<any>(project)
  const [isSalesRep, setIsSalesRep] = useState(false)
  const [isManager, setIsManager] = useState(false)
  const [roleLoaded, setRoleLoaded] = useState(false)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [formData, setFormData] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Settlement dialog
  const [settlementOpen, setSettlementOpen] = useState(false)
  const [existingSettlements, setExistingSettlements] = useState<any[]>([])

  useEffect(() => { setLocalProject(project) }, [project])

  useEffect(() => {
    if (open && !roleLoaded) {
      fetch('/api/me').then(r => r.json()).then(d => {
        setIsSalesRep(d.role === 'sales_rep')
        setRoleLoaded(true)
      }).catch(() => setRoleLoaded(true))
    }
  }, [open, roleLoaded])

  const handleClose = () => { setEditOpen(false); setSettlementOpen(false); onClose() }

  const handleEdit = async () => {
    if (customers.length === 0) setCustomers(await getCustomers().catch(() => []))
    setFormData({
      name: localProject.name,
      description: localProject.description || '',
      customer_id: localProject.customer_id,
      status: localProject.status,
      value: localProject.value?.toString() || '',
      probability: localProject.probability ?? 50,
      start_date: localProject.start_date || '',
      expected_close_date: localProject.expected_close_date || '',
      signed_at: localProject.signed_at || '',
      has_start_notice: localProject.has_start_notice || false,
      contract_signed: localProject.contract_signed || false,
      settlement_stages: 1,
      belong_year: localProject.belong_year?.toString() || '',
    })
    setEditOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.customer_id) { toast.error('请填写项目名称和选择客户'); return }
    setSaving(true)
    try {
      const updateData = {
        name: formData.name,
        description: formData.description || null,
        customer_id: formData.customer_id,
        status: formData.status,
        value: formData.value ? parseFloat(formData.value) : null,
        probability: formData.probability,
        start_date: formData.start_date || null,
        expected_close_date: formData.expected_close_date || null,
        has_start_notice: formData.has_start_notice,
        contract_signed: formData.contract_signed,
        signed_at: formData.signed_at || null,
        settlement_stages: typeof formData.settlement_stages === 'number' ? formData.settlement_stages : parseInt(formData.settlement_stages) || 1,
        belong_year: formData.belong_year ? parseInt(formData.belong_year) : null,
      }
      const KEY_FIELDS = ['value', 'status', 'expected_close_date']
      if (isSalesRep && KEY_FIELDS.some(f => f in updateData)) {
        await fetch('/api/approvals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'update_project', targetId: localProject.id, payload: updateData }) })
        toast('修改已提交审批，原数据继续生效')
        window.dispatchEvent(new Event('refresh-bell'))
      } else {
        const updated = await updateProject(localProject.id, updateData as any)
        toast.success('项目更新成功')
        const merged = { ...localProject, ...updated }
        setLocalProject(merged)
        onUpdated(merged)
        window.dispatchEvent(new Event('refresh-bell'))
      }
      setEditOpen(false)
    } catch (err: any) {
      toast.error(err.message || '更新失败')
    } finally {
      setSaving(false)
    }
  }

  const handleManageSettlements = async () => {
    try { setExistingSettlements(await getSettlementStages(localProject.id)) } catch { setExistingSettlements([]) }
    setSettlementOpen(true)
  }

  if (!localProject) return null

  const ss = localProject.settlement_summary

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl rounded-2xl shadow-xl border-0 bg-white">
          <DialogHeader className="pb-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs text-zinc-500 shrink-0">{localProject.customers?.name}</span>
                <DialogTitle className="font-semibold text-sm truncate">{localProject.name}</DialogTitle>
                <Badge variant={getStatusVariant(localProject.status)} className={`shrink-0 text-xs${localProject.status === 'won' ? ' bg-transparent border-transparent text-emerald-600 hover:bg-transparent' : ''}`}>
                  {getStatusText(localProject.status)}
                </Badge>
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900" onClick={handleEdit} title="编辑项目">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900" onClick={handleManageSettlements} title="结算阶段">
                  <Coins className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pb-1">
            <div className="flex flex-wrap gap-1.5">
              {localProject.belong_year && <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${localProject.belong_year === new Date().getFullYear() ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-500'}`}>{localProject.belong_year}年</span>}
              {localProject.has_start_notice && <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-[11px] rounded-full font-medium">✓ 有开工函</span>}
              {localProject.contract_signed && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[11px] rounded-full font-medium">✓ 已签合同</span>}
              {ss && <>
                <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${getSettlementTagColor(ss.accepted, ss.total)}`}>验收: {ss.accepted}/{ss.total}</span>
                <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${getSettlementTagColor(ss.invoiced, ss.total)}`}>开票: {ss.invoiced}/{ss.total}</span>
                <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${getSettlementTagColor(ss.paid, ss.total)}`}>回款: {ss.paid}/{ss.total}</span>
              </>}
            </div>
            {localProject.description && (
              <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{localProject.description}</p>
            )}
            <div className="grid grid-cols-5 gap-x-3 gap-y-2">
              <div className="space-y-0.5">
                <p className="text-zinc-400 text-[11px]">项目价值</p>
                <p className="font-semibold text-sm">{localProject.value ? `¥${localProject.value.toLocaleString()}` : '-'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-zinc-400 text-[11px]">成功概率</p>
                <p className="font-semibold text-sm">{localProject.probability != null ? `${localProject.probability}%` : '-'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-zinc-400 text-[11px]">开始日期</p>
                <p className="font-semibold text-sm">{localProject.start_date ? new Date(localProject.start_date).toLocaleDateString('zh-CN') : '-'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-zinc-400 text-[11px]">预期成交</p>
                <p className="font-semibold text-sm">{localProject.expected_close_date ? new Date(localProject.expected_close_date).toLocaleDateString('zh-CN') : '-'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-zinc-400 text-[11px]">成交日期</p>
                <p className={`font-semibold text-sm ${localProject.signed_at ? 'text-emerald-600' : ''}`}>{localProject.signed_at ? new Date(localProject.signed_at).toLocaleDateString('zh-CN') : '-'}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 编辑对话框 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl rounded-2xl shadow-xl border-0">
          <DialogHeader><DialogTitle className="text-lg font-semibold">编辑项目</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 px-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-zinc-700">项目名称 *</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="例如：网站开发项目" className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400" />
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-700">客户 *</Label>
                <SearchableSelect options={customers} value={formData.customer_id} onChange={v => setFormData({ ...formData, customer_id: v })} placeholder="选择客户" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-zinc-700">项目描述</Label>
              <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="项目的详细信息..." className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 resize-none" rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-zinc-700">状态</Label>
                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">跟进中</SelectItem>
                    <SelectItem value="won">已成交</SelectItem>
                    <SelectItem value="lost">已丢失</SelectItem>
                    <SelectItem value="on_hold">暂停</SelectItem>
                    <SelectItem value="archived">已归档</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-700">项目价值（元）</Label>
                <Input type="number" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} placeholder="100000" className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400" />
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-700">归属年份</Label>
                <Input type="number" min="2000" max="2100" value={formData.belong_year} onChange={e => setFormData({ ...formData, belong_year: e.target.value })} placeholder="2024" className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-zinc-700">开始日期</Label>
                <Input type="date" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400" />
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-700">预期成交日期</Label>
                <Input type="date" value={formData.expected_close_date} onChange={e => setFormData({ ...formData, expected_close_date: e.target.value })} className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400" />
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-700">成交日期</Label>
                <Input type="date" value={formData.signed_at} onChange={e => setFormData({ ...formData, signed_at: e.target.value })} className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400" />
              </div>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-6 mt-6">
              <div>
                <Label className="text-sm font-medium text-zinc-700 mb-2 block">合同状态</Label>
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="modal-has_start_notice" checked={formData.has_start_notice} onChange={e => setFormData({ ...formData, has_start_notice: e.target.checked })} className="w-4 h-4 rounded border-zinc-300 accent-zinc-600" />
                    <Label htmlFor="modal-has_start_notice" className="text-sm cursor-pointer">有开工函</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="modal-contract_signed" checked={formData.contract_signed} onChange={e => setFormData({ ...formData, contract_signed: e.target.checked })} className="w-4 h-4 rounded border-zinc-300 accent-zinc-600" />
                    <Label htmlFor="modal-contract_signed" className="text-sm cursor-pointer">已签署合同</Label>
                  </div>
                </div>
              </div>
              <div className="flex-1 ml-8">
                <Label className="text-sm font-medium text-zinc-700 mb-2 block">成功概率：{formData.probability}%</Label>
                <input type="range" min="0" max="100" value={formData.probability} onChange={e => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })} className="w-full h-2 accent-zinc-600" />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="rounded-full border-zinc-200 text-zinc-700 hover:bg-zinc-50">取消</Button>
              <Button type="submit" disabled={saving} className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full">{saving ? '保存中…' : '保存'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* 结算段管理对话框 */}
      <Dialog open={settlementOpen} onOpenChange={setSettlementOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl border-0">
          <DialogHeader><DialogTitle className="text-lg font-semibold">结算阶段管理</DialogTitle></DialogHeader>
          {settlementOpen && (
            <SettlementStagesManager
              projectId={localProject.id}
              stages={localProject.settlement_stages || 1}
              existingStages={existingSettlements}
              projectValue={localProject.value || null}
              onStagesChange={async () => {
                try {
                  const settlements = await getSettlementStages(localProject.id)
                  setExistingSettlements(settlements)
                } catch { toast.error('数据刷新失败') }
              }}
              onClose={() => setSettlementOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
