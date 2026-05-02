'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
      <DialogContent className="rounded-2xl shadow-xl border-0">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">邀请成员</DialogTitle>
        </DialogHeader>
        {inviteLink ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500">邀请链接已生成（24小时有效）：</p>
            <Input value={inviteLink} readOnly onClick={e => (e.target as HTMLInputElement).select()} className="rounded-full border-zinc-200 text-xs" />
            <p className="text-xs text-zinc-400">复制链接发送给对方，对方点击后注册/登录即可加入团队。</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-zinc-700">邮箱</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400" />
            </div>
            <div>
              <Label className="text-sm font-medium text-zinc-700">角色</Label>
              <Select value={role} onValueChange={val => setRole(val as TeamRole)}>
                <SelectTrigger className="mt-2 rounded-full border-zinc-200 focus:border-zinc-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as TeamRole[]).map(r => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2.5 pt-2">
          {!inviteLink && (
            <Button onClick={handleSubmit} disabled={loading || !email}>
              {loading ? '生成中...' : '生成邀请链接'}
            </Button>
          )}
          <Button variant="cancel" onClick={handleClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
