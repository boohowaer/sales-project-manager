import { LogoutButton } from '@/components/auth/LogoutButton'

export default function PendingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm px-4">
        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-zinc-900">申请已提交</h1>
        <p className="text-zinc-500 text-sm leading-relaxed">
          你的注册申请已发送给管理员，审核通过后即可登录系统。
        </p>
        <LogoutButton />
      </div>
    </div>
  )
}
