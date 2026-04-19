'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TeamRole } from '@/types'

const ROLE_LABELS: Record<TeamRole, string> = {
  super_admin: '超级管理员',
  sales_manager: '销售经理',
  sales_rep: '普通销售',
}

export function InviteUserDialog({ open, onClose, onSuccess }: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('sales_rep')
  const [loading, setLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  async function handleSubmit() {
    setLoading(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      setInviteLink(`${window.location.origin}/invite/${data.token}`)
      onSuccess()
    }
  }

  function handleClose() {
    setEmail('')
    setRole('sales_rep')
    setInviteLink(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>邀请成员</DialogTitle>
        </DialogHeader>
        {inviteLink ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">邀请链接已生成（24小时有效）：</p>
            <Input value={inviteLink} readOnly onClick={e => (e.target as HTMLInputElement).select()} />
            <p className="text-xs text-muted-foreground">复制链接发送给对方，对方点击后注册/登录即可加入团队。</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>邮箱</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-1">
              <Label>角色</Label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as TeamRole)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              >
                {(Object.keys(ROLE_LABELS) as TeamRole[]).map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <DialogFooter>
          {!inviteLink && (
            <Button onClick={handleSubmit} disabled={loading || !email}>
              {loading ? '生成中...' : '生成邀请链接'}
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
