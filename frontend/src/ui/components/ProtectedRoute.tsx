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
      setChecking(false)
      return
    }
    
    console.log('[ProtectedRoute] Токена нет, запускаем autoLogin с ожиданием SDK...')
    let canceled = false
    ;(async () => {
      try {
        console.log('[ProtectedRoute] Вызываем autoLogin() с waitForData=true...')
        // Ждем загрузки SDK и initData (до 5 секунд)
        const ok = await autoLogin(true)
        console.log('[ProtectedRoute] autoLogin() вернул:', ok)
        if (!canceled) {
          setChecking(false)
          if (!ok) {
            console.log('[ProtectedRoute] autoLogin() не удался, устанавливаем failed=true')
            setFailed(true)
          }
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
  if (checking) {
    // Показываем индикатор загрузки во время проверки авторизации
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div className="auth-loading-spinner" style={{
          width: '40px',
          height: '40px',
          border: '4px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: 'var(--primary-color, #007bff)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: 'var(--text-color, #333)', fontSize: '14px' }}>Проверка авторизации...</p>
      </div>
    )
  }
  if (failed) return <Navigate to="/login" replace />
  return <Navigate to="/login" replace />
}

