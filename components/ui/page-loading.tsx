// 通用页面加载骨架：标题占位 + 卡片网格，与系统 rounded-2xl/zinc 调子一致
export function PageLoading({ variant = 'list' }: { variant?: 'list' | 'grid' | 'settings' | 'two-column' | 'cards' | 'card-list' | 'approvals' | 'updates' | 'users' }) {
  // 设置页：标题 + 多个堆叠卡片
  if (variant === 'settings') {
    return (
      <div className="p-8 max-w-4xl animate-pulse">
        <div className="mb-8 space-y-2">
          <div className="h-9 w-32 rounded-2xl bg-zinc-200/70" />
          <div className="h-4 w-56 rounded-full bg-zinc-200/50" />
        </div>
        <div className="space-y-6">
          {['h-20', 'h-40', 'h-48', 'h-32'].map((h, i) => (
            <div key={i} className="rounded-2xl bg-white shadow-sm p-6 space-y-4">
              <div className="h-5 w-28 rounded-full bg-zinc-200/60" />
              <div className="h-4 w-72 rounded-full bg-zinc-200/40" />
              <div className={`${h} rounded-2xl bg-zinc-100/70 mt-2`} />
            </div>
          ))}
          <div className="flex justify-end">
            <div className="h-10 w-24 rounded-full bg-zinc-200/60" />
          </div>
        </div>
      </div>
    )
  }

  // 审批页：标题 + 右上角胶囊滑块 + 单列徽章/灰块/按钮卡片
  if (variant === 'approvals') {
    return (
      <div className="p-8 animate-pulse">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="h-9 w-20 rounded-2xl bg-zinc-200/70" />
            <div className="mt-2 h-5 w-44 rounded-full bg-zinc-200/50" />
          </div>
          <div className="inline-flex items-center bg-zinc-100 rounded-full p-1 h-9 gap-1 shadow-sm -translate-y-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`h-7 ${i === 0 ? 'w-24 bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'w-20 bg-transparent'} rounded-full`} />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white shadow-sm pt-4 pb-3 px-4 space-y-3">
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-16 rounded-full bg-zinc-200/60" />
                  <div className="h-5 w-14 rounded-full bg-zinc-200/50" />
                  <div className="h-3 w-32 rounded-full bg-zinc-200/40" />
                </div>
                <div className="h-5 w-16 rounded-full bg-zinc-200/50" />
              </div>
              <div className="rounded-xl bg-zinc-50 p-3 space-y-2">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <div className="h-3 w-16 rounded-full bg-zinc-200/50" />
                    <div className={`h-3 ${['w-40', 'w-56', 'w-32'][j]} rounded-full bg-zinc-200/40`} />
                  </div>
                ))}
              </div>
              {i % 2 === 0 && (
                <div className="flex gap-2 pt-1">
                  <div className="h-8 w-16 rounded-full bg-zinc-200/60" />
                  <div className="h-8 w-16 rounded-full bg-zinc-200/40" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 单列卡片列表：项目管理 / 审批 等行式卡片页
  if (variant === 'card-list') {
    return (
      <div className="p-4 md:p-8 animate-pulse">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
          <div>
            <div className="h-9 w-32 rounded-2xl bg-zinc-200/70" />
            <div className="mt-2 h-5 w-56 rounded-full bg-zinc-200/50" />
          </div>
          <div className="flex gap-3 items-center flex-wrap -translate-y-1">
            <div className="h-9 w-56 rounded-full bg-zinc-200/40" />
            <div className="h-9 w-16 rounded-full bg-zinc-200/40" />
            <div className="inline-flex items-center bg-zinc-100 rounded-full p-1 h-9 gap-1 shadow-sm">
              <div className="h-7 w-20 bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] rounded-full" />
              <div className="h-7 w-20 bg-transparent rounded-full" />
            </div>
            <div className="h-9 w-24 rounded-full bg-zinc-200/60" />
            <div className="h-9 w-24 rounded-full bg-zinc-200/60" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-20 rounded-full bg-zinc-200/50" />
                  <div className="h-4 w-40 rounded-full bg-zinc-200/60" />
                  <div className="h-3 w-14 rounded-full bg-zinc-200/40" />
                </div>
                <div className="h-6 w-16 rounded-full bg-zinc-200/40" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="h-5 w-16 rounded-full bg-zinc-100" />
                ))}
              </div>
              <div className="grid grid-cols-7 gap-3 pt-1">
                {Array.from({ length: 7 }).map((_, j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="h-2 w-12 rounded-full bg-zinc-200/40" />
                    <div className="h-3 w-16 rounded-full bg-zinc-200/60" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 客户管理：标题 + 操作按钮 + 3 列卡片网格
  if (variant === 'cards') {
    return (
      <div className="p-8 animate-pulse">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="h-9 w-32 rounded-2xl bg-zinc-200/70" />
            <div className="mt-2 h-5 w-56 rounded-full bg-zinc-200/50" />
          </div>
          <div className="flex gap-3 items-center -translate-y-1">
            <div className="inline-flex items-center bg-zinc-100 rounded-full p-1 h-9 gap-1 shadow-sm">
              <div className="h-7 w-20 bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] rounded-full" />
              <div className="h-7 w-20 bg-transparent rounded-full" />
            </div>
            <div className="h-9 w-24 rounded-full bg-zinc-200/60" />
            <div className="h-9 w-24 rounded-full bg-zinc-200/60" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white shadow-sm p-6 pb-7">
              <div className="space-y-2">
                <div className="h-6 w-2/3 rounded-full bg-zinc-200/60" />
                <div className="h-4 w-1/2 rounded-full bg-zinc-200/40" />
              </div>
              <div className="mt-5 space-y-2.5">
                <div className="h-3.5 w-3/4 rounded-full bg-zinc-200/40" />
                <div className="h-3.5 w-2/3 rounded-full bg-zinc-200/40" />
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2">
                <div className="h-3 w-full rounded-full bg-zinc-200/40" />
                <div className="h-3 w-4/5 rounded-full bg-zinc-200/40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 数据字典：标题 + 左侧分类树 + 右侧表格
  if (variant === 'two-column') {
    return (
      <div className="p-8 animate-pulse">
        <div className="mb-6 space-y-2">
          <div className="h-9 w-32 rounded-2xl bg-zinc-200/70" />
          <div className="h-4 w-64 rounded-full bg-zinc-200/50" />
        </div>
        <div className="flex gap-6">
          <div className="w-64 shrink-0">
            <div className="rounded-2xl bg-white shadow-sm p-3 space-y-2">
              <div className="h-4 w-16 rounded-full bg-zinc-200/50 mx-3 my-2" />
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-9 rounded-full bg-zinc-200/60" />
                  <div className="ml-5 pl-3.5 border-l border-zinc-100 space-y-1">
                    <div className="h-7 rounded-lg bg-zinc-100/80" />
                    <div className="h-7 rounded-lg bg-zinc-100/80" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 w-24 rounded-full bg-zinc-200/60" />
              <div className="h-9 w-24 rounded-full bg-zinc-200/60" />
            </div>
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="h-12 border-b border-zinc-200 bg-white" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 border-b border-zinc-50 px-4 flex items-center gap-3">
                  <div className="h-4 w-4 rounded bg-zinc-200/60" />
                  <div className="h-3 w-1/3 rounded-full bg-zinc-200/50" />
                  <div className="h-3 w-1/12 rounded-full bg-zinc-200/40 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'grid') {
    return (
      <div className="p-8 max-w-[1600px] animate-pulse">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="h-9 w-32 rounded-2xl bg-zinc-200/70" />
            <div className="mt-1.5 h-5 w-56 rounded-full bg-zinc-200/50" />
          </div>
          <div className="flex items-center gap-1 -translate-y-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-10 h-10 rounded-full bg-zinc-200/50" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-white shadow-sm h-[180px] px-4 flex items-center gap-4">
              <div className="shrink-0 w-[130px] h-[130px] rounded-full bg-zinc-200/50" />
              <div className="flex-1 space-y-2.5">
                <div className="h-3 w-20 rounded-full bg-zinc-200/50" />
                <div className="h-7 w-32 rounded-full bg-zinc-200/60" />
                <div className="h-3 w-24 rounded-full bg-zinc-200/40" />
                <div className="h-3 w-28 rounded-full bg-zinc-200/40" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_360px] gap-6">
          <div className="space-y-5">
            <div className="h-5 w-56 rounded-full bg-zinc-200/60" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded bg-zinc-200/50" />
                    <div className="h-3.5 w-20 rounded-full bg-zinc-200/60" />
                    <div className="h-5 w-6 rounded-full bg-zinc-200/40" />
                  </div>
                  <div className="h-3 w-16 rounded-full bg-zinc-200/40" />
                </div>
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="px-5 py-3 border-b border-zinc-50 last:border-b-0 flex items-center justify-between">
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 w-1/2 rounded-full bg-zinc-200/50" />
                      <div className="h-3 w-1/3 rounded-full bg-zinc-200/40" />
                    </div>
                    <div className="space-y-1.5 text-right">
                      <div className="h-3.5 w-20 rounded-full bg-zinc-200/50 ml-auto" />
                      <div className="h-3 w-12 rounded-full bg-zinc-200/40 ml-auto" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-5">
            <div className="h-5 w-40 rounded-full bg-zinc-200/60" />
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-zinc-100 border-b border-zinc-100">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 space-y-1.5">
                    <div className="h-7 w-12 rounded-full bg-zinc-200/60 mx-auto" />
                    <div className="h-3 w-12 rounded-full bg-zinc-200/40 mx-auto" />
                  </div>
                ))}
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3 border-b border-zinc-50 last:border-b-0 flex items-start gap-3">
                  <div className="w-3.5 h-3.5 rounded-full bg-zinc-200/50 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-3/4 rounded-full bg-zinc-200/50" />
                    <div className="h-3 w-1/2 rounded-full bg-zinc-200/40" />
                  </div>
                  <div className="h-3 w-12 rounded-full bg-zinc-200/40" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // updates（项目进展表格：项目名称 | 结算状态 | 最新进展 | 操作）
  if (variant === 'updates') {
    return (
      <div className="p-8 animate-pulse">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="h-9 w-32 rounded-2xl bg-zinc-200/70" />
            <div className="mt-2 h-5 w-72 rounded-full bg-zinc-200/50" />
          </div>
          <div className="flex items-center gap-3 -translate-y-1">
            <div className="h-9 w-56 rounded-full bg-zinc-200/40" />
            <div className="h-9 w-20 rounded-full bg-zinc-200/40" />
          </div>
        </div>
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead className="bg-white border-b border-zinc-200">
                <tr>
                  <th className="text-left py-4 px-4 w-[260px]"><div className="h-3 w-16 rounded-full bg-zinc-200/50" /></th>
                  <th className="text-left py-4 px-4 w-[210px]"><div className="h-3 w-16 rounded-full bg-zinc-200/50" /></th>
                  <th className="text-left py-4 px-4 w-[310px]"><div className="h-3 w-16 rounded-full bg-zinc-200/50" /></th>
                  <th className="text-right py-4 px-4 w-[172px]"><div className="h-3 w-10 rounded-full bg-zinc-200/50 ml-auto" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="py-3 px-4">
                      <div className="space-y-1.5">
                        <div className="h-3 w-1/2 rounded-full bg-zinc-200/40" />
                        <div className="h-3.5 w-3/4 rounded-full bg-zinc-200/60" />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="h-5 w-14 rounded-full bg-amber-100/60" />
                        <div className="h-5 w-14 rounded-full bg-amber-100/60" />
                        <div className="h-5 w-14 rounded-full bg-amber-100/60" />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1.5">
                        <div className="h-3 w-1/3 rounded-full bg-zinc-200/40" />
                        <div className="h-3.5 w-2/3 rounded-full bg-zinc-200/40" />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <div className="h-8 w-8 rounded-full bg-zinc-200/30" />
                        <div className="h-8 w-8 rounded-full bg-zinc-200/30" />
                        <div className="h-8 w-8 rounded-full bg-zinc-200/30" />
                        <div className="h-8 w-8 rounded-full bg-zinc-200/30" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // users（成员管理表格：邮箱 | 角色 | 数据范围 | 审批抄送 | 状态 | 加入时间 | 操作）
  if (variant === 'users') {
    return (
      <div className="p-8 animate-pulse">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="h-9 w-32 rounded-2xl bg-zinc-200/70" />
            <div className="mt-2 h-5 w-56 rounded-full bg-zinc-200/50" />
          </div>
          <div className="h-9 w-24 rounded-full bg-zinc-200/60 -translate-y-1" />
        </div>
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col />
              <col className="w-56" />
              <col className="w-32" />
              <col className="w-32" />
              <col className="w-32" />
              <col className="w-32" />
              <col className="w-32" />
            </colgroup>
            <thead className="bg-white border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-4 text-xs font-medium text-zinc-500 uppercase"><div className="h-3 w-12 rounded-full bg-zinc-200/50" /></th>
                <th className="text-left px-4 py-4 text-xs font-medium text-zinc-500 uppercase"><div className="h-3 w-12 rounded-full bg-zinc-200/50" /></th>
                <th className="text-left px-4 py-4 text-xs font-medium text-zinc-500 uppercase"><div className="h-3 w-16 rounded-full bg-zinc-200/50" /></th>
                <th className="text-left px-4 py-4 text-xs font-medium text-zinc-500 uppercase"><div className="h-3 w-16 rounded-full bg-zinc-200/50" /></th>
                <th className="text-left px-4 py-4 text-xs font-medium text-zinc-500 uppercase"><div className="h-3 w-12 rounded-full bg-zinc-200/50" /></th>
                <th className="text-left px-4 py-4 text-xs font-medium text-zinc-500 uppercase"><div className="h-3 w-16 rounded-full bg-zinc-200/50" /></th>
                <th className="text-left px-4 py-4 text-xs font-medium text-zinc-500 uppercase"><div className="h-3 w-12 rounded-full bg-zinc-200/50" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 truncate"><div className="h-3.5 w-3/4 rounded-full bg-zinc-200/60" /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><div className="h-8 w-32 rounded-full bg-zinc-200/40" /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><div className="h-3.5 w-16 rounded-full bg-zinc-200/40" /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><div className="h-5 w-9 rounded-full bg-zinc-200/50" /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><div className="h-5 w-14 rounded-full bg-emerald-100/60" /></td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap"><div className="h-3 w-20 rounded-full bg-zinc-200/40" /></td>
                  <td className="px-4 py-3 whitespace-nowrap"><div className="h-7 w-14 rounded-full bg-zinc-200/30" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // list（任务管理表格：状态 | 任务标题 | 关联项目 | 优先级 | 截止日期 | 操作）
  return (
    <div className="p-8 animate-pulse">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="h-9 w-32 rounded-2xl bg-zinc-200/70" />
          <div className="mt-2 h-5 w-56 rounded-full bg-zinc-200/50" />
        </div>
        <div className="flex items-center gap-3 -translate-y-1">
          <div className="h-9 w-56 rounded-full bg-zinc-200/40" />
          <div className="inline-flex items-center bg-zinc-100 rounded-full p-1 h-9 gap-1 shadow-sm">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`h-7 ${i === 0 ? 'w-16 bg-white/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)]' : 'w-14 bg-transparent'} rounded-full`} />
            ))}
          </div>
          <div className="h-9 w-24 rounded-full bg-zinc-200/60" />
        </div>
      </div>
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <table className="w-full table-fixed">
          <thead className="bg-white border-b border-zinc-200 rounded-t-2xl">
            <tr>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-10 whitespace-nowrap rounded-tl-2xl"></th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-[240px] whitespace-nowrap"><div className="h-3 w-16 rounded-full bg-zinc-200/50" /></th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-[220px] whitespace-nowrap"><div className="h-3 w-16 rounded-full bg-zinc-200/50" /></th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-20 whitespace-nowrap"><div className="h-3 w-12 rounded-full bg-zinc-200/50" /></th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase w-28 whitespace-nowrap"><div className="h-3 w-16 rounded-full bg-zinc-200/50" /></th>
              <th className="px-4 py-4 text-right text-xs font-medium text-zinc-500 uppercase w-[172px] whitespace-nowrap rounded-tr-2xl"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-zinc-200/50" /></td>
                <td className="px-4 py-3">
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-3/4 rounded-full bg-zinc-200/60" />
                    <div className="h-2.5 w-1/2 rounded-full bg-zinc-200/40" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1.5">
                    <div className="h-3 w-1/3 rounded-full bg-zinc-200/40" />
                    <div className="h-3.5 w-2/3 rounded-full bg-zinc-200/50" />
                  </div>
                </td>
                <td className="px-4 py-3"><div className="h-5 w-14 rounded-full bg-zinc-200/50" /></td>
                <td className="px-4 py-3"><div className="h-3 w-20 rounded-full bg-zinc-200/40" /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <div className="h-8 w-8 rounded-full bg-zinc-200/30" />
                    <div className="h-8 w-8 rounded-full bg-zinc-200/30" />
                    <div className="h-8 w-8 rounded-full bg-zinc-200/30" />
                    <div className="h-8 w-8 rounded-full bg-zinc-200/30" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
