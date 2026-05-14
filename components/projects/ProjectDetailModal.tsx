'use client'
import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { DatePicker } from '@/components/ui/date-picker'
import { Pencil, Coins, Info } from 'lucide-react'
import { getCustomers, updateProject, getSettlementStages } from '@/lib/supabase/queries'
import { SettlementStagesManager } from '@/components/projects/SettlementStagesManager'
import { DictSelect } from '@/components/ui/dict-select'
import { toast } from 'react-hot-toast'
import { useUser } from '@/context/UserContext'
import { useDictionaries } from '@/context/DictionaryContext'

const getStatusTextColor = (s: string) => {
  switch (s) {
    case 'won': return 'text-emerald-600'
    case 'lost': return 'text-red-500'
    case 'on_hold': return 'text-zinc-500'
    case 'archived': return 'text-zinc-400'
    default: return 'text-zinc-900'
  }
}

const getSettlementTagColor = (count: number, total: number) => {
  if (count === total) return 'bg-emerald-100 text-emerald-700'
  return 'bg-amber-100 text-amber-700'
}

const EMPTY_FORM = {
  name: '',
  description: '',
  customer_id: '',
  status: 'active',
  value: '',
  probability: 50,
  start_date: '',
  expected_close_date: '',
  signed_at: '',
  has_start_notice: false,
  contract_signed: false,
  settlement_stages: 1,
  belong_year: '',
  customer_source: '',
  industry: ''
}

interface Props {
  project: any
  open: boolean
  onClose: () => void
  onUpdated: (updated: any) => void
  onDeleted?: (id: string) => void
  projectStatusOptions?: { key: string; label: string }[]
}

export function ProjectDetailModal({ project, open, onClose, onUpdated, onDeleted, projectStatusOptions: externalStatusOptions }: Props) {
  const me = useUser()
  const isSalesRep = me?.role === 'sales_rep'
  const [localProject, setLocalProject] = useState<any>(project)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [formData, setFormData] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Settlement dialog
  const [settlementOpen, setSettlementOpen] = useState(false)
  const [existingSettlements, setExistingSettlements] = useState<any[]>([])

  // 字典数据来自全局 DictionaryContext（按需加载 + 跨页缓存）
  const dicts = useDictionaries(['customer_source', 'industry', 'project_status'])
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
  const customerSourceOptions = useMemo(() => buildCascade(dicts.customer_source || []), [dicts.customer_source])
  const industryOptions = useMemo(() => buildCascade(dicts.industry || []), [dicts.industry])
  const projectStatusOptions = useMemo(
    () => (dicts.project_status || []).filter(e => e.is_active).map(e => ({ key: e.key, label: e.label })),
    [dicts.project_status]
  )

  // 使用传入的或本地加载的状态选项
  const statusOptions = externalStatusOptions || projectStatusOptions

  // 状态默认映射（字典加载完成前的 fallback）
  const statusDefaultLabels: Record<string, string> = {
    active: '跟进中',
    won: '已成交',
    lost: '已丢失',
    on_hold: '暂停',
    archived: '已归档'
  }

  // 获取状态标签文本
  const getStatusText = (s: string) => {
    const found = statusOptions.find(o => o.key === s)
    return found ? found.label : (statusDefaultLabels[s] || s)
  }

  useEffect(() => { setLocalProject(project) }, [project])

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
      customer_source: localProject.customer_source || '',
      industry: localProject.industry || '',
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
        customer_source: formData.customer_source || null,
        industry: formData.industry || null,
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
                <span className={`shrink-0 text-xs font-semibold ${getStatusTextColor(localProject.status)}`}>
                  {getStatusText(localProject.status)}
                </span>
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
        <DialogContent className="max-w-4xl rounded-2xl shadow-xl border-0">
          <DialogHeader><DialogTitle className="text-lg font-semibold">编辑项目</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 px-1">
            {/* 基本信息 */}
            <div>
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">基本信息</div>
              <div className="grid grid-cols-[1.6fr_1.2fr_0.6fr_0.6fr] gap-5">
                <div>
                  <Label className="text-sm font-medium text-zinc-700">项目名称 *</Label>
                  <Input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例如：网站开发项目"
                    className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-zinc-700">客户 *</Label>
                  <DictSelect
                    value={formData.customer_id}
                    onChange={value => setFormData({ ...formData, customer_id: value })}
                    options={customers.map(c => ({ key: c.id, label: c.name, subLabel: c.company || undefined }))}
                    placeholder="搜索选择客户"
                    className="mt-2"
                    showClear={false}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-zinc-700">客户来源</Label>
                  <DictSelect
                    value={formData.customer_source}
                    onChange={value => setFormData({ ...formData, customer_source: value })}
                    options={customerSourceOptions}
                    placeholder="选择客户来源"
                    className="mt-2"
                    cascade
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-zinc-700">行业归属</Label>
                  <DictSelect
                    value={formData.industry}
                    onChange={value => setFormData({ ...formData, industry: value })}
                    options={industryOptions}
                    placeholder="搜索选择行业"
                    className="mt-2"
                    cascade
                  />
                </div>
              </div>
              <div className="mt-4">
                <Label className="text-sm font-medium text-zinc-700">项目描述</Label>
                <Textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="项目的详细信息..."
                  className="mt-2 border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400 resize-none"
                  rows={2}
                />
              </div>
            </div>

            {/* 状态信息 */}
            <div>
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">状态信息</div>
              <div className="grid grid-cols-4 gap-5">
                <div>
                  <Label className="text-sm font-medium text-zinc-700">项目价值（元）</Label>
                  <Input
                    type="number"
                    value={formData.value}
                    onChange={e => setFormData({ ...formData, value: e.target.value })}
                    placeholder="100000"
                    className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-zinc-700">状态</Label>
                  <DictSelect
                    value={formData.status}
                    onChange={value => setFormData({ ...formData, status: value })}
                    options={
                      formData.contract_signed
                        ? statusOptions.filter(o => o.key === 'won' || o.key === 'archived')
                        : statusOptions
                    }
                    placeholder="选择状态"
                    className="mt-2"
                    showClear={false}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-zinc-700">开工函</Label>
                  <div className="flex gap-1.5 mt-2 h-10 items-center">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, has_start_notice: false })}
                      className={`flex-1 h-10 px-3 rounded-full text-xs font-medium transition-colors ${
                        !formData.has_start_notice
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                      }`}
                    >
                      无
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, has_start_notice: true })}
                      className={`flex-1 h-10 px-3 rounded-full text-xs font-medium transition-colors ${
                        formData.has_start_notice
                          ? 'bg-emerald-500 text-white'
                          : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                      }`}
                    >
                      有
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-zinc-700">签署合同</Label>
                  <div className="flex gap-1.5 mt-2 h-10 items-center">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, contract_signed: false })}
                      className={`flex-1 h-10 px-3 rounded-full text-xs font-medium transition-colors ${
                        !formData.contract_signed
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                      }`}
                    >
                      未签
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, contract_signed: true, status: 'won' })}
                      className={`flex-1 h-10 px-3 rounded-full text-xs font-medium transition-colors ${
                        formData.contract_signed
                          ? 'bg-emerald-500 text-white'
                          : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                      }`}
                    >
                      已签
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 时间信息 */}
            <div>
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">时间信息</div>
              <div className="grid grid-cols-4 gap-5">
                <div>
                  <Label className="text-sm font-medium text-zinc-700">归属年份</Label>
                  <Input
                    type="number"
                    min="2000"
                    max="2100"
                    value={formData.belong_year}
                    onChange={e => setFormData({ ...formData, belong_year: e.target.value })}
                    placeholder="2024"
                    className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-zinc-700">开始日期</Label>
                  <DatePicker
                    value={formData.start_date}
                    onChange={v => setFormData({ ...formData, start_date: v })}
                    placeholder="选择开始日期"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-zinc-700">预期成交日期</Label>
                  <DatePicker
                    value={formData.expected_close_date}
                    onChange={v => setFormData({ ...formData, expected_close_date: v })}
                    placeholder="选择预期成交日期"
                    className="mt-2"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-sm font-medium text-zinc-700">成交日期</Label>
                    <div className="relative group">
                      <Info className="w-3 h-3 text-zinc-300 cursor-help" />
                      <div className="absolute left-0 top-full mt-2 w-72 bg-zinc-900 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50" style={{ marginLeft: '-6px' }}>
                        <div className="absolute -top-1.5 left-[6px] w-3 h-3 bg-zinc-900" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></div>
                        <div className="p-3 text-white text-xs">
                          <p className="font-medium mb-1.5">成交日期</p>
                          <p className="text-zinc-300">代表收到开工函或合同签约的日期，用于统计本月新增签约金额。</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DatePicker
                    value={formData.signed_at}
                    onChange={v => setFormData({ ...formData, signed_at: v })}
                    placeholder="选择成交日期"
                    className="mt-2"
                    disabled={!formData.contract_signed && !formData.has_start_notice}
                  />
                </div>
              </div>
            </div>

            {/* 成功概率 */}
            <div>
              <Label className="text-sm font-medium text-zinc-700">成功概率：{formData.probability}%</Label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.probability}
                onChange={e => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })}
                className="w-full h-2 accent-zinc-600 mt-2"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="cancel" onClick={() => setEditOpen(false)}>取消</Button>
              <Button type="submit" disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
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
