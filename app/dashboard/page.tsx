'use client'

import { useState, useEffect } from 'react'
import { getDashboardStats, getProjects, getUserSettings, getSettlementStagesBatch } from '@/lib/supabase/queries'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Clock, AlertCircle, TrendingUp, FileCheck, Receipt, DollarSign, ArrowRight, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTasks } from '@/context/TasksContext'
import Link from 'next/link'
import { toast } from 'react-hot-toast'

function CircularProgress({ pct }: { pct: number }) {
  const size = 140
  const r = 54
  const circ = 2 * Math.PI * r
  const arcLength = 0.75 * circ
  const filled = Math.min(pct / 100, 1) * arcLength
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(135deg)' }} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4e4e7" strokeWidth="9"
          strokeLinecap="round" strokeDasharray={`${arcLength} ${circ - arcLength}`} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#18181b" strokeWidth="9"
          strokeLinecap="round" strokeDasharray={`${filled} ${circ - filled}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold text-zinc-900 leading-none">{pct}%</span>
        <span className="text-[10px] text-zinc-400 mt-1">达成率</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [userSettings, setUserSettings] = useState<any>(null)
  const [monthlyProjects, setMonthlyProjects] = useState<{
    toSign: any[], toAccept: any[], toInvoice: any[]
  }>({ toSign: [], toAccept: [], toInvoice: [] })
  const [loading, setLoading] = useState(true)
  const { overdueTasks, upcomingTasks } = useTasks()

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const [statsData, projectsData, settingsData] = await Promise.all([
        getDashboardStats(), getProjects(), getUserSettings(),
      ])
      setStats(statsData)
      setUserSettings(settingsData)

      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const future30 = new Date(today)
      future30.setDate(future30.getDate() + 30)
      future30.setHours(23, 59, 59)
      const projectIds = projectsData.map((p: any) => p.id)
      const settlementsMap = await getSettlementStagesBatch(projectIds)

      const toSign = projectsData.filter((p: any) => {
        if (!p.expected_close_date || p.contract_signed || p.has_start_notice) return false
        const d = new Date(p.expected_close_date)
        return d <= future30
      })

      const toAccept: any[] = []
      const toInvoice: any[] = []
      projectsData.forEach((p: any) => {
        const stages = settlementsMap.get(p.id) || []
        const acc = stages.filter((s: any) => {
          if (s.accepted || !s.planned_accepted_date) return false
          const d = new Date(s.planned_accepted_date)
          return d <= future30
        })
        if (acc.length > 0) toAccept.push({ ...p, pendingStages: acc })
        const inv = stages.filter((s: any) => {
          if (s.invoiced || !s.planned_invoiced_date) return false
          const d = new Date(s.planned_invoiced_date)
          return d <= future30
        })
        if (inv.length > 0) toInvoice.push({ ...p, pendingStages: inv })
      })
      setMonthlyProjects({ toSign, toAccept, toInvoice })
    } catch (error: any) {
      toast.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const salesGoal = userSettings?.sales_goal || 0
  const pct = (val: number) => salesGoal > 0 ? Math.min(100, Math.round((val / salesGoal) * 100)) : null
  const now = new Date()
  const monthName = `${now.getMonth() + 1}月`
  const thisWeekTasks = [...overdueTasks, ...upcomingTasks]
  const pendingThisWeek = thisWeekTasks.length

  if (loading || !stats) {
    return <div className="p-8"><div className="text-center py-20 text-zinc-400 text-sm">加载中...</div></div>
  }

  const metrics = [
    { label: '项目总价值', displayValue: `¥${(stats.totalValue || 0).toLocaleString()}`, pct: pct(stats.totalValue || 0), desc: '本年度所有项目', icon: <TrendingUp className="w-4 h-4" />, monthly: stats.monthlyTotalValue || 0 },
    { label: '预期收入', displayValue: `¥${(stats.expectedValue || 0).toLocaleString()}`, pct: pct(stats.expectedValue || 0), desc: '按概率加权', icon: <TrendingUp className="w-4 h-4" />, tooltip: true, monthly: stats.monthlyExpectedValue || 0 },
    { label: '已签约', displayValue: `¥${(stats.signedWithStart || 0).toLocaleString()}`, pct: pct(stats.signedWithStart || 0), desc: '含合同 & 开工函', icon: <FileCheck className="w-4 h-4" />, monthly: stats.monthlySigned || 0 },
    { label: '已验收', displayValue: `¥${(stats.acceptedAmount || 0).toLocaleString()}`, pct: pct(stats.acceptedAmount || 0), desc: '基于结算段', icon: <CheckCircle className="w-4 h-4" />, monthly: stats.monthlyAccepted || 0 },
    { label: '已开票', displayValue: `¥${(stats.invoicedAmount || 0).toLocaleString()}`, pct: pct(stats.invoicedAmount || 0), desc: '基于结算段', icon: <Receipt className="w-4 h-4" />, monthly: stats.monthlyInvoiced || 0 },
    { label: '已回款', displayValue: `¥${(stats.paidAmount || 0).toLocaleString()}`, pct: pct(stats.paidAmount || 0), desc: '基于结算段', icon: <DollarSign className="w-4 h-4" />, monthly: stats.monthlyPaid || 0 },
  ]

  return (
    <div className="p-8 max-w-[1600px]">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">仪表板</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          {now.getFullYear()}年 · {salesGoal > 0 ? `年度目标 ¥${salesGoal.toLocaleString()}` : '未设置年度目标'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {metrics.map((m) => (
          <Card key={m.label} className="rounded-2xl border-0 bg-white shadow-sm overflow-visible">
            <CardContent className="px-4 pt-4 pb-1 flex items-center gap-4 overflow-visible">
              {m.pct !== null && (
                <div className="shrink-0 -my-1">
                  <CircularProgress pct={m.pct} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{m.label}</span>
                  <span className="text-zinc-300">{m.icon}</span>
                </div>
                <div className="text-2xl font-semibold text-zinc-900 tracking-tight leading-none mb-1">
                  {m.displayValue}
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-400 mb-1">
                  {m.desc}
                  {m.tooltip && (
                    <div className="relative group">
                      <Info className="w-3 h-3 text-zinc-300 cursor-help" />
                      <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-zinc-900 text-white text-xs rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <p className="font-medium mb-1.5">预期收入（Expected Revenue）</p>
                        <p className="text-zinc-300">基于项目成功概率的加权预期收入。计算公式：Σ(项目价值 × 成功概率%)</p>
                        <p className="text-zinc-400 mt-2">例如：¥100万项目 × 50%概率 = ¥50万预期收入</p>
                        <div className="absolute -top-1.5 left-4 w-2.5 h-2.5 bg-zinc-900 transform rotate-45"></div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-zinc-400">
                  本月新增 <span className="text-zinc-600 font-medium">{m.monthly > 0 ? `¥${Math.round(m.monthly).toLocaleString()}` : '-'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-6">
        <div className="space-y-5">
          <h2 className="text-base font-semibold text-zinc-900">
            未来30天关注节点
            <span className="text-xs font-normal text-zinc-400 ml-1.5">& 已逾期节点</span>
          </h2>

          {/* 计划签约 */}
          <Card className="rounded-2xl border-0 bg-white shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-700">计划签约</span>
                  <Badge variant="secondary" className="text-xs px-2 py-0 rounded-full">{monthlyProjects.toSign.length}</Badge>
                </div>
                <Link href="/dashboard/projects" className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1">
                  查看全部 <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {monthlyProjects.toSign.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-zinc-400">暂无计划签约项目</div>
              ) : (
                <div className="divide-y divide-zinc-50">
                  {monthlyProjects.toSign.map((p: any) => {
                    const isOverdue = p.expected_close_date && new Date(p.expected_close_date) < new Date(new Date().toDateString())
                    return (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 truncate">{p.name}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">{p.customers?.name}</p>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          {p.value && <p className="text-sm font-medium text-zinc-700">¥{p.value.toLocaleString()}</p>}
                          {p.expected_close_date && (
                            <p className={`text-xs ${isOverdue ? 'text-rose-400' : 'text-zinc-400'}`}>
                              {new Date(p.expected_close_date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 计划验收 */}
          <Card className="rounded-2xl border-0 bg-white shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-700">计划验收</span>
                  <Badge variant="secondary" className="text-xs px-2 py-0 rounded-full">{monthlyProjects.toAccept.length}</Badge>
                </div>
                <Link href="/dashboard/updates" className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1">
                  查看进展 <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {monthlyProjects.toAccept.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-zinc-400">暂无计划验收项目</div>
              ) : (
                <div className="divide-y divide-zinc-50">
                  {monthlyProjects.toAccept.map((p: any) => {
                    const isOverdue = new Date(p.pendingStages[0].planned_accepted_date) < new Date(new Date().toDateString())
                    return (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 truncate">{p.name}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">{p.customers?.name}</p>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <p className="text-xs text-zinc-500">{p.pendingStages.length} 段待验收</p>
                          <p className={`text-xs ${isOverdue ? 'text-rose-400' : 'text-zinc-400'}`}>
                            {new Date(p.pendingStages[0].planned_accepted_date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 计划开票 */}
          <Card className="rounded-2xl border-0 bg-white shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-700">计划开票</span>
                  <Badge variant="secondary" className="text-xs px-2 py-0 rounded-full">{monthlyProjects.toInvoice.length}</Badge>
                </div>
              </div>
              {monthlyProjects.toInvoice.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-zinc-400">暂无计划开票项目</div>
              ) : (
                <div className="divide-y divide-zinc-50">
                  {monthlyProjects.toInvoice.map((p: any) => {
                    const isOverdue = new Date(p.pendingStages[0].planned_invoiced_date) < new Date(new Date().toDateString())
                    return (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 truncate">{p.name}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">{p.customers?.name}</p>
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <p className="text-xs text-zinc-500">{p.pendingStages.length} 段待开票</p>
                          <p className={`text-xs ${isOverdue ? 'text-rose-400' : 'text-zinc-400'}`}>
                            {new Date(p.pendingStages[0].planned_invoiced_date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 本周任务 */}
        <div className="space-y-5">
          <h2 className="text-base font-semibold text-zinc-900">
            本周任务
            <span className="text-xs font-normal text-zinc-400 ml-1.5">& 已逾期任务</span>
          </h2>
          <Card className="rounded-2xl border-0 bg-white shadow-sm">
            <CardContent className="p-0">
              <div className="grid grid-cols-2 divide-x divide-zinc-100 border-b border-zinc-100">
                <div className="px-5 py-4 text-center">
                  <p className="text-2xl font-semibold text-zinc-900">{pendingThisWeek}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">待完成</p>
                </div>
                <div className="px-5 py-4 text-center">
                  <p className="text-2xl font-semibold text-zinc-900">{overdueTasks.length}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">已逾期</p>
                </div>
              </div>
              {thisWeekTasks.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-zinc-400">本周暂无待办任务</div>
              ) : (
                <div className="divide-y divide-zinc-50 max-h-[460px] overflow-y-auto">
                  {overdueTasks.map((task: any) => (
                    <div key={task.id} className="flex items-start gap-3 px-5 py-3 hover:bg-zinc-50 transition-colors">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-800 truncate">{task.title}</p>
                        <p className="text-xs text-zinc-400 mt-0.5 truncate">{task.projects?.name}</p>
                      </div>
                      <span className="text-xs text-rose-400 shrink-0">
                        {new Date(task.due_date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                  {upcomingTasks.map((task: any) => (
                    <div key={task.id} className="flex items-start gap-3 px-5 py-3 hover:bg-zinc-50 transition-colors">
                      <Clock className="w-3.5 h-3.5 text-zinc-300 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-700 truncate">{task.title}</p>
                        <p className="text-xs text-zinc-400 mt-0.5 truncate">{task.projects?.name}</p>
                      </div>
                      <span className="text-xs text-zinc-400 shrink-0">
                        {new Date(task.due_date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {thisWeekTasks.length > 0 && (
                <div className="px-5 py-3 border-t border-zinc-100">
                  <Link href="/dashboard/tasks" className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1">
                    查看全部任务 <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
