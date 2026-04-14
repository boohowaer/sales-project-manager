'use client'

import { useState, useEffect } from 'react'
import { getUserSettings, updateUserSettings } from '@/lib/supabase/queries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'react-hot-toast'

export default function SettingsPage() {
  const [fontFamily, setFontFamily] = useState('Inter')
  const [fontSize, setFontSize] = useState(14)
  const [theme, setTheme] = useState('light')
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderAdvanceHours, setReminderAdvanceHours] = useState(24)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  // 实时应用字体设置（用于设置页面的即时预览）
  useEffect(() => {
    document.documentElement.style.fontFamily = fontFamily
  }, [fontFamily])

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`
  }, [fontSize])

  const loadSettings = async () => {
    try {
      const settings = await getUserSettings()
      if (settings) {
        setFontFamily(settings.font_family)
        setFontSize(settings.font_size)
        setTheme(settings.theme)
        setReminderEnabled(settings.reminder_enabled)
        setReminderAdvanceHours(settings.reminder_advance_hours)
      }
    } catch (error: any) {
      toast.error('加载设置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateUserSettings({
        font_family: fontFamily,
        font_size: fontSize,
        theme: theme as any,
        reminder_enabled: reminderEnabled,
        reminder_advance_hours: reminderAdvanceHours
      })
      toast.success('设置保存成功')
    } catch (error: any) {
      toast.error(error.message || '保存设置失败')
    } finally {
      setSaving(false)
    }
  }

  const fonts = [
    { value: 'Inter', label: 'Inter（默认）' },
    { value: 'system-ui', label: '系统字体' },
    { value: 'sans-serif', label: '无衬线字体' },
    { value: 'serif', label: '衬线字体' },
    { value: 'monospace', label: '等宽字体' }
  ]

  const themes = [
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
    { value: 'system', label: '跟随系统' }
  ]

  return (
    <div className="p-8 max-w-4xl">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">设置</h1>
        <p className="mt-2 text-gray-600">自定义您的应用体验</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">加载中...</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 外观设置 */}
          <Card>
            <CardHeader>
              <CardTitle>外观设置</CardTitle>
              <CardDescription>自定义应用的字体和主题</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="font-family">字体</Label>
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger id="font-family">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fonts.map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        {font.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-600" style={{ fontFamily }}>
                  预览：这是预览文本，The quick brown fox jumps over the lazy dog. 快速的棕色狐狸跳过懒惰的狗。
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="font-size">字体大小：{fontSize}px</Label>
                <Input
                  id="font-size"
                  type="range"
                  min="12"
                  max="20"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="mt-2"
                />
                <div className="flex justify-between text-sm text-gray-600">
                  <span>12px（小）</span>
                  <span>16px（标准）</span>
                  <span>20px（大）</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">主题</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger id="theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* 提醒设置 */}
          <Card>
            <CardHeader>
              <CardTitle>提醒设置</CardTitle>
              <CardDescription>配置任务和项目提醒</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="reminder-enabled">启用提醒</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    在应用内显示即将到期的任务提醒
                  </p>
                </div>
                <input
                  id="reminder-enabled"
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>

              {reminderEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="reminder-advance">提前提醒时间</Label>
                  <Select value={reminderAdvanceHours.toString()} onValueChange={(v) => setReminderAdvanceHours(parseInt(v))}>
                    <SelectTrigger id="reminder-advance">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1小时前</SelectItem>
                      <SelectItem value="6">6小时前</SelectItem>
                      <SelectItem value="12">12小时前</SelectItem>
                      <SelectItem value="24">1天前</SelectItem>
                      <SelectItem value="48">2天前</SelectItem>
                      <SelectItem value="168">1周前</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-600">
                    在任务到期前多久显示提醒
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存设置'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
