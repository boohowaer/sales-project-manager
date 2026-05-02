'use client'

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react'
import { getUpcomingTasks, getUserSettings } from '@/lib/supabase/queries'
import { useUser, useTeamMembers } from '@/context/UserContext'
import type { ApprovalRequest, UserSettings } from '@/types'

interface TaskWithProject {
  id: string
  project_id: string
  title: string
  due_date: string | null
  status: string
  projects?: { name: string } | null
}

interface PendingMember {
  id: string
  email: string
  joined_at: string
}

interface TasksContextType {
  overdueTasks: TaskWithProject[]
  upcomingTasks: TaskWithProject[]
  thisWeekTasks: TaskWithProject[]
  // 待我审批的
  pendingApprovals: ApprovalRequest[]
  // 我提交的还在流程中的
  myPendingApprovals: ApprovalRequest[]
  // 待审核的成员申请（仅 super_admin 可见）
  pendingMembers: PendingMember[]
  role: string | null
  userSettings: UserSettings | null
  loading: boolean
  refresh: () => void
}

const TasksContext = createContext<TasksContextType>({
  overdueTasks: [],
  upcomingTasks: [],
  thisWeekTasks: [],
  pendingApprovals: [],
  myPendingApprovals: [],
  pendingMembers: [],
  role: null,
  userSettings: null,
  loading: true,
  refresh: () => {}
})

export function useTasks() {
  return useContext(TasksContext)
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const me = useUser()
  const { members: allMembers, ensureMembers } = useTeamMembers()
  const [overdueTasks, setOverdueTasks] = useState<TaskWithProject[]>([])
  const [upcomingTasks, setUpcomingTasks] = useState<TaskWithProject[]>([])
  const [thisWeekTasks, setThisWeekTasks] = useState<TaskWithProject[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([])
  const [myPendingApprovals, setMyPendingApprovals] = useState<ApprovalRequest[]>([])
  const [role, setRole] = useState<string | null>(me?.role ?? null)
  const [userSettings, setUserSettingsState] = useState<UserSettings | null>(null)
  const [loading, setLoading] = useState(true)

  // pendingMembers 从全局 members 缓存派生（仅 super_admin 触发加载）
  useEffect(() => {
    if (me?.role === 'super_admin') ensureMembers()
  }, [me?.role, ensureMembers])
  const pendingMembers: PendingMember[] = useMemo(
    () => (me?.role === 'super_admin' ? allMembers.filter(m => m.status === 'pending') as any[] : []),
    [me?.role, allMembers]
  )

  const loadTasks = async () => {
    const userRole = me?.role ?? null
    setRole(userRole)

    // 核心数据：settings + tasks，dashboard 等这两个就够；完成即退出全局 loading
    const corePromise = (async () => {
      try {
        const [settings, data] = await Promise.all([
          getUserSettings(),
          getUpcomingTasks(undefined, 24),
        ])
        setUserSettingsState(settings ?? null)
        setOverdueTasks(data.overdue as TaskWithProject[])
        setUpcomingTasks(data.upcoming as TaskWithProject[])
        setThisWeekTasks(data.thisWeek as TaskWithProject[])

        // 若用户自定义了不同提前小时数，异步重拉一次（不阻塞首屏）
        const reminderHours = settings?.reminder_advance_hours ?? 24
        if (reminderHours !== 24) {
          getUpcomingTasks(undefined, reminderHours).then(d2 => {
            setOverdueTasks(d2.overdue as TaskWithProject[])
            setUpcomingTasks(d2.upcoming as TaskWithProject[])
            setThisWeekTasks(d2.thisWeek as TaskWithProject[])
          }).catch(() => {})
        }
      } catch (error) {
        console.error('加载核心数据失败:', error)
      } finally {
        setLoading(false)
      }
    })()

    // 审批数据：独立加载，不阻塞 loading 状态，仅影响侧边栏 badge
    Promise.all([
      fetch('/api/approvals').then(r => r.ok ? r.json() : []),
      fetch('/api/approvals?mine=true').then(r => r.ok ? r.json() : []),
    ]).then(([approvalsRes, mineRes]) => {
      const allApprovals: ApprovalRequest[] = Array.isArray(approvalsRes) ? approvalsRes : []
      const myTurn = allApprovals.filter(r => {
        if (r.status !== 'pending') return false
        if (userRole === 'sales_manager') return r.current_step === 1
        if (userRole === 'super_admin') return r.current_step === r.total_steps
        return false
      })
      setPendingApprovals(myTurn)

      const myTurnIds = new Set(myTurn.map(r => r.id))
      const mine: ApprovalRequest[] = Array.isArray(mineRes) ? mineRes : []
      setMyPendingApprovals(mine.filter(r => r.status === 'pending' && !myTurnIds.has(r.id)))
    }).catch(() => {})

    await corePromise
  }

  useEffect(() => {
    loadTasks()
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const handler = () => {
      clearTimeout(timer)
      timer = setTimeout(() => loadTasks(), 500)
    }
    window.addEventListener('refresh-bell', handler)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('refresh-bell', handler)
    }
  }, [])

  return (
    <TasksContext.Provider value={{
      overdueTasks, upcomingTasks, thisWeekTasks,
      pendingApprovals, myPendingApprovals, pendingMembers,
      role, userSettings, loading, refresh: loadTasks
    }}>
      {children}
    </TasksContext.Provider>
  )
}
