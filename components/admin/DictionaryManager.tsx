'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { DictionaryEntry } from '@/lib/supabase/admin-queries'

const CATEGORIES = [
  { key: 'customer_source', label: '客户来源' },
  { key: 'industry', label: '行业分类' },
  { key: 'project_stage', label: '项目阶段' },
]

export function DictionaryManager({ entries, onUpdate }: {
  entries: DictionaryEntry[]
  onUpdate: () => void
}) {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].key)
  const [newLabel, setNewLabel] = useState('')
  const [newKey, setNewKey] = useState('')
  const [loading, setLoading] = useState(false)

  const filtered = entries.filter(e => e.category === activeCategory)

  async function handleAdd() {
    if (!newLabel || !newKey) return
    setLoading(true)
    await fetch('/api/admin/dictionary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: activeCategory,
        key: newKey,
        label: newLabel,
        sort_order: filtered.length,
      }),
    })
    setNewLabel('')
    setNewKey('')
    setLoading(false)
    onUpdate()
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/admin/dictionary/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !isActive }),
    })
    onUpdate()
  }

  async function handleDelete(id: string) {
    if (!confirm('确认删除？历史数据中的该选项将保留显示。')) return
    await fetch(`/api/admin/dictionary/${id}`, { method: 'DELETE' })
    onUpdate()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {CATEGORIES.map(c => (
          <Button
            key={c.key}
            variant={activeCategory === c.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(c.key)}
          >
            {c.label}
          </Button>
        ))}
      </div>

      <div className="rounded-md border divide-y">
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">暂无数据</p>
        )}
        {filtered.map(entry => (
          <div key={entry.id} className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">{entry.label}</span>
              <span className="text-xs text-muted-foreground">({entry.key})</span>
              {!entry.is_active && <Badge variant="secondary">已禁用</Badge>}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleToggle(entry.id, entry.is_active)}>
                {entry.is_active ? '禁用' : '启用'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)}>
                删除
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input placeholder="key（英文）" value={newKey} onChange={e => setNewKey(e.target.value)} className="w-40" />
        <Input placeholder="显示名称" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
        <Button onClick={handleAdd} disabled={loading || !newLabel || !newKey}>添加</Button>
      </div>
    </div>
  )
}
