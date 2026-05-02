'use client'
import { useState } from 'react'

const STORAGE_KEY = 'team_view_mode'

export type ViewMode = 'mine' | 'team'

export function useTeamView() {
  // lazy initial state：同步从 localStorage 读取，避免 mount 后 setState 触发依赖此值的 effect 二次运行
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'mine'
    return localStorage.getItem(STORAGE_KEY) === 'team' ? 'team' : 'mine'
  })

  function toggle() {
    setViewMode(prev => {
      const next: ViewMode = prev === 'mine' ? 'team' : 'mine'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }

  return { viewMode, toggle }
}
