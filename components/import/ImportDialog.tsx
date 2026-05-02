'use client'

import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, FileText, Download, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface ImportError {
  row: number
  field: string
  message: string
}

interface TemplateLink {
  label: string
  url: string
}

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportSuccess: () => void
  type: 'customers' | 'projects' | 'dictionary'
  title: string
  description: string
  templateLinks: TemplateLink[]
  endpoint?: string // 自定义导入端点
  extraParams?: Record<string, string> // 额外参数
}

export function ImportDialog({
  open,
  onOpenChange,
  onImportSuccess,
  type,
  title,
  description,
  templateLinks,
  endpoint,
  extraParams
}: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [errors, setErrors] = useState<ImportError[]>([])
  const [previewData, setPreviewData] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 当对话框打开时，重置文件输入框
  useEffect(() => {
    if (open && fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [open])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const fileExtension = selectedFile.name.toLowerCase()
      if (!fileExtension.endsWith('.csv') &&
          !fileExtension.endsWith('.xlsx') &&
          !fileExtension.endsWith('.xls')) {
        toast.error('请选择CSV或Excel格式的文件')
        return
      }
      setFile(selectedFile)
      setErrors([])
      setPreviewData([])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      const fileExtension = droppedFile.name.toLowerCase()
      if (!fileExtension.endsWith('.csv') &&
          !fileExtension.endsWith('.xlsx') &&
          !fileExtension.endsWith('.xls')) {
        toast.error('请选择CSV或Excel格式的文件')
        return
      }
      setFile(droppedFile)
      setErrors([])
      setPreviewData([])
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    setErrors([])
    setPreviewData([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast.error('请选择要导入的文件')
      return
    }

    setImporting(true)
    setErrors([])

    try {
      const formData = new FormData()
      formData.append('file', file)

      // 添加额外参数
      if (extraParams) {
        Object.entries(extraParams).forEach(([key, value]) => {
          formData.append(key, value)
        })
      }

      // 确定导入端点
      const importEndpoint = endpoint || (
        type === 'customers'
          ? '/api/import/customers'
          : type === 'projects'
            ? '/api/import/projects'
            : '/api/admin/dictionary/import'
      )

      const response = await fetch(importEndpoint, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.errors) {
          setErrors(result.errors)
          toast.error(`导入失败：${result.error}`)
        } else {
          toast.error(result.error || '导入失败')
        }
        return
      }

      // 显示详细的导入结果
      if (result.pendingApproval) {
        // 销售代表提交审批的情况
        toast.success(result.message || '已提交审批')
        window.dispatchEvent(new Event('refresh-bell'))
      } else if (result.count !== undefined) {
        toast.success(`成功导入 ${result.count} 条`)
      } else if (result.skippedCount > 0) {
        toast.success(`${result.message}（总计 ${result.totalRows} 条记录）`)
      } else {
        toast.success(result.message || '导入成功')
      }

      onImportSuccess()
      handleClose()
    } catch (error: any) {
      console.error('导入错误:', error)
      toast.error('导入失败，请重试')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setErrors([])
    setPreviewData([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onOpenChange(false)
  }

  const downloadTemplate = async (templateUrl: string) => {
    try {
      const response = await fetch(templateUrl)
      if (!response.ok) {
        toast.error('下载模板失败')
        return
      }

      const fileName = templateUrl.split('/').pop() || 'template'
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')

      let blob
      if (isExcel) {
        // Excel文件：直接获取blob
        blob = await response.blob()
      } else {
        // CSV文件：先获取文本，再创建blob
        const content = await response.text()
        blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
      }

      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)

      link.setAttribute('href', url)
      link.setAttribute('download', fileName)
      link.style.visibility = 'hidden'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(url)
      toast.success('模板下载成功')
    } catch (error) {
      console.error('下载模板错误:', error)
      toast.error('下载模板失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl rounded-2xl shadow-xl border-0">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <p className="text-sm text-zinc-500 mt-2">{description}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* 模板下载 */}
          <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-zinc-600" />
              <div>
                <p className="text-sm font-medium text-zinc-900">导入模板</p>
                <p className="text-xs text-zinc-500">下载模板文件，按照格式填写数据</p>
              </div>
            </div>
            <div className="flex gap-2">
              {templateLinks.map((template) => (
                <Button
                  key={template.url}
                  onClick={() => downloadTemplate(template.url)}
                  variant="outline"
                  size="sm"
                  className="border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {template.label}
                </Button>
              ))}
            </div>
          </div>

          {/* 文件上传区域 */}
          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center cursor-pointer hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
              <p className="text-sm font-medium text-zinc-900 mb-2">
                点击上传或拖拽文件到此处
              </p>
              <p className="text-xs text-zinc-500">
                支持 CSV 或 Excel 格式，最大5MB
              </p>
            </div>
          ) : (
            <div className="border border-zinc-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-zinc-600" />
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{file.name}</p>
                    <p className="text-xs text-zinc-500">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleRemoveFile}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-zinc-100 text-zinc-500"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* 错误信息显示 */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-h-60 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-sm font-medium text-red-900">
                  发现 {errors.length} 个错误
                </p>
              </div>
              <div className="space-y-2">
                {errors.slice(0, 10).map((error, index) => (
                  <div key={index} className="text-xs text-red-700">
                    <span className="font-medium">第{error.row}行 - {error.field}:</span>{' '}
                    {error.message}
                  </div>
                ))}
                {errors.length > 10 && (
                  <div className="text-xs text-red-600 font-medium">
                    还有 {errors.length - 10} 个错误未显示...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="cancel"
              onClick={handleClose}
            >
              取消
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || importing}
            >
              {importing ? '导入中...' : '开始导入'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
