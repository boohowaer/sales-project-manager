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

function getTodayKey() {
  const d = new Date()
  return `inbox_task_written_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getWrittenToday(): Set<string> {
  try {
    const raw = localStorage.getItem(getTodayKey())
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function markWrittenToday(ids: string[]) {
  const key = getTodayKey()
  const existing = getWrittenToday()
  ids.forEach(id => existing.add(id))
  localStorage.setItem(key, JSON.stringify([...existing]))
}

async function writeTaskNotifications(
  overdue: TaskWithProject[],
  upcoming: TaskWithProject[]
) {
  const written = getWrittenToday()
  const toWrite: Array<{ type: string; title: string; body: string; linkId: string }> = []
  const newIds: string[] = []

  overdue.forEach(task => {
    const sid = `overdue_${task.id}`
    if (!written.has(sid)) {
      toWrite.push({
        type: 'task_overdue',
        title: '任务已过期',
        body: `「${task.title}」已过期`,
        linkId: task.id,
      })
      newIds.push(sid)
    }
  })

  upcoming.forEach(task => {
    const sid = `upcoming_${task.id}`
    if (!written.has(sid)) {
      const dateStr = task.due_date
        ? new Date(task.due_date).toLocaleDateString('zh-CN')
        : ''
      toWrite.push({
        type: 'task_upcoming',
        title: '任务即将到期',
        body: `「${task.title}」即将在 ${dateStr} 到期`,
        linkId: task.id,
      })
      newIds.push(sid)
    }
  })

  if (toWrite.length === 0) return

  await Promise.all(
    toWrite.map(n =>
      fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: n.type,
          title: n.title,
          body: n.body,
          linkType: 'task',
          linkId: n.linkId,
        }),
      })
    )
  )

  markWrittenToday(newIds)
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
      const overdue = data.overdue as TaskWithProject[]
      const upcoming = data.upcoming as TaskWithProject[]
      setOverdueTasks(overdue)
      setUpcomingTasks(upcoming)
      setThisWeekTasks(data.thisWeek as TaskWithProject[])
      writeTaskNotifications(overdue, upcoming).catch(() => {})
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