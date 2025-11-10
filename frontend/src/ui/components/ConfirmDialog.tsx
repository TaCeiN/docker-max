import { useEffect } from 'react'

interface ConfirmDialogProps {
  open: boolean
  message: string
  title?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, message, title, onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel()
      } else if (e.key === 'Enter') {
        onConfirm()
      }
    }
    if (open) {
      window.addEventListener('keydown', onKey)
    }
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-card" onClick={e => e.stopPropagation()}>
        {title && <h3 className="dialog-title">{title}</h3>}
        <div className="dialog-message">{message}</div>
        <div className="dialog-actions">
          <button className="dialog-button dialog-button--cancel" onClick={onCancel}>
            Отмена
          </button>
          <button className="dialog-button dialog-button--confirm" onClick={onConfirm}>
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  )
}

