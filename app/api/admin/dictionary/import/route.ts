import { NextResponse } from 'next/server'
import { getUserTeamContext, isSuperAdmin } from '@/lib/auth/get-user-role'
import { createDictionaryEntry, getDictionaryEntries } from '@/lib/supabase/admin-queries'
import { parseCSV } from '@/lib/utils/csv-parser'
import * as XLSX from 'xlsx'

export async function POST(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  const category = formData.get('category') as string
  const module = formData.get('module') as string
  const fieldKey = formData.get('field_key') as string

  if (!file || !category || !fieldKey) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
  }

  try {
    const buffer = await file.arrayBuffer()
    let rows: string[][] = []

    // 根据文件类型解析
    const fileName = file.name.toLowerCase()
    if (fileName.endsWith('.csv')) {
      const text = new TextDecoder().decode(buffer)
      rows = parseCSV(text)
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][]
      rows = data.map(row => row.map(cell => String(cell ?? '')))
    } else {
      return NextResponse.json({ error: '不支持的文件格式' }, { status: 400 })
    }

    if (rows.length < 2) {
      return NextResponse.json({ error: '文件为空或格式不正确' }, { status: 400 })
    }

    // 获取表头
    const headers = rows[0].map(h => h.trim().toLowerCase())
    const keyIndex = headers.findIndex(h => h === 'key')
    const labelIndex = headers.findIndex(h => h === 'label' || h === '显示名称' || h === '名称')

    if (keyIndex === -1 || labelIndex === -1) {
      return NextResponse.json({ error: '文件需包含 key 和 label 两列' }, { status: 400 })
    }

    // 获取现有条目，避免重复
    const existing = await getDictionaryEntries(ctx.teamId, category, module)
    const existingKeys = new Set(existing.map(e => e.key))

    // 解析数据行
    const entries: Array<{ key: string; label: string }> = []
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (row.length === 0 || row.every(cell => !cell)) continue

      const key = row[keyIndex]?.trim()
      const label = row[labelIndex]?.trim()

      if (!key || !label) continue
      if (existingKeys.has(key)) continue // 跳过已存在的

      entries.push({ key, label })
      existingKeys.add(key) // 避免同文件内重复
    }

    // 批量创建
    let count = 0
    for (const entry of entries) {
      try {
        await createDictionaryEntry({
          team_id: ctx.teamId,
          category,
          key: entry.key,
          label: entry.label,
          sort_order: existing.length + count,
          is_active: true,
          parent_id: null,
          level: 1,
          module: module || null,
          field_key: fieldKey,
          display_name: null,
        })
        count++
      } catch {
        // 忽略单条失败
      }
    }

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: '导入失败' }, { status: 500 })
  }
}
