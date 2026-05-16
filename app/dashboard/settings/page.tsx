'use client'

import { useState, useEffect } from 'react'
import { getUserSettings, updateUserSettings } from '@/lib/supabase/queries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { PageLoading } from '@/components/ui/page-loading'

export default function SettingsPage() {
  const [fontFamily, setFontFamily] = useState('Poppins, system-ui')
  const [fontSize, setFontSize] = useState(15)
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderAdvanceHours, setReminderAdvanceHours] = useState(24)
  const [milestoneReminderDays, setMilestoneReminderDays] = useState(7)
  const [salesGoal, setSalesGoal] = useState('')
  const [salesGoalBase, setSalesGoalBase] = useState('')
  const [salesGoalStretch, setSalesGoalStretch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' })
  const [pwdSaving, setPwdSaving] = useState(false)

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
        setSalesGoalBase(settings.sales_goal_base ? settings.sales_goal_base.toString() : '')
        setSalesGoalStretch(settings.sales_goal_stretch ? settings.sales_goal_stretch.toString() : '')
      }
    } catch (error: any) {
      toast.error('加载设置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!pwdForm.next || !pwdForm.confirm) {
      toast.error('请填写新密码')
      return
    }
    if (pwdForm.next !== pwdForm.confirm) {
      toast.error('两次输入的新密码不一致')
      return
    }
    if (pwdForm.next.length < 6) {
      toast.error('密码至少6位')
      return
    }
    setPwdSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: pwdForm.next })
      if (error) throw error
      toast.success('密码修改成功')
      setPwdForm({ current: '', next: '', confirm: '' })
    } catch (error: any) {
      toast.error(error.message || '密码修改失败')
    } finally {
      setPwdSaving(false)
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
        sales_goal: salesGoal ? parseFloat(salesGoal) : null,
        sales_goal_base: salesGoalBase ? parseFloat(salesGoalBase) : null,
        sales_goal_stretch: salesGoalStretch ? parseFloat(salesGoalStretch) : null,
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
    { value: 'Poppins, system-ui', label: 'Poppins（西文）+ 系统默认（中文）' },
    { value: 'system-ui', label: '系统字体（自动匹配）' },
    { value: 'sans-serif', label: '无衬线字体' },
    { value: 'serif', label: '衬线字体' },
    { value: 'monospace', label: '等宽字体' }
  ]

  if (loading) return <PageLoading variant="settings" />

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
              <CardDescription className="text-sm text-zinc-500">设置您的销售目标线，用于在仪表板中显示达成进度</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="sales-goal-base" className="text-sm font-medium text-zinc-700">保底线（元）</Label>
                <Input
                  id="sales-goal-base"
                  type="number"
                  value={salesGoalBase}
                  onChange={(e) => setSalesGoalBase(e.target.value)}
                  placeholder="例如：800000"
                  className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
              <div>
                <Label htmlFor="sales-goal" className="text-sm font-medium text-zinc-700">常规线（元）</Label>
                <Input
                  id="sales-goal"
                  type="number"
                  value={salesGoal}
                  onChange={(e) => setSalesGoal(e.target.value)}
                  placeholder="例如：1200000"
                  className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
              <div>
                <Label htmlFor="sales-goal-stretch" className="text-sm font-medium text-zinc-700">冲刺线（元）</Label>
                <Input
                  id="sales-goal-stretch"
                  type="number"
                  value={salesGoalStretch}
                  onChange={(e) => setSalesGoalStretch(e.target.value)}
                  placeholder="例如：1800000"
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
                <div className="relative h-5 text-sm text-zinc-500 mt-2">
                  <span className="absolute left-0">12px（小）</span>
                  <span className="absolute left-[37.5%] -translate-x-1/2">15px（标准）</span>
                  <span className="absolute right-0">20px（大）</span>
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
                <Checkbox
                  id="reminder-enabled"
                  checked={reminderEnabled}
                  onCheckedChange={(checked) => setReminderEnabled(checked as boolean)}
                />
              </div>

              {reminderEnabled && (
                <>
                  <div>
                    <Label htmlFor="reminder-advance" className="text-sm font-medium text-zinc-700">即将到期任务提醒时间</Label>
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
                      任务到期前多久在提醒面板显示
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="milestone-reminder" className="text-sm font-medium text-zinc-700">关注节点提醒</Label>
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
                      节点到期前多少天在提醒面板显示
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 修改密码 */}
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">修改密码</CardTitle>
              <CardDescription className="text-sm text-zinc-500">更新您的登录密码</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-zinc-700">新密码</Label>
                <Input
                  type="password"
                  value={pwdForm.next}
                  onChange={(e) => setPwdForm({ ...pwdForm, next: e.target.value })}
                  placeholder="至少6位"
                  className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-zinc-700">确认新密码</Label>
                <Input
                  type="password"
                  value={pwdForm.confirm}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
                  placeholder="再次输入新密码"
                  className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleChangePassword} disabled={pwdSaving}>
                  {pwdSaving ? '修改中...' : '修改密码'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存设置'}
            </Button>
          </div>
        </div>
    </div>
  )
}
