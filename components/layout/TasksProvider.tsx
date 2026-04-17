'use client'

import { TasksProvider } from '@/context/TasksContext'
import { ReactNode } from 'react'

interface TasksProviderWrapperProps {
  children: ReactNode
}

export function TasksProviderWrapper({ children }: TasksProviderWrapperProps) {
  return <TasksProvider>{children}</TasksProvider>
}