'use client'
import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { MemberTable } from '@/components/admin/MemberTable'
import { InviteUserDialog } from '@/components/admin/InviteUserDialog'

export default function UsersPage() {
  const [members, setMembers] = useState<any[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)

  const loadMembers = useCallback(async () => {
    const res = await fetch('/api/admin/users')
    if (res.ok) setMembers(await res.json())
  }, [])

  useEffect(() => { loadMembers() }, [loadMembers])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">成员管理</h1>
        <Button onClick={() => setInviteOpen(true)}>邀请成员</Button>
      </div>
      <MemberTable members={members} onUpdate={loadMembers} />
      <InviteUserDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={loadMembers}
      />
    </div>
  )
}
