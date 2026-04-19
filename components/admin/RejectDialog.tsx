'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export function RejectDialog({ open, onClose, onConfirm }: {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  function handleConfirm() {
    if (!reason.trim()) return
    onConfirm(reason.trim())
    setReason('')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>驳回原因</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>请填写驳回原因（将通知提交人）</Label>
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="请说明驳回原因..."
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm} disabled={!reason.trim()} variant="destructive">
            确认驳回
          </Button>
          <Button variant="outline" onClick={onClose}>取消</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
