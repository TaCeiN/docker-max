import { ReactNode, useEffect } from 'react'

export default function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }){
  useEffect(() => {
    function onKey(e: KeyboardEvent){ if(e.key === 'Escape') onClose() }
    if(open){ window.addEventListener('keydown', onKey) }
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if(!open) return null
  return (
    <div className="modal-root" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}


