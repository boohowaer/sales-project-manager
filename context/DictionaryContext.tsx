'use client'

import { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo, ReactNode } from 'react'

export type DictEntry = {
  id: string
  key: string
  label: string
  category: string
  parent_id: string | null
  level: number
  is_active: boolean
  field_key?: string | null
  module?: string | null
  sort_order?: number
}

interface DictionaryContextType {
  getCategory: (category: string) => DictEntry[]
  ensureCategories: (categories: string[]) => void
  isLoaded: (category: string) => boolean
  refresh: () => void
  reloadCategory: (category: string) => void
}

const DictionaryContext = createContext<DictionaryContextType>({
  getCategory: () => [],
  ensureCategories: () => {},
  isLoaded: () => false,
  refresh: () => {},
  reloadCategory: () => {},
})

export function DictionaryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Map<string, DictEntry[]>>(new Map())
  const loadedRef = useRef<Set<string>>(new Set())
  const inflightRef = useRef<Map<string, Promise<void>>>(new Map())

  const ensureCategories = useCallback((categories: string[]) => {
    const need = categories.filter(c => c && !loadedRef.current.has(c) && !inflightRef.current.has(c))
    if (need.length === 0) return

    const promise = fetch(`/api/admin/dictionary?categories=${encodeURIComponent(need.join(','))}`)
      .then(r => (r.ok ? r.json() : []))
      .then((entries: DictEntry[]) => {
        if (!Array.isArray(entries)) entries = []
        setData(prev => {
          const next = new Map(prev)
          // 先为 need 中每个 category 建空数组（即使返回空也标记已加载）
          for (const c of need) {
            if (!next.has(c)) next.set(c, [])
          }
          for (const e of entries) {
            const arr = next.get(e.category)
            if (arr) arr.push(e)
            else next.set(e.category, [e])
          }
          return next
        })
        for (const c of need) {
          loadedRef.current.add(c)
          inflightRef.current.delete(c)
        }
      })
      .catch(() => {
        for (const c of need) inflightRef.current.delete(c)
      })

    for (const c of need) inflightRef.current.set(c, promise)
  }, [])

  const getCategory = useCallback((category: string) => data.get(category) ?? [], [data])
  const isLoaded = useCallback((category: string) => loadedRef.current.has(category), [])
  const refresh = useCallback(() => {
    loadedRef.current.clear()
    inflightRef.current.clear()
    setData(new Map())
  }, [])

  const reloadCategory = useCallback((category: string) => {
    loadedRef.current.delete(category)
    inflightRef.current.delete(category)
    ensureCategories([category])
  }, [ensureCategories])

  return (
    <DictionaryContext.Provider value={{ getCategory, ensureCategories, isLoaded, refresh, reloadCategory }}>
      {children}
    </DictionaryContext.Provider>
  )
}

export function useDictionary(category: string): DictEntry[] {
  const ctx = useContext(DictionaryContext)
  useEffect(() => {
    ctx.ensureCategories([category])
  }, [category, ctx])
  return ctx.getCategory(category)
}

export function useDictionaries(categories: string[]): Record<string, DictEntry[]> {
  const ctx = useContext(DictionaryContext)
  const key = categories.join(',')
  useEffect(() => {
    ctx.ensureCategories(categories)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ctx])
  return useMemo(() => {
    const out: Record<string, DictEntry[]> = {}
    for (const c of categories) out[c] = ctx.getCategory(c)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ctx.getCategory])
}

export function useDictionaryActions() {
  const ctx = useContext(DictionaryContext)
  return { refresh: ctx.refresh, reloadCategory: ctx.reloadCategory }
}
