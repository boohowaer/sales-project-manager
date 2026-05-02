import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables')
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options } as any)
            supabaseResponse.cookies.set({ name, value, ...options } as any)
          })
        },
      },
    }
  )

  try {
    const { data: { user } } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname
    const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
    const isDashboard = pathname.startsWith('/dashboard')
    const isPending = pathname.startsWith('/pending')

    if (!user && isDashboard) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // 已登录用户访问 dashboard：检查 pending/disabled 状态
    if (user && isDashboard) {
      const { data: member } = await supabase
        .from('team_members')
        .select('status')
        .eq('user_id', user.id)
        .single()
      if (member?.status === 'pending') {
        const url = request.nextUrl.clone()
        url.pathname = '/pending'
        return NextResponse.redirect(url)
      }
      if (member?.status === 'disabled') {
        const url = request.nextUrl.clone()
        url.pathname = '/disabled'
        return NextResponse.redirect(url)
      }
    }

    if (user && isAuthPage) {
      // 检查用户状态再决定跳转目标
      const { data: member } = await supabase
        .from('team_members')
        .select('status')
        .eq('user_id', user.id)
        .single()
      const url = request.nextUrl.clone()
      url.pathname = member?.status === 'pending' ? '/pending' : '/dashboard'
      return NextResponse.redirect(url)
    }

    // 已登录用户访问 /pending：若已 active 则跳 dashboard
    if (user && isPending) {
      const { data: member } = await supabase
        .from('team_members')
        .select('status')
        .eq('user_id', user.id)
        .single()
      if (member?.status === 'active') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }

    // 超管专属路由保护（成员管理、数据字典）
    const isSuperAdminRoute =
      pathname.startsWith('/dashboard/admin/users') ||
      pathname.startsWith('/dashboard/admin/dictionary')

    if (user && isSuperAdminRoute) {
      const { data: member } = await supabase
        .from('team_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (!member || member.role !== 'super_admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  } catch (error) {
    console.error('Proxy error:', error)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register', '/pending'],
}
