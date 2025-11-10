import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { autoLogin } from '../../auth/autoLogin'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState<boolean>(() => !localStorage.getItem('token'))
  const [failed, setFailed] = useState<boolean>(false)

  useEffect(() => {
    console.log('[ProtectedRoute] Компонент монтирован')
    const hasToken = !!localStorage.getItem('token')
    console.log('[ProtectedRoute] Токен в localStorage:', hasToken ? 'есть' : 'нет')
    
    if (hasToken) {
      console.log('[ProtectedRoute] Токен найден, пропускаем autoLogin')
      return
    }
    
    console.log('[ProtectedRoute] Токена нет, запускаем autoLogin...')
    let canceled = false
    ;(async () => {
      try {
        console.log('[ProtectedRoute] Вызываем autoLogin()...')
        const ok = await autoLogin()
        console.log('[ProtectedRoute] autoLogin() вернул:', ok)
        if (!canceled) setChecking(false)
        if (!ok && !canceled) {
          console.log('[ProtectedRoute] autoLogin() не удался, устанавливаем failed=true')
          setFailed(true)
        }
      } catch (e) {
        console.error('[ProtectedRoute] Ошибка в autoLogin():', e)
        if (!canceled) {
          setChecking(false)
          setFailed(true)
        }
      }
    })()
    return () => { canceled = true }
  }, [])

  const token = localStorage.getItem('token')
  if (token) return <>{children}</>
  if (checking) return null
  if (failed) return <Navigate to="/login" replace />
  return <Navigate to="/login" replace />
}

