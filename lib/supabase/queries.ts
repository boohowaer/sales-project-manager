// @ts-nocheck
import { createClient } from './client'
import type {
  Customer,
  Project,
  Task,
  UserSettings,
  SettlementStage,
  WeeklyUpdate,
} from '@/types'

type WeeklyUpdateInsert = Omit<WeeklyUpdate, 'id' | 'created_at' | 'updated_at'>
type WeeklyUpdateUpdate = Partial<WeeklyUpdateInsert>

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

// ============ 性能优化：读取查询专用辅助函数 ============
// 用 getSession 替代 getUser，避免每次读取都向 Auth 服务器发请求验证 JWT
// RLS 策略已在数据库侧用 auth.uid() 校验权限，客户端不需要二次验证
async function getSessionUser(supabase: any) {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
}

// 进程内缓存 data_scope（5 分钟 TTL）。data_scope 几乎不变，重复查浪费一次 RTT。
let cachedDataScope: { userId: string; scope: 'own' | 'team'; expiresAt: number } | null = null
let cachedTeamId: { userId: string; teamId: string | null; expiresAt: number } | null = null

async function getDataScope(supabase: any, userId: string): Promise<'own' | 'team'> {
  if (cachedDataScope?.userId === userId && cachedDataScope.expiresAt > Date.now()) {
    return cachedDataScope.scope
  }
  const { data: member } = await supabase
    .from('team_members' as any)
    .select('data_scope')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()
  const scope = ((member as any)?.data_scope ?? 'own') as 'own' | 'team'
  cachedDataScope = { userId, scope, expiresAt: Date.now() + 5 * 60 * 1000 }
  return scope
}

// 浏览器侧 auth 状态变化时清空缓存（登出/切换账号）
if (typeof window !== 'undefined') {
  try {
    createClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        cachedDataScope = null
        cachedTeamId = null
      }
    })
  } catch {}
}

// 客户相关查询
export async function getCustomers(options?: { teamView?: boolean }): Promise<Customer[]> {
  const supabase = await createClient()

  const user = await getSessionUser(supabase)
  if (!user) throw new Error('Not authenticated')

  const dataScope = await getDataScope(supabase, user.id)

  let query = supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  if (dataScope === 'own' || !options?.teamView) {
    query = query.eq('user_id', user.id)
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

  // 先将关联项目的 customer_id 设为 null，避免级联删除
  await supabase
    .from('projects')
    .update({ customer_id: null } as any)
    .eq('customer_id', id)

  // 再删除客户
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// 项目相关查询
export async function getProjects(options?: { teamView?: boolean }): Promise<any[]> {
  const supabase = await createClient()

  const user = await getSessionUser(supabase)
  if (!user) throw new Error('Not authenticated')

  const dataScope = await getDataScope(supabase, user.id)

  let projectQuery = supabase
    .from('projects')
    .select('*, customers(*)')
    .order('created_at', { ascending: false })

  if (dataScope === 'own' || !options?.teamView) {
    projectQuery = projectQuery.eq('user_id', user.id)
  }

  const { data: projects, error: projectsError } = await projectQuery

  if (projectsError) throw projectsError
  if (!projects || projects.length === 0) return []

  // 批量获取所有项目的结算段数据
  const projectIds = projects.map(p => p.id)
  const { data: settlements, error: settlementsError } = (await supabase
    .from('settlement_stages' as any)
    .select('*')
    .in('project_id', projectIds)) as { data: any[] | null; error: any }

  if (settlementsError) throw settlementsError

  // 构建 project_id -> settlements 的 Map
  const settlementsByProject = new Map<string, any[]>()
  projectIds.forEach(id => settlementsByProject.set(id, []))
  settlements?.forEach((s: any) => {
    const arr = settlementsByProject.get(s.project_id)
    if (arr) arr.push(s)
  })

  // 为每个项目计算结算段状态
  return projects.map((project: any) => {
    const projectSettlements = settlementsByProject.get(project.id) || []
    const actualStagesCount = projectSettlements.length > 0 ? projectSettlements.length : 1
    const acceptedCount = projectSettlements.filter(s => s.accepted).length
    const invoicedCount = projectSettlements.filter(s => s.invoiced).length
    const paidCount = projectSettlements.filter(s => s.paid).length

    return {
      ...project,
      settlement_stages: actualStagesCount,
      settlement_summary: {
        total: actualStagesCount,
        accepted: acceptedCount,
        invoiced: invoicedCount,
        paid: paidCount
      },
      _settlements: projectSettlements
    }
  })
}

export async function getProjectsForTaskSelect(): Promise<{ id: string; name: string; belong_year?: number; value?: number; settlement_summary?: { paid: number; total: number } }[]> {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) throw new Error('Not authenticated')

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, belong_year, value, settlement_stages')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!projects || projects.length === 0) return []

  const projectIds = projects.map((p: any) => p.id)
  const { data: settlements } = await supabase
    .from('settlement_stages' as any)
    .select('project_id, paid')
    .in('project_id', projectIds)

  const paidByProject = new Map<string, number>()
  ;(settlements || []).forEach((s: any) => {
    paidByProject.set(s.project_id, (paidByProject.get(s.project_id) || 0) + (s.paid ? 1 : 0))
  })

  return projects.map((p: any) => {
    const total = p.settlement_stages || 1
    const paid = paidByProject.get(p.id) || 0
    return { id: p.id, name: p.name, belong_year: p.belong_year, value: p.value, settlement_summary: { paid, total } }
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

  // 添加重试机制
  let lastError = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
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

      return data
    } catch (error: any) {
      lastError = error
      console.error(`Supabase updateProject - 尝试 ${attempt} 失败:`, error.message)

      // 如果是最后一次尝试，抛出错误
      if (attempt === 3) {
        throw error
      }

      // 等待一段时间后重试
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

// 清理 14 天前已完成的任务（仅当前用户）
export async function cleanupOldCompletedTasks(): Promise<void> {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) return
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('tasks')
    .delete()
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .lt('completed_at', fourteenDaysAgo)
}

// 任务相关查询
export async function getTasks(options?: { mode?: 'mine' | 'shared' }): Promise<any[]> {
  const supabase = await createClient()

  const user = await getSessionUser(supabase)
  if (!user) throw new Error('Not authenticated')

  if (options?.mode === 'shared') {
    // 共享任务：我指派给别人的 + 别人同步/指派给我的
    const [outRes, inRes] = await Promise.all([
      // 我指派/同步出去的任务
      supabase
        .from('task_shares' as any)
        .select('share_type, to_user_id, tasks(*, projects(*, customers(*)))')
        .eq('from_user_id', user.id),
      // 别人指派/同步给我的任务
      supabase
        .from('task_shares' as any)
        .select('share_type, from_user_id, tasks(*, projects(*, customers(*)))')
        .eq('to_user_id', user.id),
    ])

    const outTasks = (outRes.data || []).map((s: any) => ({
      ...s.tasks,
      _shareType: s.share_type,
      _shareDirection: 'out',
      _shareWithUserId: s.to_user_id,
    }))
    const inTasks = (inRes.data || []).map((s: any) => ({
      ...s.tasks,
      _shareType: s.share_type,
      _shareDirection: 'in',
      _shareFromUserId: s.from_user_id,
    }))

    const all = [...outTasks, ...inTasks].filter(t => t != null)
    return all
  }

  // 只看我的：我创建的（未指派出去）+ 被别人指派给我的
  const [assignedOutRes, myTasksRes, assignedInRes] = await Promise.all([
    supabase.from('task_shares' as any).select('task_id').eq('from_user_id', user.id).eq('share_type', 'assign'),
    supabase.from('tasks').select('*, projects(*, customers(*))').eq('user_id', user.id).order('due_date', { ascending: true }),
    supabase.from('task_shares' as any).select('share_type, from_user_id, tasks(*, projects(*, customers(*)))').eq('to_user_id', user.id).eq('share_type', 'assign'),
  ])

  if (myTasksRes.error) throw myTasksRes.error
  const assignedOutIds = new Set((assignedOutRes.data || []).map((s: any) => s.task_id))
  const myTasks = (myTasksRes.data || []).filter((t: any) => !assignedOutIds.has(t.id))
  const assignedInTasks = (assignedInRes.data || [])
    .map((s: any) => s.tasks ? { ...s.tasks, _shareType: 'assign', _shareDirection: 'in', _shareWithUserId: s.from_user_id } : null)
    .filter(Boolean)
  return [...myTasks, ...assignedInTasks]
}

export async function shareTask(taskId: string, toUserId: string, shareType: 'assign' | 'sync'): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('task_shares' as any)
    .upsert({ task_id: taskId, from_user_id: user.id, to_user_id: toUserId, share_type: shareType }, { onConflict: 'task_id,to_user_id' })
  if (error) throw error
}

export async function unshareTask(taskId: string, toUserId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('task_shares' as any)
    .delete()
    .eq('task_id', taskId)
    .eq('from_user_id', user.id)
    .eq('to_user_id', toUserId)
  if (error) throw error
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

  const user = await getSessionUser(client)
  if (!user) return { overdue: [], upcoming: [], thisWeek: [] }

  const dataScope = await getDataScope(client, user.id)

  const baseQuery = () => {
    let q = client.from('tasks').select('*, projects(*, customers(*))')
    q = q.eq('user_id', user.id)
    return q
  }

  const { data: overdueData, error: overdueError } = await baseQuery()
    .lt('due_date', now.toISOString())
    .neq('status', 'completed')
    .order('due_date', { ascending: true })
  if (overdueError) throw overdueError

  const upcomingEnd = new Date(now.getTime() + hours * 60 * 60 * 1000)
  const { data: upcomingData, error: upcomingError } = await baseQuery()
    .gte('due_date', now.toISOString())
    .lte('due_date', upcomingEnd.toISOString())
    .neq('status', 'completed')
    .order('due_date', { ascending: true })
  if (upcomingError) throw upcomingError

  const weekEnd = new Date(now)
  const dayOfWeek = weekEnd.getDay()
  weekEnd.setDate(weekEnd.getDate() + (dayOfWeek === 0 ? 0 : 7 - dayOfWeek))
  weekEnd.setHours(23, 59, 59, 999)

  const { data: thisWeekData, error: thisWeekError } = await baseQuery()
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
  const user = await getSessionUser(supabase)

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
        font_family: 'Poppins, system-ui',
        font_size: 15,
        theme: 'light',
        reminder_enabled: true,
        reminder_advance_hours: 24,
        milestone_reminder_days: 7,
        sales_goal: null,
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
  const user = await getSessionUser(client)
  if (!user) throw new Error('Not authenticated')

  const dataScope = await getDataScope(client, user.id)

  let projectQuery = client
    .from('projects')
    .select('id, status, value, probability, has_start_notice, contract_signed, created_at, signed_at')
    .eq('belong_year', currentYear)
    .eq('user_id', user.id)

  let taskQuery = client
    .from('tasks')
    .select('id, due_date, status')
    .eq('user_id', user.id)

  const [projectsResult, tasksResult] = await Promise.all([
    projectQuery,
    taskQuery,
  ])

  const allProjects = projectsResult.data
  const allTasks = tasksResult.data || []

  // settlements 查询与后续计算并行启动
  const projectIds = allProjects?.map(p => p.id) || []
  const settlementsPromise = projectIds.length > 0
    ? client.from('settlement_stages' as any)
        .select('project_id, amount, accepted, invoiced, paid, accepted_date, invoiced_date, paid_date')
        .in('project_id', projectIds)
    : Promise.resolve({ data: [] })

  const { data: allSettlements } = await settlementsPromise as { data: Array<{ project_id: string; amount: number | null; accepted: boolean; invoiced: boolean; paid: boolean; accepted_date: string | null; invoiced_date: string | null; paid_date: string | null }> | null }

  // 计算项目统计数据
  const totalProjects = allProjects?.length || 0
  const activeProjects = allProjects?.filter(p => p.status === 'active').length || 0
  const totalValue = allProjects?.reduce((sum, p) => sum + (p.value || 0), 0) || 0
  const expectedValue = allProjects?.reduce((sum, p) => sum + ((p.value || 0) * (p.probability || 0) / 100), 0) || 0
  const signedWithStart = allProjects?.filter(p => p.has_start_notice || p.contract_signed).reduce((sum, p) => sum + (p.value || 0), 0) || 0
  const signedWithContract = allProjects?.filter(p => p.contract_signed).reduce((sum, p) => sum + (p.value || 0), 0) || 0

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

export async function getProjectsForDashboard(): Promise<any[]> {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) throw new Error('Not authenticated')

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, value, expected_close_date, contract_signed, customers(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!projects || projects.length === 0) return []

  const projectIds = projects.map((p: any) => p.id)
  const { data: settlements } = await supabase
    .from('settlement_stages' as any)
    .select('project_id, planned_accepted_date, accepted, planned_invoiced_date, invoiced, planned_paid_date, paid')
    .in('project_id', projectIds)

  const settlementsByProject = new Map<string, any[]>()
  projectIds.forEach((id: string) => settlementsByProject.set(id, []))
  ;(settlements || []).forEach((s: any) => {
    settlementsByProject.get(s.project_id)?.push(s)
  })

  return projects.map((p: any) => ({
    ...p,
    _settlements: settlementsByProject.get(p.id) || [],
  }))
}

// 仪表板数据：合并 stats + 项目列表，共用 projects/settlement_stages 查询
export async function getDashboardData() {
  const client = await createClient()
  const user = await getSessionUser(client)
  if (!user) throw new Error('Not authenticated')

  const currentYear = new Date().getFullYear()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStart = new Date(tomorrow)

  const weekEnd = new Date(today)
  const dayOfWeek = weekEnd.getDay()
  weekEnd.setDate(weekEnd.getDate() + (dayOfWeek === 0 ? 0 : 7 - dayOfWeek))
  weekEnd.setHours(23, 59, 59, 999)

  const projectsQuery = client
    .from('projects')
    .select('id, name, status, value, probability, has_start_notice, contract_signed, created_at, signed_at, expected_close_date, belong_year, customers(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const tasksQuery = client
    .from('tasks')
    .select('id, due_date, status')
    .eq('user_id', user.id)

  const [projectsResult, tasksResult] = await Promise.all([projectsQuery, tasksQuery])
  const allProjects: any[] = projectsResult.data || []
  const allTasks: any[] = tasksResult.data || []

  const projectIds = allProjects.map(p => p.id)
  const settlementsResult = projectIds.length > 0
    ? await client.from('settlement_stages' as any)
        .select('project_id, amount, accepted, invoiced, paid, accepted_date, invoiced_date, paid_date, planned_accepted_date, planned_invoiced_date, planned_paid_date')
        .in('project_id', projectIds)
    : { data: [] as any[] }
  const allSettlements: any[] = settlementsResult.data || []

  // ----- 当年项目用于 stats -----
  const yearProjects = allProjects.filter(p => p.belong_year === currentYear)
  const yearProjectIds = new Set(yearProjects.map(p => p.id))
  const yearSettlements = allSettlements.filter(s => yearProjectIds.has(s.project_id))

  const totalProjects = yearProjects.length
  const activeProjects = yearProjects.filter(p => p.status === 'active').length
  const totalValue = yearProjects.reduce((sum, p) => sum + (p.value || 0), 0)
  const expectedValue = yearProjects.reduce((sum, p) => sum + ((p.value || 0) * (p.probability || 0) / 100), 0)
  const signedWithStart = yearProjects.filter(p => p.has_start_notice || p.contract_signed).reduce((sum, p) => sum + (p.value || 0), 0)
  const signedWithContract = yearProjects.filter(p => p.contract_signed).reduce((sum, p) => sum + (p.value || 0), 0)

  // 已验收/开票/回款（按 settlement 比例分摊到 project.value）
  let acceptedAmount = 0, invoicedAmount = 0, paidAmount = 0
  const settlementsByYearProject = new Map<string, any[]>()
  yearSettlements.forEach(s => {
    if (!settlementsByYearProject.has(s.project_id)) settlementsByYearProject.set(s.project_id, [])
    settlementsByYearProject.get(s.project_id)!.push(s)
  })
  settlementsByYearProject.forEach((stages, projectId) => {
    const project = yearProjects.find(p => p.id === projectId)
    if (!project || !project.value) {
      stages.forEach(s => {
        if (s.accepted) acceptedAmount += (s.amount || 0)
        if (s.invoiced) invoicedAmount += (s.amount || 0)
        if (s.paid) paidAmount += (s.amount || 0)
      })
    } else {
      const totalStageAmount = stages.reduce((sum, s) => sum + (s.amount || 0), 0)
      if (totalStageAmount > 0) {
        const accAmt = stages.filter(s => s.accepted).reduce((sum, s) => sum + (s.amount || 0), 0)
        const invAmt = stages.filter(s => s.invoiced).reduce((sum, s) => sum + (s.amount || 0), 0)
        const pdAmt = stages.filter(s => s.paid).reduce((sum, s) => sum + (s.amount || 0), 0)
        acceptedAmount += (accAmt / totalStageAmount) * project.value
        invoicedAmount += (invAmt / totalStageAmount) * project.value
        paidAmount += (pdAmt / totalStageAmount) * project.value
      } else {
        const totalStages = stages.length
        if (totalStages > 0) {
          const acc = stages.filter(s => s.accepted).length
          const inv = stages.filter(s => s.invoiced).length
          const pd = stages.filter(s => s.paid).length
          acceptedAmount += (acc / totalStages) * project.value
          invoicedAmount += (inv / totalStages) * project.value
          paidAmount += (pd / totalStages) * project.value
        }
      }
    }
  })

  const isThisMonth = (dateStr: string | null) => {
    if (!dateStr) return false
    const d = new Date(dateStr)
    return d >= monthStart && d < monthEnd
  }
  const monthlyTotalValue = yearProjects.filter(p => isThisMonth(p.created_at)).reduce((sum, p) => sum + (p.value || 0), 0)
  const monthlyExpectedValue = yearProjects.filter(p => isThisMonth(p.created_at)).reduce((sum, p) => sum + ((p.value || 0) * (p.probability || 0) / 100), 0)
  const monthlySigned = yearProjects.filter(p => p.signed_at && isThisMonth(p.signed_at)).reduce((sum, p) => sum + (p.value || 0), 0)

  let monthlyAccepted = 0, monthlyInvoiced = 0, monthlyPaid = 0
  yearSettlements.forEach(s => {
    const stageAmt = s.amount || 0
    if (isThisMonth(s.accepted_date)) monthlyAccepted += stageAmt
    if (isThisMonth(s.invoiced_date)) monthlyInvoiced += stageAmt
    if (isThisMonth(s.paid_date)) monthlyPaid += stageAmt
  })

  const todayTasks = allTasks.filter(t => {
    if (!t.due_date || t.status === 'completed') return false
    const d = new Date(t.due_date)
    return d >= today && d < tomorrow
  }).length
  const weekTasks = allTasks.filter(t => {
    if (!t.due_date || t.status === 'completed') return false
    const d = new Date(t.due_date)
    return d < today || (d >= tomorrowStart && d <= weekEnd)
  }).length

  const stats = {
    totalProjects, activeProjects, totalValue, expectedValue,
    signedWithStart, signedWithContract,
    acceptedAmount, invoicedAmount, paidAmount,
    todayTasks, weekTasks,
    monthlyTotalValue, monthlyExpectedValue, monthlySigned,
    monthlyAccepted, monthlyInvoiced, monthlyPaid,
  }

  // ----- projects 列表（用于侧栏关注节点 + 通知铃，跨年）-----
  const settlementsByProject = new Map<string, any[]>()
  allProjects.forEach(p => settlementsByProject.set(p.id, []))
  allSettlements.forEach(s => settlementsByProject.get(s.project_id)?.push(s))
  const projects = allProjects.map(p => ({
    ...p,
    _settlements: settlementsByProject.get(p.id) || [],
  }))

  return { stats, projects }
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

// 进展页数据：合并 projects（含客户、结算段统计） + weekly_updates，共用 auth
export async function getUpdatesData(): Promise<{ projects: any[]; updates: any[] }> {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) throw new Error('Not authenticated')

  const [projectsResult, updatesResult] = await Promise.all([
    supabase
      .from('projects')
      .select('*, customers(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('weekly_updates')
      .select('id, project_id, week, content, created_at, updated_at')
      .order('week', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (projectsResult.error) throw projectsResult.error
  if (updatesResult.error) throw updatesResult.error

  const projects = projectsResult.data || []
  const updates = updatesResult.data || []
  if (projects.length === 0) return { projects: [], updates }

  const projectIds = projects.map((p: any) => p.id)
  const { data: settlements, error: settlementsError } = (await supabase
    .from('settlement_stages' as any)
    .select('*')
    .in('project_id', projectIds)) as { data: any[] | null; error: any }
  if (settlementsError) throw settlementsError

  const settlementsByProject = new Map<string, any[]>()
  projectIds.forEach((id: string) => settlementsByProject.set(id, []))
  ;(settlements || []).forEach((s: any) => settlementsByProject.get(s.project_id)?.push(s))

  const enrichedProjects = projects.map((project: any) => {
    const ps = settlementsByProject.get(project.id) || []
    const actualStagesCount = ps.length > 0 ? ps.length : 1
    return {
      ...project,
      settlement_stages: actualStagesCount,
      settlement_summary: {
        total: actualStagesCount,
        accepted: ps.filter((s: any) => s.accepted).length,
        invoiced: ps.filter((s: any) => s.invoiced).length,
        paid: ps.filter((s: any) => s.paid).length,
      },
      _settlements: ps,
    }
  })

  return { projects: enrichedProjects, updates }
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
