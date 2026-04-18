'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
    <button
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center w-full px-3 py-2.5 pr-4 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-full transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <LogOut className="w-4.5 h-4.5 mr-4 transition-colors text-zinc-500" />
      {loading ? 'Logging out...' : 'Log Out'}
    </button>
  )
}
