import { createClient } from './client'

/**
 * 为新用户创建默认设置
 * 这个函数应该在用户注册后调用
 */
export async function initializeUserSettings(supabase?: any) {
  const client = supabase || await createClient()
  const { data: { user } } = await client.auth.getUser()

  if (!user) {
    return // 用户未认证，直接返回
  }

  try {
    // 检查设置是否已存在
    const { data: existing } = await client
      .from('user_settings')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return // 设置已存在，无需创建
    }

    // 创建默认设置
    const { error } = await client
      .from('user_settings')
      .insert({
        user_id: user.id,
        font_family: 'Inter',
        font_size: 14,
        theme: 'light',
        reminder_enabled: true,
        reminder_advance_hours: 24
      })

    if (error) {
      console.error('Failed to create user settings:', error)
    }
  } catch (error) {
    console.error('Error initializing user settings:', error)
    // 不抛出错误，因为这不是关键操作
  }
}
