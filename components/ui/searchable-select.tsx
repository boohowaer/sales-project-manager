'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search, Check } from 'lucide-react'

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: Array<{
    id: string
    name: string
    belong_year?: number
    value?: number
  }>
  placeholder?: string
  label?: string
  required?: boolean
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = '请选择',
  label,
  required
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 获取当前选中的项目
  const selectedProject = options.find(p => p.id === value)

  // 过滤项目
  const filteredOptions = options.filter(project => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      project.name.toLowerCase().includes(searchLower) ||
      (project.belong_year && String(project.belong_year).includes(searchLower))
    )
  })

  // 处理选择
  const handleSelect = (projectId: string) => {
    onChange(projectId)
    setIsOpen(false)
    setSearchTerm('')
  }

  // 处理输入焦点
  const handleInputFocus = () => {
    setIsOpen(true)
  }

  // 处理点击外部
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // 清除搜索词
  const handleClearSearch = () => {
    setSearchTerm('')
    inputRef.current?.focus()
  }

  // 清除选择
  const handleClearSelection = () => {
    onChange('')
    setSearchTerm('')
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      {label && (
        <Label className="text-sm font-medium text-zinc-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Input
            ref={inputRef}
            value={isOpen ? searchTerm : (selectedProject?.name || '')}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={handleInputFocus}
            placeholder={placeholder}
            className="mt-2 pr-20 focus:ring-1 focus:ring-zinc-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-10 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 px-1"
              title="清除搜索"
            >
              ✕
            </button>
          )}
          {selectedProject && !isOpen && !searchTerm && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 px-1"
              title="清除选择"
            >
              ✕
            </button>
          )}
        </div>

        {isOpen && filteredOptions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-2xl shadow-lg max-h-60 overflow-auto">
            {filteredOptions.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => handleSelect(project.id)}
                className="w-full px-3 py-2 text-left hover:bg-zinc-50 transition-colors border-b border-zinc-100 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col flex-1">
                    <span className="text-sm font-medium text-zinc-900">{project.name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      {project.belong_year && (
                        <span className="text-xs text-zinc-500">{project.belong_year}年</span>
                      )}
                      {project.value && (
                        <span className="text-xs text-zinc-500">¥{project.value.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  {project.id === value && (
                    <Check className="w-4 h-4 text-zinc-900 flex-shrink-0 ml-2" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {isOpen && filteredOptions.length === 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-zinc-200 rounded-2xl shadow-lg px-3 py-2 text-sm text-zinc-500">
            未找到匹配的项目
          </div>
        )}
      </div>
    </div>
  )
}
