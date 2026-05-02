'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DictOption {
  key: string
  label: string
  subLabel?: string  // 支持副标签，如客户的公司名称
  parentId?: string  // 父级ID（级联时使用）
  children?: DictOption[] // 子选项（级联时使用）
}

interface DictSelectProps {
  value: string
  onChange: (value: string) => void
  options: DictOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
  showClear?: boolean  // 是否显示清除按钮
  allowCreate?: boolean // 是否允许创建新选项
  onCreate?: (label: string) => void // 创建新选项的回调
  cascade?: boolean // 是否启用级联模式（显示分组）
}

export function DictSelect({
  value,
  onChange,
  options,
  placeholder = '请选择',
  className,
  disabled,
  showClear = true,
  allowCreate = false,
  onCreate,
  cascade = false
}: DictSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find(o => o.key === value) ||
    options.flatMap(o => o.children || []).find(o => o.key === value)

  // 构建级联显示结构
  const cascadeOptions = cascade
    ? options.filter(o => !o.parentId) // 只取顶级
    : options

  // 过滤选项（包括子级）
  const filteredOptions = cascadeOptions.filter(opt => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    // 搜索父级
    if (
      opt.label.toLowerCase().includes(searchLower) ||
      (opt.subLabel && opt.subLabel.toLowerCase().includes(searchLower)) ||
      opt.key.toLowerCase().includes(searchLower)
    ) {
      return true
    }
    // 搜索子级
    if (opt.children && opt.children.some(child =>
      child.label.toLowerCase().includes(searchLower) ||
      (child.subLabel && child.subLabel.toLowerCase().includes(searchLower)) ||
      child.key.toLowerCase().includes(searchLower)
    )) {
      return true
    }
    return false
  })

  // 判断是否可以创建新选项
  const canCreate = allowCreate && searchTerm.trim() && !filteredOptions.some(o => o.label.toLowerCase() === searchTerm.toLowerCase())

  // 处理选择
  const handleSelect = (key: string) => {
    onChange(key)
    setIsOpen(false)
    setSearchTerm('')
  }

  // 处理创建新选项
  const handleCreate = () => {
    if (onCreate && searchTerm.trim()) {
      onCreate(searchTerm.trim())
      setSearchTerm('')
    }
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canCreate) {
      e.preventDefault()
      handleCreate()
    }
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearchTerm('')
    }
  }

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 清除选择
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setSearchTerm('')
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* 触发器 */}
      <div
        onClick={() => !disabled && setIsOpen(true)}
        className={cn(
          'flex h-10 items-center justify-between gap-2 rounded-full border px-4 py-2 text-sm cursor-pointer transition-colors',
          isOpen ? 'border-zinc-400 ring-1 ring-zinc-400' : 'border-zinc-200 hover:border-zinc-300',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none placeholder:text-zinc-400"
            autoFocus
          />
        ) : (
          <span className={cn('flex-1 truncate', !selectedOption && 'text-zinc-400')}>
            {selectedOption ? (
              <span>
                {selectedOption.label}
                {selectedOption.subLabel && (
                  <span className="text-xs text-zinc-400 ml-1">({selectedOption.subLabel})</span>
                )}
              </span>
            ) : placeholder}
          </span>
        )}

        <div className="flex items-center gap-1">
          {selectedOption && !isOpen && showClear && (
            <button
              type="button"
              onClick={handleClear}
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition-transform', isOpen && 'rotate-180')} />
        </div>
      </div>

      {/* 下拉列表 */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-zinc-200 rounded-2xl shadow-lg overflow-hidden">
          <div className="max-h-60 overflow-auto py-1">
            {/* 级联模式 */}
            {cascade && filteredOptions.length > 0 ? (
              filteredOptions.map((parent) => (
                <div key={parent.key}>
                  {/* 父级选项 */}
                  <button
                    type="button"
                    onClick={() => handleSelect(parent.key)}
                    className={cn(
                      'w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors',
                      parent.key === value
                        ? 'bg-zinc-100 text-zinc-900'
                        : 'hover:bg-zinc-50 text-zinc-700'
                    )}
                  >
                    <span className="font-medium">
                      {parent.label}
                      {parent.subLabel && (
                        <span className="text-xs text-zinc-400 ml-1">({parent.subLabel})</span>
                      )}
                    </span>
                    {parent.key === value && (
                      <Check className="w-4 h-4 text-zinc-600" />
                    )}
                  </button>
                  {/* 子级选项 */}
                  {parent.children && parent.children.length > 0 && (
                    parent.children
                      .filter(child => !searchTerm ||
                        child.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        child.key.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((child) => (
                        <button
                          key={child.key}
                          type="button"
                          onClick={() => handleSelect(child.key)}
                          className={cn(
                            'w-full pl-8 pr-4 py-2 text-left text-sm flex items-center justify-between transition-colors',
                            child.key === value
                              ? 'bg-zinc-100 text-zinc-900'
                              : 'hover:bg-zinc-50 text-zinc-600'
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-px bg-zinc-200" />
                            {child.label}
                            {child.subLabel && (
                              <span className="text-xs text-zinc-400">({child.subLabel})</span>
                            )}
                          </span>
                          {child.key === value && (
                            <Check className="w-4 h-4 text-zinc-600" />
                          )}
                        </button>
                      ))
                  )}
                </div>
              ))
            ) : !cascade && filteredOptions.length > 0 ? (
              /* 非级联模式 */
              filteredOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelect(opt.key)}
                  className={cn(
                    'w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors',
                    opt.key === value
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'hover:bg-zinc-50 text-zinc-700'
                  )}
                >
                  <span>
                    {opt.label}
                    {opt.subLabel && (
                      <span className="text-xs text-zinc-400 ml-1">({opt.subLabel})</span>
                    )}
                  </span>
                  {opt.key === value && (
                    <Check className="w-4 h-4 text-zinc-600" />
                  )}
                </button>
              ))
            ) : !canCreate ? (
              <div className="px-4 py-3 text-sm text-zinc-400 text-center">
                未找到匹配项
              </div>
            ) : null}

            {/* 创建新选项 */}
            {canCreate && (
              <button
                type="button"
                onClick={handleCreate}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>创建"{searchTerm}"</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
