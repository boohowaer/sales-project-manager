'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { MemberTable } from '@/components/admin/MemberTable'
import { InviteUserDialog } from '@/components/admin/InviteUserDialog'
import { useUser, useTeamMembers } from '@/context/UserContext'
import { PageLoading } from '@/components/ui/page-loading'
import { UserPlus } from 'lucide-react'

export default function UsersPage() {
  const me = useUser()
  const currentUserId = me?.userId ?? null
  const { members, membersLoaded, ensureMembers, reloadMembers } = useTeamMembers()
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => { ensureMembers() }, [ensureMembers])

  if (!membersLoaded) {
    return <PageLoading variant="users" />
  }

  return (
    <div className="p-8">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">成员管理</h1>
          <p className="mt-2 text-zinc-500 text-sm">管理团队成员的角色与权限</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="h-9 shadow-sm -translate-y-1">
          <UserPlus className="w-4 h-4 mr-2" />
          邀请成员
        </Button>
      </div>
      <MemberTable members={members as any} onUpdate={reloadMembers} currentUserId={currentUserId} />
      <InviteUserDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={reloadMembers}
      />
    </div>
  )
}
