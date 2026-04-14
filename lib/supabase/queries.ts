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
export async function getCustomers(): Promise<Customer[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

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

  const { data, error } = await supabase
    .from('customers')
    .insert({ ...customer, user_id: user.id } as any)
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
export async function getProjects(): Promise<any[]> {
  const supabase = await createClient()

  // 先查询项目和客户
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('*, customers(*)')
    .order('created_at', { ascending: false })

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
    const totalStages = project.settlement_stages || 1
    const acceptedCount = projectSettlements.filter(s => s.accepted).length
    const invoicedCount = projectSettlements.filter(s => s.invoiced).length
    const paidCount = projectSettlements.filter(s => s.paid).length

    return {
      ...project,
      settlement_summary: {
        total: totalStages,
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

  const { data, error } = await supabase
    .from('projects')
    .insert({ ...project, user_id: user.id } as any)
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
export async function getTasks(): Promise<Task[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tasks')
    .select('*, projects(*, customers(*))')
    .order('due_date', { ascending: true })

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

export async function getUpcomingTasks(supabase?: any, days: number = 7): Promise<Task[]> {
  const client = supabase || await createClient()
  const now = new Date()
  const future = new Date()
  future.setDate(future.getDate() + days)

  const { data, error } = await client
    .from('tasks')
    .select('*, projects(*, customers(*))')
    .gte('due_date', now.toISOString())
    .lte('due_date', future.toISOString())
    .neq('status', 'completed')
    .order('due_date', { ascending: true })

  if (error) throw error
  return data || []
}

export async function createTask(task: TaskInsert): Promise<Task> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...task, user_id: user.id } as any)
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

  // 获取所有项目以计算统计数据
  const { data: allProjects, error: projectsError } = await client
    .from('projects')
    .select('status, value, probability')

  console.log('仪表盘统计 - 项目数据:', allProjects)
  console.log('仪表盘统计 - 项目错误:', projectsError)

  if (projectsError) {
    console.error('获取项目数据失败:', projectsError)
  }

  // 计算总项目数和活跃项目数
  const totalProjects = allProjects?.length || 0
  const activeProjects = allProjects?.filter(p => p.status === 'active').length || 0

  // 计算总价值和预期收入
  const totalValue = allProjects?.reduce((sum, p) => sum + (p.value || 0), 0) || 0
  const expectedValue = allProjects?.reduce((sum, p) => sum + ((p.value || 0) * (p.probability || 0) / 100), 0) || 0

  console.log('仪表盘统计 - 总项目数:', totalProjects)
  console.log('仪表盘统计 - 活跃项目:', activeProjects)
  console.log('仪表盘统计 - 总价值:', totalValue)

  // 获取所有任务（不计日期）
  const { data: allTasks, error: allTasksError } = await client
    .from('tasks')
    .select('id, due_date, status')

  console.log('仪表盘统计 - 所有任务:', allTasks)
  console.log('仪表盘统计 - 任务错误:', allTasksError)

  // 获取今日任务数
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  console.log('仪表盘统计 - 今日时间范围:', {
    today: today.toISOString(),
    tomorrow: tomorrow.toISOString()
  })

  const { data: todayTasksData, error: todayError } = await client
    .from('tasks')
    .select('id, due_date, status')
    .gte('due_date', today.toISOString())
    .lt('due_date', tomorrow.toISOString())
    .neq('status', 'completed')

  console.log('仪表盘统计 - 今日任务数据:', todayTasksData)
  console.log('仪表盘统计 - 今日任务错误:', todayError)

  const todayTasks = todayTasksData?.length || 0

  // 获取本周到期任务
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const { data: weekTasksData, error: weekError } = await client
    .from('tasks')
    .select('id')
    .gte('due_date', today.toISOString())
    .lte('due_date', weekEnd.toISOString())
    .neq('status', 'completed')

  console.log('仪表盘统计 - 本周任务数据:', weekTasksData)

  const weekTasks = weekTasksData?.length || 0

  const result = {
    totalProjects,
    activeProjects,
    totalValue,
    expectedValue,
    todayTasks,
    weekTasks
  }

  console.log('仪表盘统计 - 最终结果:', result)

  return result
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
