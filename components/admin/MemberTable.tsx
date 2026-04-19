'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { TeamRole } from '@/types'

type Member = {
  id: string
  email: string
  role: TeamRole
  status: 'active' | 'disabled'
  joined_at: string
}

const ROLE_LABELS: Record<TeamRole, string> = {
  super_admin: '超级管理员',
  sales_manager: '销售经理',
  sales_rep: '普通销售',
}

export function MemberTable({ members, onUpdate }: {
  members: Member[]
  onUpdate: () => void
}) {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleRoleChange(memberId: string, role: TeamRole) {
    setLoading(memberId)
    await fetch(`/api/admin/users/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    setLoading(null)
    onUpdate()
  }

  async function handleToggleStatus(memberId: string, currentStatus: string) {
    setLoading(memberId)
    const status = currentStatus === 'active' ? 'disabled' : 'active'
    await fetch(`/api/admin/users/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setLoading(null)
    onUpdate()
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">邮箱</th>
            <th className="px-4 py-3 text-left font-medium">角色</th>
            <th className="px-4 py-3 text-left font-medium">状态</th>
            <th className="px-4 py-3 text-left font-medium">加入时间</th>
            <th className="px-4 py-3 text-left font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.id} className="border-t">
              <td className="px-4 py-3">{m.email}</td>
              <td className="px-4 py-3">
                <select
                  value={m.role}
                  disabled={loading === m.id}
                  onChange={e => handleRoleChange(m.id, e.target.value as TeamRole)}
                  className="rounded border px-2 py-1 text-sm bg-background"
                >
                  {(Object.keys(ROLE_LABELS) as TeamRole[]).map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <Badge variant={m.status === 'active' ? 'default' : 'secondary'}>
                  {m.status === 'active' ? '正常' : '已禁用'}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(m.joined_at).toLocaleDateString('zh-CN')}
              </td>
              <td className="px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loading === m.id}
                  onClick={() => handleToggleStatus(m.id, m.status)}
                >
                  {m.status === 'active' ? '禁用' : '启用'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
