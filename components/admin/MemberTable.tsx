'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TeamRole } from '@/types'

type Member = {
  id: string
  user_id: string
  email: string
  role: TeamRole
  status: 'active' | 'disabled'
  joined_at: string
  data_scope: 'own' | 'team'
  approval_cc: boolean
}

const ROLE_LABELS: Record<TeamRole, string> = {
  super_admin: '超级管理员',
  sales_manager: '销售经理',
  sales_rep: '普通销售',
}

export function MemberTable({ members, loading: tableLoading, onUpdate, currentUserId }: {
  members: Member[]
  loading?: boolean
  onUpdate: () => void
  currentUserId: string | null
}) {
  const [loading, setLoading] = useState<string | null>(null)

  async function patchMember(memberId: string, updates: Record<string, unknown>) {
    setLoading(memberId)
    await fetch(`/api/admin/users/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    setLoading(null)
    onUpdate()
  }

  return (
    <Card className="rounded-2xl shadow-sm border-0 bg-white">
      <CardContent className="p-0">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-32" />
          </colgroup>
          <thead className="bg-white border-b border-zinc-200">
            <tr>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase rounded-tl-2xl whitespace-nowrap">邮箱</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase whitespace-nowrap">角色</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase whitespace-nowrap">数据范围</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase whitespace-nowrap">审批抄送</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase whitespace-nowrap">状态</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase whitespace-nowrap">加入时间</th>
              <th className="px-4 py-4 text-left text-xs font-medium text-zinc-500 uppercase rounded-tr-2xl whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {tableLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-zinc-400 text-sm">加载中...</td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-zinc-400 text-sm">暂无成员</td>
              </tr>
            ) : members.map(m => {
              const isManager = m.role === 'super_admin' || m.role === 'sales_manager'
              return (
                <tr key={m.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-zinc-900 truncate">{m.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Select
                      value={m.role}
                      disabled={loading === m.id || m.user_id === currentUserId}
                      onValueChange={val => patchMember(m.id, { role: val })}
                    >
                      <SelectTrigger className="w-32 rounded-full border-zinc-200 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_LABELS) as TeamRole[]).map(r => (
                          <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {isManager ? (
                      <span className="text-xs text-zinc-400">全团队</span>
                    ) : (
                      <Select
                        value={m.data_scope ?? 'own'}
                        disabled={loading === m.id}
                        onValueChange={val => patchMember(m.id, { data_scope: val })}
                      >
                        <SelectTrigger className="w-24 rounded-full border-zinc-200 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="own">仅自己</SelectItem>
                          <SelectItem value="team">全团队</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {isManager ? (
                      <span className="text-xs text-zinc-400">已有审批权</span>
                    ) : (
                      <button
                        disabled={loading === m.id}
                        onClick={() => patchMember(m.id, { approval_cc: !m.approval_cc })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          m.approval_cc ? 'bg-zinc-900' : 'bg-zinc-200'
                        } disabled:opacity-50`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          m.approval_cc ? 'translate-x-4' : 'translate-x-1'
                        }`} />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge className={`rounded-full text-xs border ${m.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
                      {m.status === 'active' ? '正常' : '已禁用'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                    {new Date(m.joined_at).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {m.user_id === currentUserId ? (
                      <span className="text-xs text-zinc-400">（自己）</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={loading === m.id}
                        onClick={() => patchMember(m.id, { status: m.status === 'active' ? 'disabled' : 'active' })}
                        className="h-8 text-xs rounded-full text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                      >
                        {m.status === 'active' ? '禁用' : '启用'}
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
