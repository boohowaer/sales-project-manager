import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types'

// 使用单例模式：createBrowserClient 内部已正确处理并发 auth token 刷新锁
// 每次创建新实例反而会导致多个实例同时竞争 token 刷新，造成 session 意外失效
let client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}
