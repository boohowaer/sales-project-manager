'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getUpcomingTasks } from '@/lib/supabase/queries'

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
  loading: boolean
  refresh: () => void
}

const TasksContext = createContext<TasksContextType>({
  overdueTasks: [],
  upcomingTasks: [],
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
  const [loading, setLoading] = useState(true)

  const loadTasks = async () => {
    try {
      const data = await getUpcomingTasks()
      setOverdueTasks(data.overdue as TaskWithProject[])
      setUpcomingTasks(data.upcoming as TaskWithProject[])
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
    <TasksContext.Provider value={{ overdueTasks, upcomingTasks, loading, refresh: loadTasks }}>
      {children}
    </TasksContext.Provider>
  )
}