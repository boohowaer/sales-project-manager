'use client'

import * as React from 'react'
import { Calendar as CalendarIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  size?: 'default' | 'compact'
}

export function DatePicker({
  value,
  onChange,
  placeholder = '选择日期',
  className,
  disabled,
  size = 'default',
}: DatePickerProps) {
  const isCompact = size === 'compact'

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div
      className={cn(
        'relative flex items-center rounded-full border transition-colors',
        'border-zinc-200 hover:border-zinc-300 focus-within:border-zinc-400 focus-within:ring-1 focus-within:ring-zinc-400',
        isCompact ? 'h-8 text-xs' : 'h-10 text-sm',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className={cn('absolute left-0 flex items-center', isCompact ? 'px-3' : 'px-4')}>
        <CalendarIcon className={cn('text-zinc-400 shrink-0', isCompact ? 'h-3.5 w-3.5 mr-2' : 'h-4 w-4 mr-2')} />
      </div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'w-full h-full bg-transparent outline-none cursor-pointer',
          'text-zinc-900',
          isCompact ? 'px-3 pl-8 pr-6' : 'px-4 pl-10 pr-8',
          !value && 'text-zinc-400',
          '[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:left-0',
          '[&::-webkit-datetime-edit]:bg-transparent',
          '[&::-webkit-datetime-edit-fields-wrapper]:bg-transparent',
          '[&::-webkit-datetime-edit-text]:bg-transparent',
          '[&::-webkit-datetime-edit-month-field]:bg-transparent',
          '[&::-webkit-datetime-edit-day-field]:bg-transparent',
          '[&::-webkit-datetime-edit-year-field]:bg-transparent'
        )}
      />
      {value && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className={cn('absolute right-0 text-zinc-400 hover:text-zinc-600 transition-colors', isCompact ? 'px-2' : 'px-3')}
        >
          <X className={cn(isCompact ? 'h-3 w-3' : 'h-4 w-4')} />
        </button>
      )}
    </div>
  )
}