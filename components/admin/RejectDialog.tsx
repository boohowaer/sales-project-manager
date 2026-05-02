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
      <DialogContent className="rounded-2xl shadow-xl border-0">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">驳回原因</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-zinc-700">请填写驳回原因（将通知提交人）</Label>
          <Textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="请说明驳回原因..."
          rows={3}
        />
        </div>
        <DialogFooter className="gap-2.5 pt-2">
          <Button onClick={handleConfirm} disabled={!reason.trim()}
            className="bg-rose-600 text-white hover:bg-rose-700">
            确认驳回
          </Button>
          <Button variant="cancel" onClick={onClose}>取消</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
