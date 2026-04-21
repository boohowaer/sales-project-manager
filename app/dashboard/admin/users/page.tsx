'use client'
import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { MemberTable } from '@/components/admin/MemberTable'
import { InviteUserDialog } from '@/components/admin/InviteUserDialog'

export default function UsersPage() {
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const loadMembers = useCallback(async () => {
    const res = await fetch('/api/admin/users')
    if (res.ok) setMembers(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    loadMembers()
    fetch('/api/me').then(r => r.json()).then(d => setCurrentUserId(d.userId ?? null))
  }, [loadMembers])

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-20 text-zinc-400 text-sm">加载中...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">成员管理</h1>
          <p className="mt-2 text-zinc-500 text-sm">管理团队成员的角色与权限</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full shadow-sm">邀请成员</Button>
      </div>
      <MemberTable members={members} onUpdate={loadMembers} currentUserId={currentUserId} />
      <InviteUserDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={loadMembers}
      />
    </div>
  )
}
