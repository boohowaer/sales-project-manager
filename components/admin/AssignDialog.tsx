'use client'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type Member = { user_id: string; email: string; role: string }

export function AssignDialog({ open, onClose, resourceType, resourceId, onSuccess }: {
  open: boolean
  onClose: () => void
  resourceType: 'customer' | 'project' | 'task'
  resourceId: string
  onSuccess: () => void
}) {
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch('/api/admin/users').then(r => r.json()).then(setMembers)
  }, [open])

  async function handleAssign() {
    if (!selected) return
    setLoading(true)
    await fetch('/api/admin/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resourceType, resourceId, assignedTo: selected }),
    })
    setLoading(false)
    onSuccess()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>分派给...</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {members.map(m => (
            <button
              key={m.user_id}
              onClick={() => setSelected(m.user_id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                selected === m.user_id ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-100'
              }`}
            >
              {m.email}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleAssign} disabled={loading || !selected}>
            {loading ? '分派中...' : '确认分派'}
          </Button>
          <Button variant="outline" onClick={onClose}>取消</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
