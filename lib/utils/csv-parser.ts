import type { CustomerInsert, ProjectInsert } from '@/types'

/**
 * CSV解析结果
 */
export interface CSVParseResult<T> {
  success: boolean
  data?: T[]
  errors?: Array<{
    row: number
    field: string
    message: string
  }>
  totalRows: number
}

/**
 * 解析CSV文本为对象数组
 */
export function parseCSV(csvText: string): string[][] {
  const lines: string[][] = []
  let currentLine: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const nextChar = csvText[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // 转义的引号
        currentField += '"'
        i++ // 跳过下一个引号
      } else {
        // 切换引号状态
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // 字段分隔符
      currentLine.push(currentField.trim())
      currentField = ''
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      // 行结束
      if (currentField || currentLine.length > 0) {
        currentLine.push(currentField.trim())
      }
      if (currentLine.length > 0) {
        lines.push(currentLine)
      }
      currentLine = []
      currentField = ''
      // 跳过换行符的下一个字符（如果是 \r\n）
      if (char === '\r' && nextChar === '\n') {
        i++
      }
    } else {
      currentField += char
    }
  }

  // 添加最后一个字段和行
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim())
    lines.push(currentLine)
  }

  return lines
}

/**
 * 验证邮箱格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 解析并标准化日期格式
 * 支持多种格式：YYYY-MM-DD, YYYY/M/D, YYYY-M-D, Excel日期等
 * 返回 YYYY-MM-DD 格式
 */
export function parseAndNormalizeDate(dateString: string): string | null {
  if (!dateString) return null

  // 尝试直接解析
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return null

  // 格式化为 YYYY-MM-DD
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * 验证日期格式
 * 支持多种格式：YYYY-MM-DD, YYYY/M/D, YYYY-M-D, Excel日期等
 */
export function isValidDate(dateString: string): boolean {
  if (!dateString) return false

  // 尝试解析日期
  const date = new Date(dateString)
  return !isNaN(date.getTime())
}

/**
 * 验证并解析客户CSV数据
 */
export function validateCustomerCSV(csvText: string): CSVParseResult<CustomerInsert> {
  const lines = parseCSV(csvText)

  if (lines.length < 2) {
    return {
      success: false,
      errors: [{ row: 0, field: 'file', message: 'CSV文件为空或格式不正确' }],
      totalRows: 0
    }
  }

  const headers = lines[0]
  const errors: Array<{ row: number; field: string; message: string }> = []
  const validCustomers: CustomerInsert[] = []

  // 清理表头名称（移除 * 标记）
  const cleanHeaders = headers.map(h => h.replace('*', '').trim())

  // 验证表头
  const requiredHeaders = ['客户名称']
  const optionalHeaders = ['公司名称', '邮箱', '电话', '备注']

  for (const required of requiredHeaders) {
    if (!cleanHeaders.includes(required)) {
      return {
        success: false,
        errors: [{ row: 1, field: 'header', message: `缺少必填列: ${required}` }],
        totalRows: lines.length - 1
      }
    }
  }

  // 解析数据行（从第二行开始）
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]
    const rowNum = i + 1

    if (row.length === 0 || row.every(cell => !cell)) {
      // 跳过空行
      continue
    }

    const customer: Partial<CustomerInsert> = {}
    let rowHasError = false

    // 客户名称 (必填)
    const nameIndex = cleanHeaders.indexOf('客户名称')
    if (nameIndex === -1 || !row[nameIndex]) {
      errors.push({ row: rowNum, field: '客户名称', message: '客户名称不能为空' })
      rowHasError = true
    } else if (row[nameIndex] && row[nameIndex].length > 200) {
      errors.push({ row: rowNum, field: '客户名称', message: '客户名称不能超过200个字符' })
      rowHasError = true
    } else {
      customer.name = row[nameIndex]?.trim() || ''
    }

    // 公司名称 (可选)
    const companyIndex = cleanHeaders.indexOf('公司名称')
    if (companyIndex !== -1 && row[companyIndex]) {
      if (row[companyIndex]!.length > 200) {
        errors.push({ row: rowNum, field: '公司名称', message: '公司名称不能超过200个字符' })
        rowHasError = true
      } else {
        customer.company = row[companyIndex]!.trim()
      }
    }

    // 邮箱 (可选)
    const emailIndex = cleanHeaders.indexOf('邮箱')
    if (emailIndex !== -1 && row[emailIndex]) {
      const email = row[emailIndex]!.trim()
      if (email.length > 200) {
        errors.push({ row: rowNum, field: '邮箱', message: '邮箱不能超过200个字符' })
        rowHasError = true
      } else if (!isValidEmail(email)) {
        errors.push({ row: rowNum, field: '邮箱', message: '邮箱格式不正确' })
        rowHasError = true
      } else {
        customer.email = email
      }
    }

    // 电话 (可选)
    const phoneIndex = cleanHeaders.indexOf('电话')
    if (phoneIndex !== -1 && row[phoneIndex]) {
      const phone = row[phoneIndex]!.trim()
      if (phone.length > 50) {
        errors.push({ row: rowNum, field: '电话', message: '电话不能超过50个字符' })
        rowHasError = true
      } else {
        customer.phone = phone
      }
    }

    // 备注 (可选)
    const notesIndex = cleanHeaders.indexOf('备注')
    if (notesIndex !== -1 && row[notesIndex]) {
      const notes = row[notesIndex]!.trim()
      if (notes.length > 5000) {
        errors.push({ row: rowNum, field: '备注', message: '备注不能超过5000个字符' })
        rowHasError = true
      } else {
        customer.notes = notes
      }
    }

    if (!rowHasError && customer.name) {
      validCustomers.push(customer as CustomerInsert)
    }
  }

  return {
    success: errors.length === 0,
    data: validCustomers,
    errors: errors.length > 0 ? errors : undefined,
    totalRows: validCustomers.length
  }
}

/**
 * 验证并解析项目CSV数据
 */
export function validateProjectCSV(
  csvText: string,
  existingCustomerNames: string[]
): CSVParseResult<ProjectInsert & { customer_name: string }> {
  const lines = parseCSV(csvText)

  if (lines.length < 2) {
    return {
      success: false,
      errors: [{ row: 0, field: 'file', message: 'CSV文件为空或格式不正确' }],
      totalRows: 0
    }
  }

  const headers = lines[0]
  const errors: Array<{ row: number; field: string; message: string }> = []
  const validProjects: Array<ProjectInsert & { customer_name: string }> = []

  // 清理表头名称（移除 * 标记）
  const cleanHeaders = headers.map(h => h.replace('*', '').trim())

  // 验证表头
  const requiredHeaders = ['项目名称', '客户名称']

  for (const required of requiredHeaders) {
    if (!cleanHeaders.includes(required)) {
      return {
        success: false,
        errors: [{ row: 1, field: 'header', message: `缺少必填列: ${required}` }],
        totalRows: lines.length - 1
      }
    }
  }

  // 解析数据行（从第二行开始）
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]
    const rowNum = i + 1

    if (row.length === 0 || row.every(cell => !cell)) {
      // 跳过空行
      continue
    }

    const project: Partial<ProjectInsert & { customer_name: string }> = {}
    let rowHasError = false

    // 项目名称 (必填)
    const nameIndex = cleanHeaders.indexOf('项目名称')
    if (nameIndex === -1 || !row[nameIndex]) {
      errors.push({ row: rowNum, field: '项目名称', message: '项目名称不能为空' })
      rowHasError = true
    } else if (row[nameIndex] && row[nameIndex].length > 200) {
      errors.push({ row: rowNum, field: '项目名称', message: '项目名称不能超过200个字符' })
      rowHasError = true
    } else {
      project.name = row[nameIndex]?.trim() || ''
    }

    // 客户名称 (必填)
    const customerNameIndex = cleanHeaders.indexOf('客户名称')
    if (customerNameIndex === -1 || !row[customerNameIndex]) {
      errors.push({ row: rowNum, field: '客户名称', message: '客户名称不能为空' })
      rowHasError = true
    } else {
      const customerName = row[customerNameIndex]!.trim()
      if (!existingCustomerNames.includes(customerName)) {
        errors.push({ row: rowNum, field: '客户名称', message: `客户"${customerName}"不存在，请先导入该客户` })
        rowHasError = true
      } else {
        project.customer_name = customerName
      }
    }

    // 项目描述 (可选)
    const descIndex = cleanHeaders.indexOf('项目描述')
    if (descIndex !== -1 && row[descIndex]) {
      if (row[descIndex]!.length > 5000) {
        errors.push({ row: rowNum, field: '项目描述', message: '项目描述不能超过5000个字符' })
        rowHasError = true
      } else {
        project.description = row[descIndex]!.trim()
      }
    }

    // 项目状态 (可选)
    const statusIndex = cleanHeaders.indexOf('项目状态')
    if (statusIndex !== -1 && row[statusIndex]) {
      const status = row[statusIndex]!.trim().toLowerCase()
      const validStatuses = ['active', 'won', 'lost', 'on_hold']
      if (!validStatuses.includes(status)) {
        errors.push({
          row: rowNum,
          field: '项目状态',
          message: `项目状态必须是以下之一: active, won, lost, on_hold`
        })
        rowHasError = true
      } else {
        project.status = status as 'active' | 'won' | 'lost' | 'on_hold'
      }
    } else {
      project.status = 'active'
    }

    // 项目金额 (可选)
    const valueIndex = cleanHeaders.indexOf('项目金额')
    if (valueIndex !== -1 && row[valueIndex]) {
      const valueStr = row[valueIndex]!.trim().replace(/[¥$,\s]/g, '')
      const value = parseFloat(valueStr)
      if (isNaN(value) || value < 0) {
        errors.push({ row: rowNum, field: '项目金额', message: '项目金额必须是有效的正数' })
        rowHasError = true
      } else {
        project.value = value
      }
    }

    // 成功概率 (可选)
    const probabilityIndex = cleanHeaders.indexOf('成功概率')
    if (probabilityIndex !== -1 && row[probabilityIndex]) {
      const probability = parseInt(row[probabilityIndex]!.trim())
      if (isNaN(probability) || probability < 0 || probability > 100) {
        errors.push({ row: rowNum, field: '成功概率', message: '成功概率必须是0-100之间的整数' })
        rowHasError = true
      } else {
        project.probability = probability
      }
    } else {
      project.probability = 50
    }

    // 开始日期 (可选)
    const startDateIndex = cleanHeaders.indexOf('开始日期')
    if (startDateIndex !== -1 && row[startDateIndex]) {
      const startDate = row[startDateIndex]!.trim()
      const normalizedDate = parseAndNormalizeDate(startDate)
      if (!normalizedDate) {
        errors.push({ row: rowNum, field: '开始日期', message: '开始日期格式不正确' })
        rowHasError = true
      } else {
        project.start_date = normalizedDate
      }
    }

    // 预期关闭日期 (可选)
    const expectedCloseDateIndex = cleanHeaders.indexOf('预期成交日期')
    if (expectedCloseDateIndex !== -1 && row[expectedCloseDateIndex]) {
      const expectedCloseDate = row[expectedCloseDateIndex]!.trim()
      const normalizedDate = parseAndNormalizeDate(expectedCloseDate)
      if (!normalizedDate) {
        errors.push({ row: rowNum, field: '预期关闭日期', message: '预期关闭日期格式不正确' })
        rowHasError = true
      } else {
        project.expected_close_date = normalizedDate
      }
    }

    // 有开工函 (可选)
    const hasStartNoticeIndex = cleanHeaders.indexOf('有开工函')
    if (hasStartNoticeIndex !== -1 && row[hasStartNoticeIndex]) {
      const value = row[hasStartNoticeIndex]!.trim().toLowerCase()
      project.has_start_notice = value === 'true' || value === '1'
    } else {
      project.has_start_notice = false
    }

    // 已签署合同 (可选)
    const contractSignedIndex = cleanHeaders.indexOf('已签署合同')
    if (contractSignedIndex !== -1 && row[contractSignedIndex]) {
      const value = row[contractSignedIndex]!.trim().toLowerCase()
      project.contract_signed = value === 'true' || value === '1'
    } else {
      project.contract_signed = false
    }

    // 归属年份 (可选)
    const belongYearIndex = cleanHeaders.indexOf('归属年份')
    if (belongYearIndex !== -1 && row[belongYearIndex]) {
      const year = parseInt(row[belongYearIndex]!.trim())
      if (isNaN(year) || year < 2000 || year > 2100) {
        errors.push({ row: rowNum, field: '归属年份', message: '归属年份必须是2000-2100之间的整数' })
        rowHasError = true
      } else {
        project.belong_year = year
      }
    }

    // 成交日期 (可选)
    const signedAtIndex = cleanHeaders.indexOf('成交日期')
    if (signedAtIndex !== -1 && row[signedAtIndex]) {
      const signedAt = row[signedAtIndex]!.trim()
      const normalizedDate = parseAndNormalizeDate(signedAt)
      if (!normalizedDate) {
        errors.push({ row: rowNum, field: '成交日期', message: '成交日期格式不正确' })
        rowHasError = true
      } else {
        project.signed_at = normalizedDate
      }
    }

    if (!rowHasError && project.name && project.customer_name) {
      validProjects.push(project as ProjectInsert & { customer_name: string })
    }
  }

  return {
    success: errors.length === 0,
    data: validProjects,
    errors: errors.length > 0 ? errors : undefined,
    totalRows: validProjects.length
  }
}
