import { NextResponse } from 'next/server'
import { getUserTeamContext, isSuperAdmin } from '@/lib/auth/get-user-role'
import {
  getDictionaryEntries,
  createDictionaryEntry,
  batchUpdateDictionaryEntries,
  batchDeleteDictionaryEntries,
  reorderDictionaryEntries,
  getDictionaryFieldConfigs,
  updateDictionaryFieldConfig,
  checkDictionaryUsage,
} from '@/lib/supabase/admin-queries'

export async function GET(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') ?? undefined
  const categoriesParam = searchParams.get('categories') ?? undefined
  const module = searchParams.get('module') ?? undefined
  const fields = searchParams.get('fields')

  // 获取字段配置列表
  if (fields === 'true') {
    const fieldConfigs = await getDictionaryFieldConfigs(ctx.teamId)
    return NextResponse.json(fieldConfigs)
  }

  // 多 category 一次查询：?categories=a,b,c
  const categories = categoriesParam ? categoriesParam.split(',').map(s => s.trim()).filter(Boolean) : undefined

  // 获取字典条目
  const entries = await getDictionaryEntries(ctx.teamId, categories ?? category, module)
  return NextResponse.json(entries)
}

export async function POST(request: Request) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()

  // 批量操作
  if (body.action === 'batch') {
    const { ids, updates } = body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids is required' }, { status: 400 })
    }

    if (updates) {
      await batchUpdateDictionaryEntries(ids, updates)
    }
    return NextResponse.json({ success: true })
  }

  // 批量删除
  if (body.action === 'batch_delete') {
    const { ids } = body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids is required' }, { status: 400 })
    }
    await batchDeleteDictionaryEntries(ids)
    return NextResponse.json({ success: true })
  }

  // 重排序
  if (body.action === 'reorder') {
    const { items } = body
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'items is required' }, { status: 400 })
    }
    await reorderDictionaryEntries(items)
    return NextResponse.json({ success: true })
  }

  // 更新字段配置
  if (body.action === 'update_field') {
    const { id, updates } = body
    if (!id || !updates) {
      return NextResponse.json({ error: 'id and updates are required' }, { status: 400 })
    }
    await updateDictionaryFieldConfig(id, updates)
    return NextResponse.json({ success: true })
  }

  // 创建单个条目
  const { category, key, label, sort_order = 0, parent_id, level = 1, module, field_key } = body
  if (!category || !key || !label) {
    return NextResponse.json({ error: 'category, key, label are required' }, { status: 400 })
  }

  const entry = await createDictionaryEntry({
    team_id: ctx.teamId,
    category,
    key,
    label,
    sort_order,
    is_active: true,
    parent_id: parent_id || null,
    level,
    module: module || null,
    field_key: field_key || null,
    display_name: null,
  })

  return NextResponse.json(entry, { status: 201 })
}
