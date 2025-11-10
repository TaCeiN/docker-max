import { createContext, useContext, useState, ReactNode } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import AlertDialog from '../components/AlertDialog'

interface DialogContextType {
  confirm: (message: string, title?: string) => Promise<boolean>
  alert: (message: string, title?: string) => Promise<void>
}

const DialogContext = createContext<DialogContextType | undefined>(undefined)

export function DialogProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<{
    open: boolean
    message: string
    title?: string
    resolve: (value: boolean) => void
  } | null>(null)

  const [alertState, setAlertState] = useState<{
    open: boolean
    message: string
    title?: string
    resolve: () => void
  } | null>(null)

  const confirm = (message: string, title?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        open: true,
        message,
        title,
        resolve
      })
    })
  }

  const alert = (message: string, title?: string): Promise<void> => {
    return new Promise((resolve) => {
      setAlertState({
        open: true,
        message,
        title,
        resolve
      })
    })
  }

  const handleConfirm = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result)
      setConfirmState(null)
    }
  }

  const handleAlertClose = () => {
    if (alertState) {
      alertState.resolve()
      setAlertState(null)
    }
  }

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          message={confirmState.message}
          title={confirmState.title}
          onConfirm={() => handleConfirm(true)}
          onCancel={() => handleConfirm(false)}
        />
      )}
      {alertState && (
        <AlertDialog
          open={alertState.open}
          message={alertState.message}
          title={alertState.title}
          onClose={handleAlertClose}
        />
      )}
    </DialogContext.Provider>
  )
}

export function useDialog() {
  const context = useContext(DialogContext)
  if (context === undefined) {
    throw new Error('useDialog must be used within a DialogProvider')
  }
  return context
}

