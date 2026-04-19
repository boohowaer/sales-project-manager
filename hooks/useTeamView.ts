'use client'
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'team_view_mode'

export type ViewMode = 'mine' | 'team'

export function useTeamView() {
  const [viewMode, setViewMode] = useState<ViewMode>('mine')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'team') setViewMode('team')
  }, [])

  function toggle() {
    setViewMode(prev => {
      const next: ViewMode = prev === 'mine' ? 'team' : 'mine'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }

  return { viewMode, toggle }
}
