'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from '@/lib/supabase/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error('请填写所有字段')
      return
    }

    setLoading(true)

    try {
      await signIn(email, password)
      toast.success('登录成功！')
      router.push('/dashboard')
    } catch (error: any) {
      toast.error(error.message || '登录失败，请检查邮箱和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#e5e5e5' }}>
      <Card className="w-full max-w-md rounded-2xl shadow-xl border-0 bg-white">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-2xl font-bold text-center" style={{ color: '#090702' }}>登录</CardTitle>
          <CardDescription className="text-center text-zinc-600">
            输入您的邮箱和密码来访问您的项目管理工具
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-zinc-700">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm font-medium text-zinc-700">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-2">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
            <div className="text-sm text-center text-zinc-600">
              还没有账户？{' '}
              <Link href="/register" className="text-sky-600 hover:underline font-medium">
                注册
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
