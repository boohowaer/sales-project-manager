'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'react-hot-toast'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name || !email || !password || !confirmPassword) {
      toast.error('请填写所有字段')
      return
    }

    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }

    if (password.length < 6) {
      toast.error('密码至少需要6个字符')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '注册失败，请稍后重试')
        return
      }
      window.location.href = '/pending'
    } catch (error: any) {
      toast.error(error.message || '注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#e5e5e5' }}>
      <Card className="w-full max-w-md rounded-2xl shadow-xl border-0 bg-white">
        <CardHeader className="space-y-1 pb-6">
          <CardTitle className="text-2xl font-bold text-center" style={{ color: '#090702' }}>注册账户</CardTitle>
          <CardDescription className="text-center text-zinc-600">
            创建一个新账户来开始管理您的销售项目
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-zinc-700">姓名</Label>
              <Input
                id="name"
                type="text"
                placeholder="张三"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
                className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
              />
            </div>
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
                placeholder="至少6个字符"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                minLength={6}
                className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-700">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
                minLength={6}
                className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400 focus:ring-zinc-400"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-2">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '注册中...' : '注册'}
            </Button>
            <div className="text-sm text-center text-zinc-600">
              已有账户？{' '}
              <Link href="/login" className="text-sky-600 hover:underline font-medium">
                登录
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
