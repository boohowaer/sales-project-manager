'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getUpcomingTasks, getUserSettings } from '@/lib/supabase/queries'
import type { ApprovalRequest } from '@/types'

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
  loading: true,
  refresh: () => {}
})

export function useTasks() {
  return useContext(TasksContext)
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const [overdueTasks, setOverdueTasks] = useState<TaskWithProject[]>([])
  const [upcomingTasks, setUpcomingTasks] = useState<TaskWithProject[]>([])
  const [thisWeekTasks, setThisWeekTasks] = useState<TaskWithProject[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([])
  const [myPendingApprovals, setMyPendingApprovals] = useState<ApprovalRequest[]>([])
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadTasks = async () => {
    try {
      const [settings, meRes, approvalsRes, mineRes] = await Promise.all([
        getUserSettings(),
        fetch('/api/me').then(r => r.json()),
        fetch('/api/approvals').then(r => r.ok ? r.json() : []),
        fetch('/api/approvals?mine=true').then(r => r.ok ? r.json() : []),
      ])

      const userRole = meRes.role ?? null
      setRole(userRole)

      const reminderHours = settings?.reminder_advance_hours ?? 24
      const data = await getUpcomingTasks(undefined, reminderHours)
      setOverdueTasks(data.overdue as TaskWithProject[])
      setUpcomingTasks(data.upcoming as TaskWithProject[])
      setThisWeekTasks(data.thisWeek as TaskWithProject[])

      // 待我审批：status=pending 且轮到我这步
      const allApprovals: ApprovalRequest[] = Array.isArray(approvalsRes) ? approvalsRes : []
      const myTurn = allApprovals.filter(r => {
        if (r.status !== 'pending') return false
        if (userRole === 'sales_manager') return r.current_step === 1
        if (userRole === 'super_admin') return r.current_step === r.total_steps
        return false
      })
      setPendingApprovals(myTurn)

      // 我提交的还在流程中（排除已在"待我审批"里的）
      const myTurnIds = new Set(myTurn.map(r => r.id))
      const mine: ApprovalRequest[] = Array.isArray(mineRes) ? mineRes : []
      setMyPendingApprovals(mine.filter(r => r.status === 'pending' && !myTurnIds.has(r.id)))

      // 待审核成员（仅 super_admin）
      if (userRole === 'super_admin') {
        const membersRes = await fetch('/api/admin/users').then(r => r.ok ? r.json() : [])
        const pending = (Array.isArray(membersRes) ? membersRes : []).filter((m: any) => m.status === 'pending')
        setPendingMembers(pending)
      } else {
        setPendingMembers([])
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  useEffect(() => {
    const handler = () => loadTasks()
    window.addEventListener('refresh-bell', handler)
    return () => window.removeEventListener('refresh-bell', handler)
  }, [])

  return (
    <TasksContext.Provider value={{
      overdueTasks, upcomingTasks, thisWeekTasks,
      pendingApprovals, myPendingApprovals, pendingMembers,
      role, loading, refresh: loadTasks
    }}>
      {children}
    </TasksContext.Provider>
  )
}
