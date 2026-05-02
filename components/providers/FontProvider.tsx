'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { getUserSettings } from '@/lib/supabase/queries'

interface FontContextType {
  fontFamily: string
  fontSize: number
}

const FontContext = createContext<FontContextType>({
  fontFamily: 'Inter',
  fontSize: 14
})

function getLocalFontSettings(): { fontFamily: string; fontSize: number } {
  try {
    const raw = localStorage.getItem('fontSettings')
    if (raw) {
      const f = JSON.parse(raw)
      return {
        fontFamily: f.fontFamily || 'Inter',
        fontSize: f.fontSize || 14,
      }
    }
  } catch {}
  return { fontFamily: 'Inter', fontSize: 14 }
}

function applyFontSettings(font: string, size: number) {
  document.documentElement.style.fontFamily = font
  document.documentElement.style.fontSize = `${size}px`
}

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [fontFamily, setFontFamily] = useState('Inter')
  const [fontSize, setFontSize] = useState(14)

  useEffect(() => {
    // 立即从 localStorage 应用，避免闪烁；layout.tsx 内联 script 在无缓存时不会设 fontFamily，这里补齐
    const local = getLocalFontSettings()
    setFontFamily(local.fontFamily)
    setFontSize(local.fontSize)
    applyFontSettings(local.fontFamily, local.fontSize)

    // 再从数据库同步最新值，仅在与本地不一致时才重排，避免无谓的样式抖动
    getUserSettings().then(settings => {
      if (!settings) return
      const font = settings.font_family || 'Inter'
      const size = settings.font_size || 14
      if (font === local.fontFamily && size === local.fontSize) return
      setFontFamily(font)
      setFontSize(size)
      applyFontSettings(font, size)
      localStorage.setItem('fontSettings', JSON.stringify({ fontFamily: font, fontSize: size }))
    }).catch(() => {})
  }, [])

  return (
    <FontContext.Provider value={{ fontFamily, fontSize }}>
      {children}
    </FontContext.Provider>
  )
}

export const useFont = () => useContext(FontContext)
