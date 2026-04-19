import { createClient } from './client'
import type {
  Customer,
  Project,
  Task,
  UserSettings,
  SettlementStage
} from '@/types'

// 简化的插入类型，避免类型推断问题
type CustomerInsert = Omit<Customer, 'id' | 'user_id' | 'created_at' | 'updated_at'>
type CustomerUpdate = Partial<Omit<Customer, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
type ProjectInsert = Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>
type ProjectUpdate = Partial<Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
type TaskInsert = Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'completed_at'>
type TaskUpdate = Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

type UserSettingsUpdate = Partial<Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
type SettlementStageInsert = Omit<SettlementStage, 'id' | 'created_at' | 'updated_at'>
type SettlementStageUpdate = Partial<Omit<SettlementStage, 'id' | 'created_at' | 'updated_at'>>

// 客户相关查询
export async function getCustomers(options?: { teamView?: boolean }): Promise<Customer[]> {
  const supabase = await createClient()
  let query = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  if (!options?.teamView) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) query = query.eq('user_id', user.id)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createCustomer(customer: CustomerInsert): Promise<Customer> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { data: member } = await supabase
    .from('team_members' as any)
    .select('team_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  const { data, error } = await supabase
    .from('customers')
    .insert({ ...customer, user_id: user.id, team_id: (member as any)?.team_id ?? null } as any)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateCustomer(id: string, customer: Partial<Customer>): Promise<Customer> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .update(customer as any)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// 项目相关查询
export async function getProjects(options?: { teamView?: boolean }): Promise<any[]> {
  const supabase = await createClient()

  let projectQuery = supabase
    .from('projects')
    .select('*, customers(*)')
    .order('created_at', { ascending: false })

  if (!options?.teamView) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) projectQuery = projectQuery.eq('user_id', user.id)
  }

  const { data: projects, error: projectsError } = await projectQuery

  if (projectsError) throw projectsError
  if (!projects || projects.length === 0) return []

  // 批量获取所有项目的结算段汇总数据
  const projectIds = projects.map(p => p.id)
  const { data: settlements, error: settlementsError } = await supabase
    .from('settlement_stages')
    .select('project_id, accepted, invoiced, paid')
    .in('project_id', projectIds)

  if (settlementsError) throw settlementsError

  // 为每个项目计算结算段状态
  return projects.map((project: any) => {
    const projectSettlements = settlements?.filter(s => s.project_id === project.id) || []
    // 根据实际的结算段数量计算，如果没有结算段则默认为1
    const actualStagesCount = projectSettlements.length > 0 ? projectSettlements.length : 1
    const acceptedCount = projectSettlements.filter(s => s.accepted).length
    const invoicedCount = projectSettlements.filter(s => s.invoiced).length
    const paidCount = projectSettlements.filter(s => s.paid).length

    return {
      ...project,
      settlement_stages: actualStagesCount, // 使用实际的结算段数量
      settlement_summary: {
        total: actualStagesCount,
        accepted: acceptedCount,
        invoiced: invoicedCount,
        paid: paidCount
      }
    }
  })
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*, customers(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function getProjectsByCustomer(customerId: string): Promise<Project[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createProject(project: ProjectInsert): Promise<Project> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { data: memberP } = await supabase
    .from('team_members' as any)
    .select('team_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  const { data, error } = await supabase
    .from('projects')
    .insert({ ...project, user_id: user.id, team_id: (memberP as any)?.team_id ?? null } as any)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateProject(id: string, project: Partial<Project>): Promise<Project> {
  const supabase = await createClient()

  console.log('Supabase updateProject - 输入数据:', { id, project })

  // 添加重试机制
  let lastError = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`Supabase updateProject - 尝试 ${attempt}/3`)

      // 先执行更新，不返回数据
      const { error: updateError } = await supabase
        .from('projects')
        .update(project as any)
        .eq('id', id)

      if (updateError) {
        console.error('Supabase updateProject - 更新错误:', {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        })
        throw updateError
      }

      // 更新成功后，单独查询数据
      const { data, error: selectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()

      if (selectError) {
        console.error('Supabase updateProject - 查询错误:', {
          message: selectError.message,
          details: selectError.details,
          hint: selectError.hint,
          code: selectError.code
        })
        throw selectError
      }

      console.log('Supabase updateProject - 成功！最终结果:', data)
      return data
    } catch (error: any) {
      lastError = error
      console.error(`Supabase updateProject - 尝试 ${attempt} 失败:`, error.message)

      // 如果是最后一次尝试，抛出错误
      if (attempt === 3) {
        throw error
      }

      // 等待一段时间后重试
      console.log(`Supabase updateProject - 等待 ${attempt * 500}ms 后重试...`)
      await new Promise(resolve => setTimeout(resolve, attempt * 500))
    }
  }

  throw lastError
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// 任务相关查询
export async function getTasks(options?: { teamView?: boolean }): Promise<Task[]> {
  const supabase = await createClient()
  let query = supabase
    .from('tasks')
    .select('*, projects(*, customers(*))')
    .order('due_date', { ascending: true })

  if (!options?.teamView) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) query = query.eq('user_id', user.id)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getTask(id: string): Promise<Task | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*, projects(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('due_date', { ascending: true })

  if (error) throw error
  return data || []
}

export async function getUpcomingTasks(supabase?: any, hours: number = 24): Promise<{
  overdue: Task[],
  upcoming: Task[],
  thisWeek: Task[]
}> {
  const client = supabase || await createClient()
  const now = new Date()

  // 获取已过期任务
  const { data: overdueData, error: overdueError } = await client
    .from('tasks')
    .select('*, projects(*, customers(*))')
    .lt('due_date', now.toISOString())
    .neq('status', 'completed')
    .order('due_date', { ascending: true })

  if (overdueError) throw overdueError

  // 获取即将到期任务（基于提前提醒小时数）
  const upcomingEnd = new Date(now.getTime() + hours * 60 * 60 * 1000)

  const { data: upcomingData, error: upcomingError } = await client
    .from('tasks')
    .select('*, projects(*, customers(*))')
    .gte('due_date', now.toISOString())
    .lte('due_date', upcomingEnd.toISOString())
    .neq('status', 'completed')
    .order('due_date', { ascending: true })

  if (upcomingError) throw upcomingError

  // 获取本周任务（到本周日结束）
  const weekEnd = new Date(now)
  const dayOfWeek = weekEnd.getDay()
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  weekEnd.setDate(weekEnd.getDate() + daysUntilSunday)
  weekEnd.setHours(23, 59, 59, 999)

  const { data: thisWeekData, error: thisWeekError } = await client
    .from('tasks')
    .select('*, projects(*, customers(*))')
    .gte('due_date', now.toISOString())
    .lte('due_date', weekEnd.toISOString())
    .neq('status', 'completed')
    .order('due_date', { ascending: true })

  if (thisWeekError) throw thisWeekError

  return {
    overdue: overdueData || [],
    upcoming: upcomingData || [],
    thisWeek: thisWeekData || []
  }
}

export async function createTask(task: TaskInsert): Promise<Task> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { data: memberT } = await supabase
    .from('team_members' as any)
    .select('team_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...task, user_id: user.id, team_id: (memberT as any)?.team_id ?? null } as any)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateTask(id: string, task: Partial<Task>): Promise<Task> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .update(task as any)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// 用户设置相关查询
export async function getUserSettings(): Promise<UserSettings | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    // 如果设置不存在，返回默认设置
    if (error.code === 'PGRST116') {
      return {
        id: '',
        user_id: user.id,
        font_family: 'Inter',
        font_size: 14,
        theme: 'light',
        reminder_enabled: true,
        reminder_advance_hours: 24,
        milestone_reminder_days: 7,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
    throw error
  }

  return data
}

export async function updateUserSettings(settings: UserSettingsUpdate): Promise<UserSettings> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  // 先尝试更新，如果记录不存在则插入
  const { data: existing, error: fetchError } = await supabase
    .from('user_settings')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError
  }

  if (!existing) {
    // 记录不存在，创建新记录
    const { data, error } = await supabase
      .from('user_settings')
      .insert({
        user_id: user.id,
        ...settings
      } as any)
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    // 记录存在，更新它
    const { data, error } = await supabase
      .from('user_settings')
      .update(settings as any)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// 统计相关查询
export async function getDashboardStats(supabase?: any) {
  const client = supabase || await createClient()

  // 获取当前年份
  const currentYear = new Date().getFullYear()

  // 本月起止
  const now2 = new Date()
  const monthStart = new Date(now2.getFullYear(), now2.getMonth(), 1)
  const monthEnd = new Date(now2.getFullYear(), now2.getMonth() + 1, 1)

  // 获取时间范围
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const weekEnd = new Date(today)
  const dayOfWeek = weekEnd.getDay()
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
  weekEnd.setDate(weekEnd.getDate() + daysUntilSunday)
  weekEnd.setHours(23, 59, 59, 999)

  const tomorrowStart = new Date(today)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  // 并行执行项目查询和任务查询（优化：减少数据库往返）
  const [projectsResult, tasksResult] = await Promise.all([
    client
      .from('projects')
      .select('id, status, value, probability, has_start_notice, contract_signed, created_at, signed_at')
      .eq('belong_year', currentYear),
    client
      .from('tasks')
      .select('id, due_date, status')
  ])

  const allProjects = projectsResult.data
  const allTasks = tasksResult.data || []

  // 计算项目统计数据
  const totalProjects = allProjects?.length || 0
  const activeProjects = allProjects?.filter(p => p.status === 'active').length || 0
  const totalValue = allProjects?.reduce((sum, p) => sum + (p.value || 0), 0) || 0
  const expectedValue = allProjects?.reduce((sum, p) => sum + ((p.value || 0) * (p.probability || 0) / 100), 0) || 0
  const signedWithStart = allProjects?.filter(p => p.has_start_notice || p.contract_signed).reduce((sum, p) => sum + (p.value || 0), 0) || 0
  const signedWithContract = allProjects?.filter(p => p.contract_signed).reduce((sum, p) => sum + (p.value || 0), 0) || 0

  // 获取结算阶段数据（需要 projectIds，所以放在后面）
  const projectIds = allProjects?.map(p => p.id) || []
  const { data: allSettlements } = await client
    .from('settlement_stages')
    .select('project_id, amount, accepted, invoiced, paid, accepted_date, invoiced_date, paid_date')
    .in('project_id', projectIds)

  // 计算已验收、已开票、已回款金额
  let acceptedAmount = 0
  let invoicedAmount = 0
  let paidAmount = 0

  if (allSettlements) {
    const projectSettlements = new Map<string, typeof allSettlements>()
    allSettlements.forEach(s => {
      if (!projectSettlements.has(s.project_id)) {
        projectSettlements.set(s.project_id, [])
      }
      projectSettlements.get(s.project_id)!.push(s)
    })

    projectSettlements.forEach((settlements, projectId) => {
      const project = allProjects?.find(p => p.id === projectId)

      if (!project || !project.value) {
        settlements.forEach(s => {
          if (s.accepted) acceptedAmount += (s.amount || 0)
          if (s.invoiced) invoicedAmount += (s.amount || 0)
          if (s.paid) paidAmount += (s.amount || 0)
        })
      } else {
        const totalStages = settlements.length
        const totalStageAmount = settlements.reduce((sum, s) => sum + (s.amount || 0), 0)

        if (totalStageAmount > 0) {
          const acceptedStageAmount = settlements.filter(s => s.accepted).reduce((sum, s) => sum + (s.amount || 0), 0)
          const invoicedStageAmount = settlements.filter(s => s.invoiced).reduce((sum, s) => sum + (s.amount || 0), 0)
          const paidStageAmount = settlements.filter(s => s.paid).reduce((sum, s) => sum + (s.amount || 0), 0)

          acceptedAmount += (acceptedStageAmount / totalStageAmount) * project.value
          invoicedAmount += (invoicedStageAmount / totalStageAmount) * project.value
          paidAmount += (paidStageAmount / totalStageAmount) * project.value
        } else {
          const acceptedStages = settlements.filter(s => s.accepted).length
          const invoicedStages = settlements.filter(s => s.invoiced).length
          const paidStages = settlements.filter(s => s.paid).length

          if (totalStages > 0) {
            acceptedAmount += (acceptedStages / totalStages) * project.value
            invoicedAmount += (invoicedStages / totalStages) * project.value
            paidAmount += (paidStages / totalStages) * project.value
          }
        }
      }
    })
  }

  // 计算本月新增
  const isThisMonth = (dateStr: string | null) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    return d >= monthStart && d < monthEnd
  }

  const monthlyTotalValue = allProjects?.filter(p => isThisMonth(p.created_at)).reduce((sum, p) => sum + (p.value || 0), 0) || 0
  const monthlyExpectedValue = allProjects?.filter(p => isThisMonth(p.created_at)).reduce((sum, p) => sum + ((p.value || 0) * (p.probability || 0) / 100), 0) || 0
  const monthlySigned = allProjects?.filter(p => p.signed_at && isThisMonth(p.signed_at)).reduce((sum, p) => sum + (p.value || 0), 0) || 0

  let monthlyAccepted = 0
  let monthlyInvoiced = 0
  let monthlyPaid = 0
  if (allSettlements) {
    allSettlements.forEach(s => {
      const project = allProjects?.find(p => p.id === s.project_id)
      const stageAmt = s.amount || 0
      if (isThisMonth(s.accepted_date)) monthlyAccepted += stageAmt
      if (isThisMonth(s.invoiced_date)) monthlyInvoiced += stageAmt
      if (isThisMonth(s.paid_date)) monthlyPaid += stageAmt
    })
  }

  // 计算今日和本周任务数（优化：从已获取的 allTasks 计算，无需额外查询）
  const todayTasks = allTasks.filter(t => {
    if (!t.due_date || t.status === 'completed') return false
    const dueDate = new Date(t.due_date)
    return dueDate >= today && dueDate < tomorrow
  }).length

  const weekTasks = allTasks.filter(t => {
    if (!t.due_date || t.status === 'completed') return false
    const dueDate = new Date(t.due_date)
    const isOverdue = dueDate < today
    const isThisWeek = dueDate >= tomorrowStart && dueDate <= weekEnd
    return isOverdue || isThisWeek
  }).length

  return {
    totalProjects,
    activeProjects,
    totalValue,
    expectedValue,
    signedWithStart,
    signedWithContract,
    acceptedAmount,
    invoicedAmount,
    paidAmount,
    todayTasks,
    weekTasks,
    monthlyTotalValue,
    monthlyExpectedValue,
    monthlySigned,
    monthlyAccepted,
    monthlyInvoiced,
    monthlyPaid,
  }
}

// 结算段相关查询
export async function getSettlementStages(projectId: string): Promise<SettlementStage[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('settlement_stages')
    .select('*')
    .eq('project_id', projectId)
    .order('stage_number', { ascending: true })

  if (error) throw error
  return data || []
}

// 批量获取结算阶段（解决 N+1 查询问题）
export async function getSettlementStagesBatch(projectIds: string[]): Promise<Map<string, SettlementStage[]>> {
  if (projectIds.length === 0) {
    return new Map()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('settlement_stages')
    .select('*')
    .in('project_id', projectIds)
    .order('stage_number', { ascending: true })

  if (error) throw error

  // 将结果按 project_id 分组
  const map = new Map<string, SettlementStage[]>()
  projectIds.forEach(id => map.set(id, []))
  data?.forEach(stage => {
    const stages = map.get(stage.project_id)
    if (stages) {
      stages.push(stage)
    }
  })

  return map
}

export async function createSettlementStage(stage: SettlementStageInsert): Promise<SettlementStage> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('settlement_stages')
    .insert(stage as any)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateSettlementStage(id: string, stage: Partial<SettlementStage>): Promise<SettlementStage> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('settlement_stages')
    .update(stage as any)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteSettlementStage(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('settlement_stages')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// 每周进展相关查询
export async function getWeeklyUpdates(): Promise<any[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('weekly_updates')
    .select('*, projects(*, customers(*))')
    .order('week', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getProjectWeeklyUpdates(projectId: string): Promise<any[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('weekly_updates')
    .select('*')
    .eq('project_id', projectId)
    .order('week', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createWeeklyUpdate(update: WeeklyUpdateInsert): Promise<any> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('weekly_updates')
    .insert(update as any)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateWeeklyUpdate(id: string, update: WeeklyUpdateUpdate): Promise<any> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('weekly_updates')
    .update(update as any)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteWeeklyUpdate(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('weekly_updates')
    .delete()
    .eq('id', id)

  if (error) throw error
}
