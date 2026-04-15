import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateProjectCSV } from '@/lib/utils/csv-parser'
import type { ProjectInsert } from '@/types'
import * as XLSX from 'xlsx'

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

    // 获取用户的客户列表（用于验证客户名称）
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name')
      .eq('user_id', user.id)

    if (customersError) {
      console.error('获取客户列表失败:', customersError)
      return NextResponse.json(
        { error: '获取客户列表失败' },
        { status: 500 }
      )
    }

    const customerNames = customers?.map(c => c.name) || []

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
      validationResult = validateProjectCSV(csvData, customerNames)
    } else {
      // 处理CSV文件
      const text = await file.text()
      validationResult = validateProjectCSV(text, customerNames)
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

    // 获取现有项目列表（用于去重）
    const { data: existingProjects, error: fetchProjectsError } = await supabase
      .from('projects')
      .select('name, customer_id')
      .eq('user_id', user.id)

    if (fetchProjectsError) {
      console.error('获取现有项目列表失败:', fetchProjectsError)
      return NextResponse.json(
        { error: '获取现有项目列表失败' },
        { status: 500 }
      )
    }

    // 创建现有项目的唯一标识集合（项目名称+客户ID）
    const existingProjectKeys = new Set(
      existingProjects?.map(p => `${p.name}-${p.customer_id}`) || []
    )

    // 在新导入的数据中，找出重复组并选择最完整的一条
    const projectGroups = new Map<string, Array<ProjectInsert & { customer_name: string }>>()
    validationResult.data!.forEach(project => {
      const customer = customers!.find(c => c.name === project.customer_name)
      const key = `${project.name}-${customer!.id}`
      if (!projectGroups.has(key)) {
        projectGroups.set(key, [])
      }
      projectGroups.get(key)!.push(project)
    })

    // 对每个重复组，选择字段信息最完整的一条
    const newProjects: Array<ProjectInsert & { customer_name: string }> = []
    let skippedInImportCount = 0

    projectGroups.forEach((group, key) => {
      // 如果与数据库中已存在的项目重复，跳过整个组
      if (existingProjectKeys.has(key)) {
        skippedInImportCount += group.length
        return
      }

      // 如果组内有多条重复数据，选择最完整的一条
      if (group.length > 1) {
        // 计算每条数据的完整度（非空字段数量）
        const scored = group.map(p => ({
          project: p,
          score: [
            p.name ? 1 : 0,
            p.description ? 1 : 0,
            p.value !== null && p.value !== undefined ? 1 : 0,
            p.start_date ? 1 : 0,
            p.expected_close_date ? 1 : 0,
            p.probability !== null ? 1 : 0,
            p.belong_year !== null ? 1 : 0
          ].reduce((a, b) => a + b, 0)
        }))

        // 按完整度降序排序，选择最高分的一条
        scored.sort((a, b) => b.score - a.score)
        newProjects.push(scored[0].project)
        skippedInImportCount += group.length - 1
      } else {
        newProjects.push(group[0])
      }
    })

    const skippedCount = skippedInImportCount

    if (newProjects.length === 0) {
      return NextResponse.json({
        success: true,
        message: '所有项目都已存在，跳过导入',
        importedCount: 0,
        skippedCount: skippedCount,
        totalRows: validationResult.data!.length
      })
    }

    // 批量插入新项目数据
    const projectsToInsert = newProjects.map(project => {
      // 找到对应的customer_id
      const customer = customers!.find(c => c.name === project.customer_name)
      return {
        name: project.name,
        description: project.description,
        customer_id: customer!.id,
        status: project.status,
        value: project.value,
        probability: project.probability,
        start_date: project.start_date,
        expected_close_date: project.expected_close_date,
        actual_close_date: null,
        has_start_notice: project.has_start_notice,
        contract_signed: project.contract_signed,
        belong_year: project.belong_year,
        user_id: user.id
      }
    })

    const { data: insertedProjects, error: insertError } = await supabase
      .from('projects')
      .insert(projectsToInsert)
      .select()

    if (insertError) {
      console.error('插入项目数据失败:', insertError)
      return NextResponse.json(
        { error: '导入数据失败: ' + insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: skippedCount > 0
        ? `成功导入 ${projectsToInsert.length} 条新项目数据，跳过 ${skippedCount} 条已存在的项目`
        : `成功导入 ${projectsToInsert.length} 条项目数据`,
      importedCount: projectsToInsert.length,
      skippedCount: skippedCount,
      totalRows: validationResult.data!.length,
      data: insertedProjects
    })

  } catch (error: any) {
    console.error('导入项目数据错误:', error)
    return NextResponse.json(
      { error: '导入失败: ' + (error.message || '未知错误') },
      { status: 500 }
    )
  }
}
