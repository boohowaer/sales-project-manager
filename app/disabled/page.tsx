import { LogoutButton } from '@/components/auth/LogoutButton'

export default function DisabledPage() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-900">账号已被禁用</h1>
        <p className="text-zinc-500 text-sm">你的账号已被管理员禁用，请联系管理员恢复访问权限。</p>
        <LogoutButton />
      </div>
    </div>
  )
}
