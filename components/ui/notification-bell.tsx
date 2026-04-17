'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, X, AlertCircle, Clock, CheckCircle } from 'lucide-react'
import { useTasks } from '@/context/TasksContext'

interface NotificationBellProps {
  userEmail?: string
}

export function NotificationBell({ userEmail }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 使用 Context 中的任务数据
  const { overdueTasks, upcomingTasks, loading } = useTasks()

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const totalNotifications = overdueTasks.length + upcomingTasks.length

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 通知按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-zinc-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-zinc-600" />
        {totalNotifications > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>

      {/* 通知面板 */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-xl border-0 z-50">
          {/* 面板头部 */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-100">
            <div>
              <h3 className="font-semibold text-zinc-900">通知中心</h3>
              {userEmail && (
                <p className="text-xs text-zinc-500 mt-0.5">{userEmail}</p>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-zinc-100 transition-colors"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          {/* 通知列表 */}
          <div className="p-2">
            {loading ? (
              <div className="p-4 text-center text-zinc-400 text-sm">
                加载中...
              </div>
            ) : totalNotifications === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">暂无待处理任务</p>
              </div>
            ) : (
              <>
                {/* 过期任务 */}
                {overdueTasks.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 px-3 py-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-xs font-medium text-red-600">已过期任务</span>
                      <span className="text-xs text-zinc-400">({overdueTasks.length})</span>
                    </div>
                    {overdueTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-red-50 transition-colors"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">{task.title}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {task.projects?.name}
                          </p>
                          <p className="text-xs text-red-500 mt-1">
                            {task.due_date ? new Date(task.due_date).toLocaleDateString('zh-CN') : '无日期'} 已过期
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 即将到期任务 */}
                {upcomingTasks.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 px-3 py-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-medium text-amber-600">即将到期</span>
                      <span className="text-xs text-zinc-400">({upcomingTasks.length})</span>
                    </div>
                    {upcomingTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-amber-50 transition-colors"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">{task.title}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {task.projects?.name}
                          </p>
                          <p className="text-xs text-zinc-400 mt-1">
                            {task.due_date ? new Date(task.due_date).toLocaleDateString('zh-CN') : '无日期'} 到期
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}