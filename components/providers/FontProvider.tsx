'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { getUserSettings } from '@/lib/supabase/queries'
import type { UserSettings } from '@/types'

interface FontContextType {
  fontFamily: string
  fontSize: number
}

const FontContext = createContext<FontContextType>({
  fontFamily: 'Poppins, Inter',
  fontSize: 15
})

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [fontFamily, setFontFamily] = useState('Poppins, Inter')
  const [fontSize, setFontSize] = useState(15)
  const [loaded, setLoaded] = useState(false)

  // 应用字体到文档
  const applyFontSettings = (font: string, size: number) => {
    // 移除所有默认的字体样式，让用户设置完全生效
    document.documentElement.style.removeProperty('--font-poppins')
    document.documentElement.style.fontFamily = font
    document.documentElement.style.fontSize = `${size}px`
  }

  useEffect(() => {
    const loadFontSettings = async () => {
      try {
        const settings = await getUserSettings()
        if (settings) {
          const font = settings.font_family || 'Poppins, Inter'
          const size = settings.font_size || 15

          setFontFamily(font)
          setFontSize(size)

          // 应用到根元素并缓存到 localStorage
          applyFontSettings(font, size)
          localStorage.setItem('fontSettings', JSON.stringify({ fontFamily: font, fontSize: size }))
        }
      } catch (error) {
        console.error('加载字体设置失败:', error)
        applyFontSettings('Poppins, Inter', 15)
      } finally {
        setLoaded(true)
      }
    }

    loadFontSettings()
  }, [])

  // 在加载前不渲染内容，避免字体闪烁
  if (!loaded) {
    return <>{children}</>
  }

  return (
    <FontContext.Provider value={{ fontFamily, fontSize }}>
      {children}
    </FontContext.Provider>
  )
}

export const useFont = () => useContext(FontContext)
