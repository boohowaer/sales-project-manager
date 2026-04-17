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
  const [fontFamily, setFontFamily] = useState('Poppins, Inter')
  const [fontSize, setFontSize] = useState(15)
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderAdvanceHours, setReminderAdvanceHours] = useState(24)
  const [milestoneReminderDays, setMilestoneReminderDays] = useState(7)
  const [salesGoal, setSalesGoal] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  // 字体预览 - 保存后生效，避免拖动滑杆时页面抖动
  useEffect(() => {
    if (!loading) {
      document.documentElement.style.fontFamily = fontFamily
      document.documentElement.style.fontSize = `${fontSize}px`
    }
  }, [loading])

  const loadSettings = async () => {
    try {
      const settings = await getUserSettings()
      if (settings) {
        setFontFamily(settings.font_family)
        setFontSize(settings.font_size)
        setReminderEnabled(settings.reminder_enabled)
        setReminderAdvanceHours(settings.reminder_advance_hours)
        setMilestoneReminderDays(settings.milestone_reminder_days ?? 7)
        setSalesGoal(settings.sales_goal ? settings.sales_goal.toString() : '')
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
        reminder_enabled: reminderEnabled,
        reminder_advance_hours: reminderAdvanceHours,
        milestone_reminder_days: milestoneReminderDays,
        sales_goal: salesGoal ? parseFloat(salesGoal) : null
      })
      toast.success('设置保存成功')
      // 保存成功后应用字体设置并更新缓存
      document.documentElement.style.fontFamily = fontFamily
      document.documentElement.style.fontSize = `${fontSize}px`
      localStorage.setItem('fontSettings', JSON.stringify({ fontFamily, fontSize }))
    } catch (error: any) {
      toast.error(error.message || '保存设置失败')
    } finally {
      setSaving(false)
    }
  }

  const fonts = [
    { value: 'Poppins, Inter', label: 'Poppins（西文）+ 系统默认（中文）' },
    { value: 'Inter', label: 'Inter（西文）+ 系统默认（中文）' },
    { value: 'system-ui', label: '系统字体（自动匹配）' },
    { value: 'sans-serif', label: '无衬线字体' },
    { value: 'serif', label: '衬线字体' },
    { value: 'monospace', label: '等宽字体' }
  ]

  // 加载时显示骨架屏
  if (loading) {
    return (
      <div className="p-8 max-w-4xl">
        {/* 页面标题骨架屏 */}
        <div className="mb-8">
          <div className="h-9 w-20 bg-zinc-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-zinc-100 rounded animate-pulse mt-3" />
        </div>
        {/* 销售目标设定骨架屏 */}
        <div className="mb-6">
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader>
              <div className="h-6 w-32 bg-zinc-200 rounded animate-pulse" />
              <div className="h-4 w-64 bg-zinc-100 rounded animate-pulse mt-2" />
            </CardHeader>
            <CardContent>
              <div className="h-10 w-full bg-zinc-100 rounded-lg animate-pulse" />
            </CardContent>
          </Card>
        </div>
        {/* 外观设置骨架屏 */}
        <div className="mb-6">
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader>
              <div className="h-6 w-32 bg-zinc-200 rounded animate-pulse" />
              <div className="h-4 w-48 bg-zinc-100 rounded animate-pulse mt-2" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="h-10 w-full bg-zinc-100 rounded animate-pulse" />
              <div className="h-10 w-full bg-zinc-100 rounded animate-pulse" />
              <div className="h-10 w-full bg-zinc-100 rounded animate-pulse" />
            </CardContent>
          </Card>
        </div>
        {/* 提醒设置骨架屏 */}
        <Card className="rounded-2xl shadow-sm border-0 bg-white">
          <CardHeader>
            <div className="h-6 w-32 bg-zinc-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-zinc-100 rounded animate-pulse mt-2" />
          </CardHeader>
          <CardContent>
            <div className="h-6 w-32 bg-zinc-100 rounded animate-pulse" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">设置</h1>
        <p className="mt-2 text-zinc-500 text-sm">自定义您的应用体验</p>
      </div>

      <div className="space-y-6">
          {/* 销售目标设定 */}
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">销售目标设定</CardTitle>
              <CardDescription className="text-sm text-zinc-500">设置您的销售目标，用于在仪表板中显示达成进度</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="sales-goal" className="text-sm font-medium text-zinc-700">销售目标（元）</Label>
                <Input
                  id="sales-goal"
                  type="number"
                  value={salesGoal}
                  onChange={(e) => setSalesGoal(e.target.value)}
                  placeholder="例如：1000000"
                  className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
            </CardContent>
          </Card>

          {/* 外观设置 */}
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">外观设置</CardTitle>
              <CardDescription className="text-sm text-zinc-500">自定义应用的字体</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="font-family" className="text-sm font-medium text-zinc-700">字体</Label>
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger id="font-family" className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400">
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
                <p className="text-sm text-zinc-500 mt-2" style={{ fontFamily }}>
                  预览：这是预览文本，The quick brown fox jumps over the lazy dog. 快速的棕色狐狸跳过懒惰的狗。
                </p>
              </div>

              <div>
                <Label htmlFor="font-size" className="text-sm font-medium text-zinc-700">字体大小：{fontSize}px</Label>
                <Input
                  id="font-size"
                  type="range"
                  min="12"
                  max="20"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="mt-2 border-0"
                />
                <div className="flex justify-between text-sm text-zinc-500 mt-2">
                  <span>12px（小）</span>
                  <span>16px（标准）</span>
                  <span>20px（大）</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 提醒设置 */}
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">提醒设置</CardTitle>
              <CardDescription className="text-sm text-zinc-500">配置任务和项目提醒</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="reminder-enabled" className="text-sm font-medium text-zinc-700">启用提醒</Label>
                  <p className="text-sm text-zinc-500 mt-1">
                    在首页信息提醒中显示即将到期的关注节点和任务
                  </p>
                </div>
                <input
                  id="reminder-enabled"
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                />
              </div>

              {reminderEnabled && (
                <>
                  <div>
                    <Label htmlFor="reminder-advance" className="text-sm font-medium text-zinc-700">任务提醒时间范围</Label>
                    <Select value={reminderAdvanceHours.toString()} onValueChange={(v) => setReminderAdvanceHours(parseInt(v))}>
                      <SelectTrigger id="reminder-advance" className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400">
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
                    <p className="text-sm text-zinc-500 mt-2">
                      在任务到期前多久显示提醒
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="milestone-reminder" className="text-sm font-medium text-zinc-700">关注节点提醒范围</Label>
                    <Select value={milestoneReminderDays.toString()} onValueChange={(v) => setMilestoneReminderDays(parseInt(v))}>
                      <SelectTrigger id="milestone-reminder" className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1天内</SelectItem>
                        <SelectItem value="3">3天内</SelectItem>
                        <SelectItem value="7">7天内</SelectItem>
                        <SelectItem value="14">2周内</SelectItem>
                        <SelectItem value="28">4周内</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-zinc-500 mt-2">
                      信息提醒面板中显示多少天内的项目关注节点
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full">
              {saving ? '保存中...' : '保存设置'}
            </Button>
          </div>
        </div>
    </div>
  )
}
