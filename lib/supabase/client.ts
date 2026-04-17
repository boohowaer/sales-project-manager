import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types'

// 每次调用都创建新实例，避免并发请求的 auth token 锁竞争问题
// 在 Turbopack/HMR 环境下，单例模式会导致多个请求竞争同一个 auth token 锁
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
