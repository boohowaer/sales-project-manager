'use client'
import { useEffect, useState, useCallback } from 'react'
import { DictionaryManager } from '@/components/admin/DictionaryManager'
import { PageLoading } from '@/components/ui/page-loading'
import type { DictionaryEntry } from '@/lib/supabase/admin-queries'

export default function DictionaryPage() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([])
  const [loading, setLoading] = useState(true)

  const loadEntries = useCallback(async () => {
    const res = await fetch('/api/admin/dictionary')
    if (res.ok) setEntries(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { loadEntries() }, [loadEntries])

  if (loading) return <PageLoading variant="two-column" />

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">数据字典</h1>
            <p className="mt-2 text-zinc-500 text-sm">管理系统中的下拉选项与分类数据</p>
          </div>
        </div>
      </div>
      <DictionaryManager entries={entries} onUpdate={loadEntries} />
    </div>
  )
}
