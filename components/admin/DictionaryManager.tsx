'use client'
import { useState, Fragment } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, ChevronDown, ChevronRight, Trash2, Upload, X, AlertTriangle, Pencil, Users, FolderKanban } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { DictionaryEntry } from '@/lib/supabase/admin-queries'
import { ImportDialog } from '@/components/import/ImportDialog'
import { SearchableSelect } from '@/components/ui/searchable-select'

// 模块和字段配置（前端硬编码，与数据库同步）
const MODULES = [
  {
    key: 'customer',
    label: '客户信息',
    icon: Users,
    fields: [
      { key: 'company', label: '公司名称', cascade: false },
      { key: 'customer_source', label: '客户来源', cascade: true },
    ]
  },
  {
    key: 'project',
    label: '项目信息',
    icon: FolderKanban,
    fields: [
      { key: 'industry', label: '行业归属', cascade: true },
      { key: 'project_status', label: '项目状态', cascade: false },
    ]
  },
]

interface FieldConfig {
  key: string
  label: string
  cascade: boolean
}

export function DictionaryManager({ entries, onUpdate }: {
  entries: DictionaryEntry[]
  onUpdate: () => void
}) {
  const [activeModule, setActiveModule] = useState(MODULES[0].key)
  const [activeField, setActiveField] = useState<FieldConfig>(MODULES[0].fields[0])
  const [newLabel, setNewLabel] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newParentId, setNewParentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id?: string; ids?: string[]; key: string; affected: number; alreadyDeleted?: boolean } | null>(null)
  const [editEntry, setEditEntry] = useState<{ id: string; key: string; label: string; originalKey: string } | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [assignParentEntry, setAssignParentEntry] = useState<{ id: string; label: string; currentParentId: string | null } | null>(null)
  const [assignTargetParentId, setAssignTargetParentId] = useState<string>('')
  const [assignSaving, setAssignSaving] = useState(false)

  // 获取当前字段的条目
  const filtered = entries.filter(e => e.field_key === activeField.key || e.category === activeField.key)
  const parentEntries = filtered.filter(e => !e.parent_id || e.level === 1)
  const getChildEntries = (parentId: string) => filtered.filter(e => e.parent_id === parentId)

  const toggleParent = (id: string) => {
    const newExpanded = new Set(expandedParents)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedParents(newExpanded)
  }

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.filter(e => e.is_active).length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.filter(e => e.is_active).map(e => e.id)))
    }
  }

  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  async function handleAdd() {
    if (!newLabel || !newKey) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: activeField.key,
          key: newKey,
          label: newLabel,
          sort_order: filtered.length,
          module: activeModule,
          field_key: activeField.key,
          parent_id: newParentId,
          level: newParentId ? 2 : 1,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '添加失败')
      }
      toast.success('添加成功')
      setNewLabel('')
      setNewKey('')
      setNewParentId(null)
      onUpdate()
    } catch (error: any) {
      toast.error(error.message || '添加失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/admin/dictionary/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    })
    onUpdate()
  }

  async function handleDeleteClick(entry: DictionaryEntry) {
    const res = await fetch(`/api/admin/dictionary/${entry.id}`, { method: 'DELETE' })
    if (res.status === 409) {
      const data = await res.json()
      setDeleteConfirm({ id: entry.id, key: entry.label, affected: data.affected })
      return
    }
    if (res.ok) {
      // 无引用也弹确认弹窗，标记已删除
      setDeleteConfirm({ id: entry.id, key: entry.label, affected: 0, alreadyDeleted: true })
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return
    if (deleteConfirm.ids) {
      await fetch('/api/admin/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batch_delete', ids: deleteConfirm.ids }),
      })
      setSelectedIds(new Set())
    } else if (!deleteConfirm.alreadyDeleted) {
      await fetch(`/api/admin/dictionary/${deleteConfirm.id}?force=true`, { method: 'DELETE' })
    }
    toast.success('删除成功')
    setDeleteConfirm(null)
    onUpdate()
  }

  async function handleEditSave() {
    if (!editEntry) return
    if (!editEntry.key.trim() || !editEntry.label.trim()) {
      toast.error('key 和显示名称不能为空')
      return
    }
    setEditSaving(true)
    try {
      const payload: { label: string; key?: string } = { label: editEntry.label }
      if (editEntry.key !== editEntry.originalKey) {
        payload.key = editEntry.key
      }
      const res = await fetch(`/api/admin/dictionary/${editEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '保存失败')
      }
      toast.success('保存成功')
      setEditEntry(null)
      onUpdate()
    } catch (error: any) {
      toast.error(error.message || '保存失败')
    } finally {
      setEditSaving(false)
    }
  }

  function openAssignParent(entry: DictionaryEntry) {
    setAssignParentEntry({ id: entry.id, label: entry.label, currentParentId: entry.parent_id })
    setAssignTargetParentId(entry.parent_id || '')
  }

  async function handleAssignParent() {
    if (!assignParentEntry || !assignTargetParentId) return
    if (assignTargetParentId === assignParentEntry.id) {
      toast.error('不能将选项设为自己的子级')
      return
    }
    setAssignSaving(true)
    try {
      const res = await fetch(`/api/admin/dictionary/${assignParentEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: assignTargetParentId, level: 2 }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '操作失败')
      }
      toast.success('归属已更新')
      setAssignParentEntry(null)
      setAssignTargetParentId('')
      onUpdate()
    } catch (error: any) {
      toast.error(error.message || '操作失败')
    } finally {
      setAssignSaving(false)
    }
  }

  async function handleBatchAction(action: 'enable' | 'disable' | 'delete') {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)

    if (action === 'delete') {
      setDeleteConfirm({ ids, key: `${ids.length} 个选项`, affected: -1 })
      return
    }

    await fetch('/api/admin/dictionary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'batch', ids, updates: { is_active: action === 'enable' } }),
    })

    toast.success(action === 'enable' ? '批量启用成功' : '批量禁用成功')
    setSelectedIds(new Set())
    onUpdate()
  }

  return (
    <div className="flex gap-6">
      {/* 左侧：模块分类树 */}
      <div className="w-64 shrink-0">
        <Card className="rounded-2xl shadow-sm border-0 bg-white sticky top-6">
          <CardContent className="p-3">
            <div className="px-3 pt-1 pb-3 mb-3 border-b border-zinc-100">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">分类</p>
            </div>
            {MODULES.map(mod => {
              const ModIcon = mod.icon
              const moduleActive = activeModule === mod.key
              return (
                <div key={mod.key} className="mb-2 last:mb-0">
                  <div
                    onClick={() => {
                      setActiveModule(mod.key)
                      setActiveField(mod.fields[0])
                      setSelectedIds(new Set())
                    }}
                    className={`group flex items-center gap-2.5 px-3 py-2 rounded-full cursor-pointer transition-all duration-200 ${
                      moduleActive
                        ? 'bg-zinc-900 text-white shadow-sm'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                    }`}
                  >
                    <ModIcon className={`w-4 h-4 shrink-0 transition-colors ${moduleActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-600'}`} />
                    <span className="text-sm font-medium">{mod.label}</span>
                  </div>
                  {moduleActive && (
                    <div className="relative mt-1 ml-[18px] pl-3.5 py-0.5 border-l border-zinc-200 space-y-0.5">
                      {mod.fields.map(field => {
                        const fieldActive = activeField.key === field.key
                        return (
                          <div
                            key={field.key}
                            onClick={() => {
                              setActiveField(field)
                              setSelectedIds(new Set())
                            }}
                            className={`relative px-3 py-1.5 rounded-lg cursor-pointer text-sm transition-all duration-200 ${
                              fieldActive
                                ? 'bg-zinc-100 text-zinc-900 font-medium'
                                : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
                            }`}
                          >
                            {field.label}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* 右侧：选项列表 */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">{activeField.label}</h2>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleBatchAction('enable')} className="rounded-full">
                  启用 ({selectedIds.size})
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBatchAction('disable')} className="rounded-full">
                  禁用 ({selectedIds.size})
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBatchAction('delete')} className="rounded-full text-rose-500 hover:text-rose-600">
                  删除 ({selectedIds.size})
                </Button>
              </>
            )}
            <Button size="sm" onClick={() => setImportDialogOpen(true)} className="shadow-sm">
              <Upload className="w-4 h-4 mr-2" />
              批量导入
            </Button>
          </div>
        </div>

        <Card className="rounded-2xl shadow-sm border-0 bg-white overflow-hidden">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-white border-b border-zinc-200">
                <tr>
                  <th className="px-4 py-3 text-left align-middle whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedIds.size === filtered.filter(e => e.is_active).length}
                        onCheckedChange={handleSelectAll}
                      />
                      <span className="text-xs font-semibold text-zinc-500">全选</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right whitespace-nowrap w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-12 text-center text-zinc-400 text-sm">暂无数据，在下方添加第一条</td>
                  </tr>
                )}
                {parentEntries.map(entry => (
                  <Fragment key={entry.id}>
                    <tr className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {activeField.cascade && getChildEntries(entry.id).length > 0 && (
                            <button onClick={() => toggleParent(entry.id)} className="p-0.5 hover:bg-zinc-100 rounded">
                              {expandedParents.has(entry.id) ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                            </button>
                          )}
                          {!activeField.cascade && <div className="w-5" />}
                          <Checkbox
                            checked={selectedIds.has(entry.id)}
                            onCheckedChange={() => handleSelect(entry.id)}
                            disabled={!entry.is_active}
                          />
                          <span className="text-zinc-900">{entry.label}</span>
                          <span className="text-xs text-zinc-400">({entry.key})</span>
                          {!entry.is_active && (
                            <Badge className="rounded-full text-xs bg-zinc-100 text-zinc-500 border border-zinc-200">已禁用</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          {activeField.cascade && (
                            <Button variant="ghost" size="sm" onClick={() => { setNewParentId(entry.id); setNewLabel(''); setNewKey(''); }}
                              className="h-8 text-xs rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100">
                              <Plus className="w-3 h-3 mr-1" />
                              添加子级
                            </Button>
                          )}
                          {activeField.cascade && getChildEntries(entry.id).length === 0 && parentEntries.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => openAssignParent(entry)}
                              className="h-8 text-xs rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100">
                              设为子级
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleToggle(entry.id, entry.is_active)}
                            className="h-8 text-xs rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100">
                            {entry.is_active ? '禁用' : '启用'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditEntry({ id: entry.id, key: entry.key, label: entry.label, originalKey: entry.key })}
                            className="h-8 w-8 text-xs rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(entry)}
                            className="h-8 w-8 text-xs rounded-full text-zinc-400 hover:text-rose-500 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {/* 子级 */}
                    {activeField.cascade && expandedParents.has(entry.id) && getChildEntries(entry.id).map(child => (
                      <tr key={child.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 pl-16">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-px bg-zinc-200" />
                            <Checkbox
                              checked={selectedIds.has(child.id)}
                              onCheckedChange={() => handleSelect(child.id)}
                              disabled={!child.is_active}
                            />
                            <span className="text-zinc-700">{child.label}</span>
                            <span className="text-xs text-zinc-400">({child.key})</span>
                            {!child.is_active && (
                              <Badge className="rounded-full text-xs bg-zinc-100 text-zinc-500 border border-zinc-200">已禁用</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1 justify-end">
                            {parentEntries.length > 1 && (
                              <Button variant="ghost" size="sm" onClick={() => openAssignParent(child)}
                                className="h-7 text-xs rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100">
                                改归属
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleToggle(child.id, child.is_active)}
                              className="h-7 text-xs rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100">
                              {child.is_active ? '禁用' : '启用'}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditEntry({ id: child.id, key: child.key, label: child.label, originalKey: child.key })}
                              className="h-7 w-7 text-xs rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(child)}
                              className="h-7 w-7 text-xs rounded-full text-zinc-400 hover:text-rose-500 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* 添加选项 */}
        <div className="flex gap-2 pt-4 items-center">
          {newParentId && (
            <Badge className="rounded-full bg-zinc-100 text-zinc-600 pr-1">
              添加到: {filtered.find(e => e.id === newParentId)?.label}
              <button onClick={() => setNewParentId(null)} className="ml-1 hover:text-zinc-900">
                <X className="w-3.5 h-3.5" />
              </button>
            </Badge>
          )}
          <Input placeholder="key（英文）" value={newKey} onChange={e => setNewKey(e.target.value)} className="w-40 rounded-full border-zinc-200 focus:border-zinc-400" />
          <Input placeholder="显示名称" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="flex-1 rounded-full border-zinc-200 focus:border-zinc-400" />
          <Button onClick={handleAdd} disabled={loading || !newLabel || !newKey} className="rounded-full bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm">
            <Plus className="w-4 h-4 mr-1" />
            添加{newParentId ? '子级' : ''}
          </Button>
        </div>
      </div>

      {/* 导入弹窗 */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportSuccess={onUpdate}
        type="dictionary"
        title={`批量导入 - ${activeField.label}`}
        description="从CSV或Excel文件批量导入字典选项，请先下载模板并按照格式填写数据"
        templateLinks={[
          { label: '下载CSV模板', url: '/templates/dictionary_template.csv' },
          { label: '下载Excel模板', url: '/templates/dictionary_template.xlsx' }
        ]}
        endpoint="/api/admin/dictionary/import"
        extraParams={{
          category: activeField.key,
          module: activeModule,
          field_key: activeField.key
        }}
      />

      {/* 编辑弹窗 */}
      <Dialog open={!!editEntry} onOpenChange={() => setEditEntry(null)}>
        <DialogContent className="max-w-md rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">编辑选项</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1.5 block">key（英文）</label>
              <Input
                value={editEntry?.key || ''}
                onChange={e => setEditEntry(editEntry ? { ...editEntry, key: e.target.value } : null)}
                placeholder="key"
                className="rounded-full border-zinc-200 focus:border-zinc-400"
              />
              {editEntry && editEntry.key !== editEntry.originalKey && (
                <p className="text-xs text-amber-600 mt-1.5">⚠️ 修改 key 会同步更新所有引用该选项的数据</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1.5 block">显示名称</label>
              <Input
                value={editEntry?.label || ''}
                onChange={e => setEditEntry(editEntry ? { ...editEntry, label: e.target.value } : null)}
                placeholder="显示名称"
                className="rounded-full border-zinc-200 focus:border-zinc-400"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditEntry(null)} disabled={editSaving}>取消</Button>
            <Button onClick={handleEditSave} disabled={editSaving} className="bg-zinc-900 text-white hover:bg-zinc-800">
              {editSaving ? '保存中…' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 设为子级 / 改归属弹窗 */}
      <Dialog open={!!assignParentEntry} onOpenChange={(o) => { if (!o) { setAssignParentEntry(null); setAssignTargetParentId('') } }}>
        <DialogContent className="max-w-md rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {assignParentEntry?.currentParentId ? '改归属' : '设为子级'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-zinc-600">
              将「<span className="font-medium text-zinc-900">{assignParentEntry?.label}</span>」设为以下父级的子级：
            </p>
            <SearchableSelect
              value={assignTargetParentId}
              onChange={setAssignTargetParentId}
              options={parentEntries
                .filter(e => e.id !== assignParentEntry?.id && e.is_active)
                .map(e => ({ id: e.id, name: e.label }))}
              placeholder="选择父级选项"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setAssignParentEntry(null); setAssignTargetParentId('') }} disabled={assignSaving}>取消</Button>
            <Button onClick={handleAssignParent} disabled={assignSaving || !assignTargetParentId || assignTargetParentId === assignParentEntry?.currentParentId}
              className="bg-zinc-900 text-white hover:bg-zinc-800">
              {assignSaving ? '保存中…' : '确认'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-md rounded-2xl shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              确认删除
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {deleteConfirm?.affected === -1 ? (
              <>
                <p className="text-sm text-zinc-600 mb-2">
                  即将删除已选中的 <strong>「{deleteConfirm?.key}」</strong>。
                </p>
                <p className="text-sm text-zinc-500">
                  其中部分选项可能正在被数据引用，删除后相关数据的对应字段将显示为空，且无法恢复。请确认后再操作。
                </p>
              </>
            ) : deleteConfirm?.affected === 0 ? (
              <>
                <p className="text-sm text-zinc-600 mb-2">
                  当前没有数据在使用选项 <strong>「{deleteConfirm?.key}」</strong>。
                </p>
                <p className="text-sm text-zinc-500">
                  删除后，该选项将从字典中移除，且无法恢复。请确认后再操作。
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-zinc-600 mb-2">
                  当前有 <strong className="text-amber-600">{deleteConfirm?.affected}</strong> 条数据正在使用选项 <strong>「{deleteConfirm?.key}」</strong>。
                </p>
                <p className="text-sm text-zinc-500">
                  删除后，这些数据对应字段的选项将显示为空，且无法恢复。请确认后再操作。
                </p>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>取消</Button>
            <Button onClick={handleDeleteConfirm} className="bg-rose-500 hover:bg-rose-600 text-white">确认删除</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
