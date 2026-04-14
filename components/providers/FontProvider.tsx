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
  fontSize: 14
})

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [fontFamily, setFontFamily] = useState('Inter')
  const [fontSize, setFontSize] = useState(14)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const loadFontSettings = async () => {
      try {
        const settings = await getUserSettings()
        if (settings) {
          setFontFamily(settings.font_family)
          setFontSize(settings.font_size)

          // 应用到根元素
          document.documentElement.style.fontFamily = settings.font_family
          document.documentElement.style.fontSize = `${settings.font_size}px`
        }
      } catch (error) {
        console.error('加载字体设置失败:', error)
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
