'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getDashboardData } from '@/lib/supabase/queries'
import { readPageCache, writePageCache } from '@/lib/page-cache'
import { PageLoading } from '@/components/ui/page-loading'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Clock, AlertCircle, TrendingUp, FileCheck, Receipt, DollarSign, ArrowRight, Info, FolderKanban, CheckSquare, FileEdit, Bell, X, ClipboardCheck, UserCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTasks } from '@/context/TasksContext'
import Link from 'next/link'
import { toast } from 'react-hot-toast'

const ProjectDetailModal = dynamic(() => import('@/components/projects/ProjectDetailModal').then(m => ({ default: m.ProjectDetailModal })), { ssr: false })

function CircularProgress({ pct, size: propSize }: { pct: number; size?: number }) {
  const size = propSize ?? 160
  const r = 62
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

const EMPTY_GROUPS = { toSign: [] as any[], toAccept: [] as any[], toInvoice: [] as any[], toPayment: [] as any[] }

type DashboardCache = { stats: any; projects: any[] }

export default function DashboardPage() {
  const router = useRouter()
  // 缓存读取放到 useEffect 中执行，避免 SSR/CSR 初始 state 不一致引发 hydration mismatch
  const [stats, setStats] = useState<any>(null)
  const [projectsData, setProjectsData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const hadCacheRef = useRef(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [activeGoalLine, setActiveGoalLine] = useState<'base' | 'goal' | 'stretch'>('goal')
  const { overdueTasks, upcomingTasks, thisWeekTasks, pendingApprovals, myPendingApprovals, pendingMembers, userSettings, loading: tasksLoading } = useTasks()
  const upcomingTaskIds = new Set(upcomingTasks.map((t: any) => t.id))

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    if (notifOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen])

  const loadDataRef = useRef<() => void>(() => {})

  useEffect(() => {
    loadDataRef.current = loadData
  })

  useEffect(() => {
    // 客户端读缓存：有则立即填充以避免骨架屏闪烁
    const cached = readPageCache<DashboardCache>('dashboard')
    if (cached) {
      hadCacheRef.current = true
      setStats(cached.stats)
      setProjectsData(cached.projects)
      setLoading(false)
    }
    loadData()
  }, [])

  useEffect(() => {
    const handler = () => loadDataRef.current()
    window.addEventListener('refresh-bell', handler)
    return () => window.removeEventListener('refresh-bell', handler)
  }, [])

  const loadData = async () => {
    try {
      const data = await getDashboardData()
      setStats(data.stats)
      setProjectsData(data.projects)
      writePageCache('dashboard', { stats: data.stats, projects: data.projects })
    } catch (error: any) {
      // 仅在没有缓存可显示时才提示加载失败
      if (!hadCacheRef.current) toast.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const buildProjectGroups = (projects: any[], cutoff: Date) => {
    const toSign = projects.filter((p: any) => {
      if (!p.expected_close_date || p.contract_signed) return false
      return new Date(p.expected_close_date) <= cutoff
    })
    const toAccept: any[] = [], toInvoice: any[] = [], toPayment: any[] = []
    projects.forEach((p: any) => {
      const stages = p._settlements || []
      const acc = stages.filter((s: any) => !s.accepted && s.planned_accepted_date && new Date(s.planned_accepted_date) <= cutoff)
      if (acc.length > 0) toAccept.push({ ...p, pendingStages: acc })
      const inv = stages.filter((s: any) => !s.invoiced && s.planned_invoiced_date && new Date(s.planned_invoiced_date) <= cutoff)
      if (inv.length > 0) toInvoice.push({ ...p, pendingStages: inv })
      const pay = stages.filter((s: any) => !s.paid && s.planned_paid_date && new Date(s.planned_paid_date) <= cutoff)
      if (pay.length > 0) toPayment.push({ ...p, pendingStages: pay })
    })
    return {
      toSign: toSign.sort((a: any, b: any) => new Date(a.expected_close_date).getTime() - new Date(b.expected_close_date).getTime()),
      toAccept: toAccept.sort((a: any, b: any) => new Date(a.pendingStages[0].planned_accepted_date).getTime() - new Date(b.pendingStages[0].planned_accepted_date).getTime()),
      toInvoice: toInvoice.sort((a: any, b: any) => new Date(a.pendingStages[0].planned_invoiced_date).getTime() - new Date(b.pendingStages[0].planned_invoiced_date).getTime()),
      toPayment: toPayment.sort((a: any, b: any) => new Date(a.pendingStages[0].planned_paid_date).getTime() - new Date(b.pendingStages[0].planned_paid_date).getTime()),
    }
  }

  const monthlyProjects = useMemo(() => {
    if (projectsData.length === 0) return EMPTY_GROUPS
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const future30 = new Date(today)
    future30.setDate(future30.getDate() + 30)
    future30.setHours(23, 59, 59)
    return buildProjectGroups(projectsData, future30)
  }, [projectsData])

  const notifProjects = useMemo(() => {
    if (projectsData.length === 0) return EMPTY_GROUPS
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const notifDays = userSettings?.milestone_reminder_days ?? 7
    const futureNotif = new Date(today)
    futureNotif.setDate(futureNotif.getDate() + notifDays)
    futureNotif.setHours(23, 59, 59)
    return buildProjectGroups(projectsData, futureNotif)
  }, [projectsData, userSettings])

  const salesGoal = userSettings?.sales_goal || 0
  const salesGoalBase = userSettings?.sales_goal_base || 0
  const salesGoalStretch = userSettings?.sales_goal_stretch || 0
  const hasAnyGoal = salesGoal > 0 || salesGoalBase > 0 || salesGoalStretch > 0
  const activeGoalValue = activeGoalLine === 'base' ? salesGoalBase : activeGoalLine === 'stretch' ? salesGoalStretch : salesGoal
  const pct = (val: number) => activeGoalValue > 0 ? Math.min(100, Math.round((val / activeGoalValue) * 100)) : null

  const handleQuickAction = (action: string) => {
    if (action === 'createProject') {
      sessionStorage.setItem('openProjectDialog', 'true')
      router.push('/dashboard/projects')
    } else if (action === 'addTask') {
      sessionStorage.setItem('openTaskDialog', 'true')
      router.push('/dashboard/tasks')
    } else if (action === 'updateProgress') {
      router.push('/dashboard/updates')
    }
  }

  const now = new Date()
  const monthName = `${now.getMonth() + 1}月`
  const pendingThisWeek = overdueTasks.length + thisWeekTasks.length

  // 等 stats 与 tasks 数据都到位后再退出骨架，避免圆形进度环和本周任务卡片晚于其他元素出现
  if (loading || !stats || tasksLoading) {
    return <PageLoading variant="grid" />
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
    <div className="p-4 md:p-8 max-w-[1600px]">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 tracking-tight">仪表板</h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            {now.getFullYear()}年 · {hasAnyGoal ? (
              <>
                {salesGoalBase > 0 && <span>保底 ¥{salesGoalBase.toLocaleString()}</span>}
                {salesGoalBase > 0 && (salesGoal > 0 || salesGoalStretch > 0) && <span className="mx-1.5 text-zinc-500">·</span>}
                {salesGoal > 0 && <span>常规 ¥{salesGoal.toLocaleString()}</span>}
                {salesGoal > 0 && salesGoalStretch > 0 && <span className="mx-1.5 text-zinc-500">·</span>}
                {salesGoalStretch > 0 && <span>冲刺 ¥{salesGoalStretch.toLocaleString()}</span>}
              </>
            ) : '未设置年度目标'}
          </p>
        </div>
        <div className="flex items-center gap-1 md:-translate-y-1 z-50 relative">
          <button
            onClick={() => handleQuickAction('createProject')}
            title="创建项目"
            className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-zinc-900 transition-colors group"
          >
            <FolderKanban className="w-5 h-5 text-zinc-600 group-hover:text-white" />
          </button>
          <button
            onClick={() => handleQuickAction('addTask')}
            title="添加任务"
            className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-zinc-900 transition-colors group"
          >
            <CheckSquare className="w-5 h-5 text-zinc-600 group-hover:text-white" />
          </button>
          <button
            onClick={() => handleQuickAction('updateProgress')}
            title="更新进展"
            className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-zinc-900 transition-colors group"
          >
            <FileEdit className="w-5 h-5 text-zinc-600 group-hover:text-white" />
          </button>
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              title="任务提醒"
              className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-zinc-900 transition-colors group"
            >
              <Bell className="w-5 h-5 text-zinc-600 group-hover:text-white" />
              {(notifProjects.toSign.length + notifProjects.toAccept.length + notifProjects.toInvoice.length + notifProjects.toPayment.length + overdueTasks.length + upcomingTasks.length + pendingApprovals.length + myPendingApprovals.length + pendingMembers.length) > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 max-h-[480px] overflow-y-auto bg-white rounded-2xl shadow-xl border-0 z-[100]">
                <div className="p-2 pt-6">
                  {(notifProjects.toSign.length + notifProjects.toAccept.length + notifProjects.toInvoice.length + notifProjects.toPayment.length + overdueTasks.length + upcomingTasks.length + pendingApprovals.length + myPendingApprovals.length + pendingMembers.length) === 0 ? (
                    <div className="p-6 text-center">
                      <CheckCircle className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                      <p className="text-sm text-zinc-500">暂无待处理提醒</p>
                    </div>
                  ) : (
                    <>
                      {/* 待我审批 */}
                      {pendingApprovals.length > 0 && (
                        <div className="mb-2">
                          <div className="flex items-center gap-1.5 px-3 py-2">
                            <ClipboardCheck className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-xs font-medium text-blue-600">待我审批</span>
                            <span className="text-xs text-zinc-400">({pendingApprovals.length})</span>
                          </div>
                          {pendingApprovals.map((req: any) => (
                            <Link key={req.id} href="/dashboard/approvals" onClick={() => setNotifOpen(false)}>
                              <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer">
                                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-zinc-900 truncate">{{ create_customer: '新建客户', create_project: '新建项目', update_project: '修改项目' }[req.type as string] ?? req.type}</p>
                                  <p className="text-xs text-zinc-500 mt-0.5 truncate">{req.payload?.name ?? ''}</p>
                                  <p className="text-xs text-blue-500 mt-1">等待你审批</p>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                      {/* 我提交的审批流程中 */}
                      {myPendingApprovals.length > 0 && (
                        <div className="mb-2">
                          <div className="flex items-center gap-1.5 px-3 py-2">
                            <ClipboardCheck className="w-3.5 h-3.5 text-zinc-400" />
                            <span className="text-xs font-medium text-zinc-500">我提交的审批</span>
                            <span className="text-xs text-zinc-400">({myPendingApprovals.length})</span>
                          </div>
                          {myPendingApprovals.map((req: any) => (
                            <Link key={req.id} href="/dashboard/approvals" onClick={() => setNotifOpen(false)}>
                              <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors cursor-pointer">
                                <div className="w-2 h-2 rounded-full bg-zinc-400 mt-1.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-zinc-900 truncate">{{ create_customer: '新建客户', create_project: '新建项目', update_project: '修改项目' }[req.type as string] ?? req.type}</p>
                                  <p className="text-xs text-zinc-500 mt-0.5 truncate">{req.payload?.name ?? ''}</p>
                                  <p className="text-xs text-zinc-400 mt-1">等待 {{ 1: '销售经理', 2: '超级管理员' }[req.current_step as number] ?? `第${req.current_step}步`} 审批</p>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                      {/* 成员申请（仅 super_admin） */}
                      {pendingMembers.length > 0 && (
                        <div className="mb-2">
                          <div className="flex items-center gap-1.5 px-3 py-2">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-xs font-medium text-emerald-600">成员申请</span>
                            <span className="text-xs text-zinc-400">({pendingMembers.length})</span>
                          </div>
                          {pendingMembers.map((m: any) => (
                            <Link key={m.id} href="/dashboard/admin/users" onClick={() => setNotifOpen(false)}>
                              <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-emerald-50 transition-colors cursor-pointer">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-zinc-900 truncate">{m.email}</p>
                                  <p className="text-xs text-emerald-600 mt-1">申请加入团队</p>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                      {(overdueTasks.length > 0 || upcomingTasks.length > 0) && (
                        <div className="mb-2">
                          {overdueTasks.length > 0 && (
                            <>
                              <div className="flex items-center gap-1.5 px-3 py-2">
                                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                <span className="text-xs font-medium text-red-600">任务已过期</span>
                                <span className="text-xs text-zinc-400">({overdueTasks.length})</span>
                              </div>
                              {overdueTasks.map((task: any) => (
                                <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-red-50 transition-colors">
                                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 truncate">{task.title}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">{task.projects?.name}</p>
                                    <p className="text-xs text-red-500 mt-1">{task.due_date ? new Date(task.due_date).toLocaleDateString('zh-CN') : '无日期'} 已过期</p>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                          {upcomingTasks.length > 0 && (
                            <>
                              <div className="flex items-center gap-1.5 px-3 py-2">
                                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                                <span className="text-xs font-medium text-zinc-600">任务即将到期</span>
                                <span className="text-xs text-zinc-400">({upcomingTasks.length})</span>
                              </div>
                              {upcomingTasks.map((task: any) => (
                                <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors">
                                  <div className="w-2 h-2 rounded-full bg-zinc-300 mt-1.5 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-zinc-900 truncate">{task.title}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">{task.projects?.name}</p>
                                    <p className="text-xs text-zinc-400 mt-1">{task.due_date ? new Date(task.due_date).toLocaleDateString('zh-CN') : '无日期'} 到期</p>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                      {notifProjects.toSign.length > 0 && (
                        <div className="mb-2">
                          <div className="flex items-center gap-1.5 px-3 py-2">
                            <FileCheck className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-xs font-medium text-blue-600">签约提醒</span>
                            <span className="text-xs text-zinc-400">({notifProjects.toSign.length})</span>
                          </div>
                          {notifProjects.toSign.map((p: any) => {
                            const isOverdue = p.expected_close_date && new Date(p.expected_close_date) < new Date(new Date().toDateString())
                            return (
                              <div key={p.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors">
                                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-zinc-900 truncate">{p.name}</p>
                                  <p className="text-xs text-zinc-500 mt-0.5">{p.customers?.name}</p>
                                  {p.expected_close_date && (
                                    <p className={`text-xs mt-1 ${isOverdue ? 'text-red-500' : 'text-zinc-400'}`}>
                                      {new Date(p.expected_close_date).toLocaleDateString('zh-CN')} {isOverdue ? '已逾期' : '计划签约'}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {notifProjects.toAccept.length > 0 && (
                        <div className="mb-2">
                          <div className="flex items-center gap-1.5 px-3 py-2">
                            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs font-medium text-green-600">验收提醒</span>
                            <span className="text-xs text-zinc-400">({notifProjects.toAccept.length})</span>
                          </div>
                          {notifProjects.toAccept.map((p: any) => {
                            const isOverdue = new Date(p.pendingStages[0].planned_accepted_date) < new Date(new Date().toDateString())
                            return (
                              <div key={p.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-green-50 transition-colors">
                                <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-zinc-900 truncate">{p.name}</p>
                                  <p className="text-xs text-zinc-500 mt-0.5">{p.customers?.name} · {p.pendingStages.length} 段</p>
                                  <p className={`text-xs mt-1 ${isOverdue ? 'text-red-500' : 'text-zinc-400'}`}>
                                    {new Date(p.pendingStages[0].planned_accepted_date).toLocaleDateString('zh-CN')} {isOverdue ? '已逾期' : '计划验收'}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {notifProjects.toInvoice.length > 0 && (
                        <div className="mb-2">
                          <div className="flex items-center gap-1.5 px-3 py-2">
                            <Receipt className="w-3.5 h-3.5 text-purple-500" />
                            <span className="text-xs font-medium text-purple-600">开票提醒</span>
                            <span className="text-xs text-zinc-400">({notifProjects.toInvoice.length})</span>
                          </div>
                          {notifProjects.toInvoice.map((p: any) => {
                            const isOverdue = new Date(p.pendingStages[0].planned_invoiced_date) < new Date(new Date().toDateString())
                            return (
                              <div key={p.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-purple-50 transition-colors">
                                <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-zinc-900 truncate">{p.name}</p>
                                  <p className="text-xs text-zinc-500 mt-0.5">{p.customers?.name} · {p.pendingStages.length} 段</p>
                                  <p className={`text-xs mt-1 ${isOverdue ? 'text-red-500' : 'text-zinc-400'}`}>
                                    {new Date(p.pendingStages[0].planned_invoiced_date).toLocaleDateString('zh-CN')} {isOverdue ? '已逾期' : '计划开票'}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {notifProjects.toPayment.length > 0 && (
                        <div className="mb-2">
                          <div className="flex items-center gap-1.5 px-3 py-2">
                            <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-xs font-medium text-amber-600">回款提醒</span>
                            <span className="text-xs text-zinc-400">({notifProjects.toPayment.length})</span>
                          </div>
                          {notifProjects.toPayment.map((p: any) => {
                            const isOverdue = new Date(p.pendingStages[0].planned_paid_date) < new Date(new Date().toDateString())
                            return (
                              <div key={p.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-amber-50 transition-colors">
                                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-zinc-900 truncate">{p.name}</p>
                                  <p className="text-xs text-zinc-500 mt-0.5">{p.customers?.name} · {p.pendingStages.length} 段</p>
                                  <p className={`text-xs mt-1 ${isOverdue ? 'text-red-500' : 'text-zinc-400'}`}>
                                    {new Date(p.pendingStages[0].planned_paid_date).toLocaleDateString('zh-CN')} {isOverdue ? '已逾期' : '计划回款'}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {metrics.map((m) => (
          <Card key={m.label} className="rounded-2xl border-0 bg-white shadow-sm overflow-visible transition-shadow duration-300 hover:shadow-md relative">
            {(salesGoalBase > 0 || salesGoal > 0 || salesGoalStretch > 0) && (
              <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
                {salesGoalBase > 0 && <button onClick={() => setActiveGoalLine('base')} title="保底线" className="w-3 h-3 rounded-full transition-all hover:opacity-80" style={{ background: activeGoalLine === 'base' ? '#d4d4d8' : 'transparent', border: activeGoalLine === 'base' ? 'none' : '1px solid #d4d4d8', boxSizing: 'border-box' }} />}
                {salesGoal > 0 && <button onClick={() => setActiveGoalLine('goal')} title="常规线" className="w-3 h-3 rounded-full transition-all hover:opacity-80" style={{ background: activeGoalLine === 'goal' ? '#71717a' : 'transparent', border: activeGoalLine === 'goal' ? 'none' : '1px solid #71717a', boxSizing: 'border-box' }} />}
                {salesGoalStretch > 0 && <button onClick={() => setActiveGoalLine('stretch')} title="冲刺线" className="w-3 h-3 rounded-full transition-all hover:opacity-80" style={{ background: activeGoalLine === 'stretch' ? '#090702' : 'transparent', border: activeGoalLine === 'stretch' ? 'none' : '1px solid #090702', boxSizing: 'border-box' }} />}
              </div>
            )}
            <CardContent className="px-4 pt-4 !pb-0 flex items-center gap-1 overflow-visible min-h-[160px]">
              {m.pct !== null && (
                <div className="shrink-0 -my-1 hidden sm:block">
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
                      <div className="absolute left-0 top-full mt-2 w-72 bg-zinc-900 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50" style={{ marginLeft: '-6px' }}>
                        <div className="absolute -top-1.5 left-[6px] w-3 h-3 bg-zinc-900" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></div>
                        <div className="p-3 text-white text-xs">
                          <p className="font-medium mb-1.5">预期收入（Expected Revenue）</p>
                          <p className="text-zinc-300">基于项目成功概率的加权预期收入。计算公式：Σ(项目价值 × 成功概率%)</p>
                          <p className="text-zinc-400 mt-2">例如：¥100万项目 × 50%概率 = ¥50万预期收入</p>
                        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-5">
          <h2 className="text-base font-semibold text-zinc-900">
            未来30天关注节点
            <span className="text-xs font-normal text-zinc-400 ml-1.5">& 已逾期节点</span>
          </h2>

          {/* 计划签约 */}
          <Card className="rounded-2xl border-0 bg-white shadow-sm overflow-hidden">
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
                          <button
                            onClick={() => setSelectedProject(p)}
                            className="text-sm font-medium text-zinc-800 truncate block text-left hover:underline underline-offset-2 decoration-zinc-400 transition-all"
                          >{p.name}</button>
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
          <Card className="rounded-2xl border-0 bg-white shadow-sm overflow-hidden">
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
                          <button
                            onClick={() => setSelectedProject(p)}
                            className="text-sm font-medium text-zinc-800 truncate block text-left hover:underline underline-offset-2 decoration-zinc-400 transition-all"
                          >{p.name}</button>
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
          <Card className="rounded-2xl border-0 bg-white shadow-sm overflow-hidden">
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
                          <button
                            onClick={() => setSelectedProject(p)}
                            className="text-sm font-medium text-zinc-800 truncate block text-left hover:underline underline-offset-2 decoration-zinc-400 transition-all"
                          >{p.name}</button>
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
          <Card className="rounded-2xl border-0 bg-white shadow-sm overflow-hidden">
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
              {thisWeekTasks.length === 0 && overdueTasks.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-zinc-400">本周暂无待办任务</div>
              ) : (
                <div className="divide-y divide-zinc-50">
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
                  {thisWeekTasks.map((task: any) => {
                    const isUpcoming = upcomingTaskIds.has(task.id)
                    return (
                      <div key={task.id} className="flex items-start gap-3 px-5 py-3 hover:bg-zinc-50 transition-colors">
                        {isUpcoming
                          ? <Clock className="w-3.5 h-3.5 text-zinc-300 mt-0.5 shrink-0" />
                          : <span className="w-3.5 shrink-0" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-700 truncate">{task.title}</p>
                          <p className="text-xs text-zinc-400 mt-0.5 truncate">{task.projects?.name}</p>
                        </div>
                        <span className="text-xs text-zinc-400 shrink-0">
                          {new Date(task.due_date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                        </span>
                      </div>
                    )
                  })}
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

      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          open={true}
          onClose={() => setSelectedProject(null)}
          onUpdated={updated => {
            setProjectsData(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
            setSelectedProject(null)
          }}
        />
      )}
    </div>
  )
}
