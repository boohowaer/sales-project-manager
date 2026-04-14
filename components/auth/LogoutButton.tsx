'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { toast } from 'react-hot-toast'

export function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)

    try {
      // 调用退出登录 API
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('退出登录失败')
      }

      toast.success('已成功退出登录')
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('退出登录错误:', error)
      toast.error('退出登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleLogout}
      disabled={loading}
      className="w-full bg-white/10 text-white hover:bg-white/20 hover:text-white border-0 rounded-full"
      size="sm"
    >
      <LogOut className="w-4 h-4 mr-2" />
      {loading ? '退出中...' : '退出登录'}
    </Button>
  )
}
