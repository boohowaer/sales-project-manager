'use client'

import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { zhCN } from 'date-fns/locale'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={zhCN}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        month_caption: 'flex justify-center pt-1 relative items-center mb-4',
        caption_label: 'text-sm font-medium text-zinc-900',
        nav: 'flex items-center gap-1',
        button_previous: 'absolute left-1 h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-full border border-zinc-200 hover:bg-zinc-50 flex items-center justify-center',
        button_next: 'absolute right-1 h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-full border border-zinc-200 hover:bg-zinc-50 flex items-center justify-center',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'text-zinc-500 rounded-md w-9 font-normal text-[0.8rem]',
        week: 'flex w-full mt-2',
        day: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 rounded-md',
        day_button: cn(
          'h-9 w-9 p-0 font-normal rounded-full',
          'hover:bg-zinc-100 hover:text-zinc-900',
          'focus:bg-zinc-100 focus:text-zinc-900'
        ),
        range_start: 'day-range-start',
        range_end: 'day-range-end',
        selected: cn(
          'bg-zinc-900 text-white rounded-full',
          'hover:bg-zinc-800 hover:text-white',
          'focus:bg-zinc-900 focus:text-white'
        ),
        today: 'bg-zinc-100 text-zinc-900 rounded-full',
        outside: 'text-zinc-400 opacity-50',
        disabled: 'text-zinc-400 opacity-50',
        range_middle: 'aria-selected:bg-zinc-100 aria-selected:text-zinc-900',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: (props) => {
          const { orientation } = props
          if (orientation === 'left') {
            return <ChevronLeft className="h-4 w-4" />
          }
          return <ChevronRight className="h-4 w-4" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }