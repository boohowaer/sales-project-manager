'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { getUserSettings } from '@/lib/supabase/queries'

interface FontContextType {
  fontFamily: string
  fontSize: number
}

const FontContext = createContext<FontContextType>({
  fontFamily: 'Poppins, Inter',
  fontSize: 15
})

function getLocalFontSettings(): { fontFamily: string; fontSize: number } {
  try {
    const raw = localStorage.getItem('fontSettings')
    if (raw) {
      const f = JSON.parse(raw)
      return {
        fontFamily: f.fontFamily || 'Poppins, Inter',
        fontSize: f.fontSize || 15,
      }
    }
  } catch {}
  return { fontFamily: 'Poppins, Inter', fontSize: 15 }
}

function applyFontSettings(font: string, size: number) {
  document.documentElement.style.fontFamily = font
  document.documentElement.style.fontSize = `${size}px`
}

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [fontFamily, setFontFamily] = useState('Poppins, Inter')
  const [fontSize, setFontSize] = useState(15)

  useEffect(() => {
    // 立即从 localStorage 应用，避免闪烁
    const local = getLocalFontSettings()
    setFontFamily(local.fontFamily)
    setFontSize(local.fontSize)
    applyFontSettings(local.fontFamily, local.fontSize)

    // 再从数据库同步最新值
    getUserSettings().then(settings => {
      if (!settings) return
      const font = settings.font_family || 'Poppins, Inter'
      const size = settings.font_size || 15
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
