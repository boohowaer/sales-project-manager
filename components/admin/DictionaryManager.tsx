'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
            className={activeCategory === c.key
              ? 'rounded-full bg-zinc-900 text-white hover:bg-zinc-800'
              : 'rounded-full border-zinc-200 text-zinc-700 hover:bg-zinc-50'}
          >
            {c.label}
          </Button>
        ))}
      </div>

      <Card className="rounded-2xl shadow-sm border-0 bg-white">
        <CardContent className="p-0">
          {filtered.length === 0 && (
            <p className="px-4 py-12 text-sm text-zinc-400 text-center">暂无数据，在下方添加第一条</p>
          )}
          <div className="divide-y divide-zinc-100">
            {filtered.map(entry => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-900">{entry.label}</span>
                  <span className="text-xs text-zinc-400">({entry.key})</span>
                  {!entry.is_active && (
                    <Badge className="rounded-full text-xs bg-zinc-100 text-zinc-500 border border-zinc-200">已禁用</Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleToggle(entry.id, entry.is_active)}
                    className="h-8 text-xs rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100">
                    {entry.is_active ? '禁用' : '启用'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)}
                    className="h-8 text-xs rounded-full text-zinc-400 hover:text-rose-500 hover:bg-red-50">
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 pt-2">
        <Input placeholder="key（英文）" value={newKey} onChange={e => setNewKey(e.target.value)} className="w-40 rounded-full border-zinc-200 focus:border-zinc-400" />
        <Input placeholder="显示名称" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="rounded-full border-zinc-200 focus:border-zinc-400" />
        <Button onClick={handleAdd} disabled={loading || !newLabel || !newKey} className="rounded-full bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm">添加</Button>
      </div>
    </div>
  )
}
