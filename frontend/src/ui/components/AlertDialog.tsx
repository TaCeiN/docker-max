import { useEffect } from 'react'

interface AlertDialogProps {
  open: boolean
  message: string
  title?: string
  onClose: () => void
}

export default function AlertDialog({ open, message, title, onClose }: AlertDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        onClose()
      }
    }
    if (open) {
      window.addEventListener('keydown', onKey)
    }
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-card" onClick={e => e.stopPropagation()}>
        {title && <h3 className="dialog-title">{title}</h3>}
        <div className="dialog-message">{message}</div>
        <div className="dialog-actions">
          <button className="dialog-button dialog-button--confirm" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

