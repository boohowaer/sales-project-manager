'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getUpcomingTasks, getUserSettings } from '@/lib/supabase/queries'

interface TaskWithProject {
  id: string
  project_id: string
  title: string
  due_date: string | null
  status: string
  projects?: {
    name: string
  } | null
}

interface TasksContextType {
  overdueTasks: TaskWithProject[]
  upcomingTasks: TaskWithProject[]
  thisWeekTasks: TaskWithProject[]
  loading: boolean
  refresh: () => void
}

const TasksContext = createContext<TasksContextType>({
  overdueTasks: [],
  upcomingTasks: [],
  thisWeekTasks: [],
  loading: true,
  refresh: () => {}
})

export function useTasks() {
  return useContext(TasksContext)
}

interface TasksProviderProps {
  children: ReactNode
}

export function TasksProvider({ children }: TasksProviderProps) {
  const [overdueTasks, setOverdueTasks] = useState<TaskWithProject[]>([])
  const [upcomingTasks, setUpcomingTasks] = useState<TaskWithProject[]>([])
  const [thisWeekTasks, setThisWeekTasks] = useState<TaskWithProject[]>([])
  const [loading, setLoading] = useState(true)

  const loadTasks = async () => {
    try {
      const settings = await getUserSettings()
      const reminderHours = settings?.reminder_advance_hours ?? 24
      const data = await getUpcomingTasks(undefined, reminderHours)
      setOverdueTasks(data.overdue as TaskWithProject[])
      setUpcomingTasks(data.upcoming as TaskWithProject[])
      setThisWeekTasks(data.thisWeek as TaskWithProject[])
    } catch (error) {
      console.error('加载任务失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  return (
    <TasksContext.Provider value={{ overdueTasks, upcomingTasks, thisWeekTasks, loading, refresh: loadTasks }}>
      {children}
    </TasksContext.Provider>
  )
}