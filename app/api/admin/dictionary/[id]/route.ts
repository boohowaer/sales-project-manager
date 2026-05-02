import { NextResponse } from 'next/server'
import { getUserTeamContext, isSuperAdmin } from '@/lib/auth/get-user-role'
import { updateDictionaryEntry, deleteDictionaryEntry, checkDictionaryUsage, getDictionaryEntries, updateDictionaryKeyWithCascade } from '@/lib/supabase/admin-queries'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json()

  // 如果要修改 key，先做级联处理
  if (body.key !== undefined) {
    const entries = await getDictionaryEntries(ctx.teamId)
    const entry = entries.find(e => e.id === id)
    if (!entry) {
      return NextResponse.json({ error: '字典项不存在' }, { status: 404 })
    }
    if (entry.key !== body.key) {
      // 校验同字段下 key 是否冲突
      const conflict = entries.find(e => e.id !== id && e.field_key === entry.field_key && e.key === body.key)
      if (conflict) {
        return NextResponse.json({ error: 'key 已存在' }, { status: 400 })
      }
      await updateDictionaryKeyWithCascade(ctx.teamId, id, entry.key, body.key, entry.field_key || '')
    }
    // 移除 key 后用普通 update 更新其他字段
    const { key: _ignored, ...rest } = body
    if (Object.keys(rest).length > 0) {
      await updateDictionaryEntry(id, rest)
    }
  } else {
    await updateDictionaryEntry(id, body)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getUserTeamContext()
  if (!ctx || !isSuperAdmin(ctx.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  // 检查引用
  const entries = await getDictionaryEntries(ctx.teamId)
  const entry = entries.find(e => e.id === id)
  if (entry && entry.field_key) {
    const usage = await checkDictionaryUsage(ctx.teamId, entry.field_key, entry.key)
    const totalCount = usage.reduce((sum, u) => sum + u.count, 0)
    if (totalCount > 0) {
      // 检查是否强制删除
      const { searchParams } = new URL(request.url)
      const force = searchParams.get('force') === 'true'
      if (!force) {
        return NextResponse.json({
          error: 'HAS_REFERENCES',
          affected: totalCount,
          details: usage,
          message: `该选项被 ${totalCount} 条数据引用，删除后这些数据的字段将显示为空`
        }, { status: 409 })
      }
    }
  }

  await deleteDictionaryEntry(id)
  return NextResponse.json({ ok: true })
}
