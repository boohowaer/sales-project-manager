// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateCustomerCSV } from '@/lib/utils/csv-parser'
import { submitApprovalRequest } from '@/lib/supabase/approval-queries'
import { writeNotifications, getTeamSalesManagers } from '@/lib/supabase/notification-queries'
import type { CustomerInsert } from '@/types'
import * as XLSX from 'xlsx'

async function getUserRole(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('users').select('role, team_id').eq('id', userId).single()
  return data ? { role: data.role, teamId: data.team_id } : null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      )
    }

    // 获取表单数据
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: '请选择要导入的文件' },
        { status: 400 }
      )
    }

    // 检查文件类型
    const fileName = file.name.toLowerCase()
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    const isCSV = fileName.endsWith('.csv')

    if (!isExcel && !isCSV) {
      return NextResponse.json(
        { error: '只支持CSV或Excel格式的文件' },
        { status: 400 }
      )
    }

    // 读取并解析文件内容
    let validationResult

    if (isExcel) {
      // 处理Excel文件
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]

      // 转换为CSV格式
      const csvData = XLSX.utils.sheet_to_csv(worksheet)
      validationResult = validateCustomerCSV(csvData)
    } else {
      // 处理CSV文件
      const text = await file.text()
      validationResult = validateCustomerCSV(text)
    }

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: '数据验证失败',
          errors: validationResult.errors,
          totalRows: validationResult.totalRows
        },
        { status: 400 }
      )
    }

    // 获取用户角色信息（用于后续审批判断）
    const userRoleInfo = await getUserRole(user.id)

    // 获取现有客户列表（用于去重）
    const { data: existingCustomers, error: fetchError } = await supabase
      .from('customers')
      .select('name, company')
      .eq('user_id', user.id)

    if (fetchError) {
      console.error('获取现有客户列表失败:', fetchError)
      return NextResponse.json(
        { error: '获取现有客户列表失败' },
        { status: 500 }
      )
    }

    // 创建现有客户的唯一标识集合（客户名称+公司名称）
    const existingCustomerKeys = new Set(
      existingCustomers?.map(c => `${c.name}|${c.company || ''}`) || []
    )

    // 在新导入的数据中，找出重复组并选择最完整的一条
    const customerGroups = new Map<string, CustomerInsert[]>()
    validationResult.data!.forEach(customer => {
      const key = `${customer.name}|${customer.company || ''}`
      if (!customerGroups.has(key)) {
        customerGroups.set(key, [])
      }
      customerGroups.get(key)!.push(customer)
    })

    // 对每个重复组，选择字段信息最完整的一条
    const newCustomers: CustomerInsert[] = []
    let skippedInImportCount = 0

    customerGroups.forEach((group, key) => {
      // 如果与数据库中已存在的客户重复，跳过整个组
      if (existingCustomerKeys.has(key)) {
        skippedInImportCount += group.length
        return
      }

      // 如果组内有多条重复数据，选择最完整的一条
      if (group.length > 1) {
        // 计算每条数据的完整度（非空字段数量）
        const scored = group.map(c => ({
          customer: c,
          score: [
            c.name ? 1 : 0,
            c.company ? 1 : 0,
            c.email ? 1 : 0,
            c.phone ? 1 : 0,
            c.notes ? 1 : 0
          ].reduce((a, b) => a + b, 0)
        }))

        // 按完整度降序排序，选择最高分的一条
        scored.sort((a, b) => b.score - a.score)
        newCustomers.push(scored[0].customer)
        skippedInImportCount += group.length - 1
      } else {
        newCustomers.push(group[0])
      }
    })

    const skippedCount = skippedInImportCount

    if (newCustomers.length === 0) {
      return NextResponse.json({
        success: true,
        message: '所有客户都已存在，跳过导入',
        importedCount: 0,
        skippedCount: skippedCount,
        totalRows: validationResult.data!.length
      })
    }

    // 准备插入数据
    const customersToInsert = newCustomers.map(customer => ({
      ...customer,
      user_id: user.id
    }))

    // 检查用户角色，sales_rep 需要走审批流程
    if (userRoleInfo?.role === 'sales_rep') {
      // 逐条创建审批请求
      let approvalCount = 0
      const step1Approvers = await getTeamSalesManagers(userRoleInfo.teamId)

      for (const customer of customersToInsert) {
        const req = await submitApprovalRequest({
          teamId: userRoleInfo.teamId,
          type: 'create_customer',
          targetId: null,
          payload: customer,
          submittedBy: user.id,
          submitterRole: userRoleInfo.role,
        })

        const subject = customer.name ? `新建客户：${customer.name}` : '新建客户'
        await writeNotifications(
          step1Approvers.map(uid => ({
            userId: uid,
            type: 'approval_submitted' as const,
            title: '待审批',
            body: `「${subject}」等待你审批`,
            linkType: 'approval' as const,
            linkId: req.id,
          }))
        )
        approvalCount++
      }

      return NextResponse.json({
        success: true,
        message: `已提交 ${approvalCount} 条客户审批${skippedCount > 0 ? `，跳过 ${skippedCount} 条已存在的客户` : ''}`,
        importedCount: approvalCount,
        skippedCount: skippedCount,
        totalRows: validationResult.data!.length,
        pendingApproval: true
      })
    }

    // 非销售代表，直接批量插入
    const { data: insertedCustomers, error: insertError } = await supabase
      .from('customers')
      .insert(customersToInsert)
      .select()

    if (insertError) {
      console.error('插入客户数据失败:', insertError)
      return NextResponse.json(
        { error: '导入数据失败: ' + insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: skippedCount > 0
        ? `成功导入 ${customersToInsert.length} 条新客户数据，跳过 ${skippedCount} 条已存在的客户`
        : `成功导入 ${customersToInsert.length} 条客户数据`,
      importedCount: customersToInsert.length,
      skippedCount: skippedCount,
      totalRows: validationResult.data!.length,
      data: insertedCustomers
    })

  } catch (error: any) {
    console.error('导入客户数据错误:', error)
    return NextResponse.json(
      { error: '导入失败: ' + (error.message || '未知错误') },
      { status: 500 }
    )
  }
}
