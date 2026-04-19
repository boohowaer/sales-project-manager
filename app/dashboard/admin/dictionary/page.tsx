'use client'
import { useEffect, useState, useCallback } from 'react'
import { DictionaryManager } from '@/components/admin/DictionaryManager'
import type { DictionaryEntry } from '@/lib/supabase/admin-queries'

export default function DictionaryPage() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([])

  const loadEntries = useCallback(async () => {
    const res = await fetch('/api/admin/dictionary')
    if (res.ok) setEntries(await res.json())
  }, [])

  useEffect(() => { loadEntries() }, [loadEntries])

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">数据字典</h1>
      <DictionaryManager entries={entries} onUpdate={loadEntries} />
    </div>
  )
}
