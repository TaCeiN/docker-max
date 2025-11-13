import { useEffect, useState, useCallback } from 'react'
import { api } from '../../api/client'

export default function DatabaseConnectionError() {
  const [isRetrying, setIsRetrying] = useState(false)
  const [lastCheck, setLastCheck] = useState<Date>(new Date())

  const checkConnection = useCallback(async () => {
    if (isRetrying) return
    
    setIsRetrying(true)
    try {
      await api('/health')
      // Если подключение восстановлено, перезагружаем страницу
      window.location.reload()
    } catch (error) {
      setLastCheck(new Date())
    } finally {
      setIsRetrying(false)
    }
  }, [isRetrying])

  // Автоматическая проверка каждые 10 секунд
  useEffect(() => {
    const interval = setInterval(() => {
      checkConnection()
    }, 10000)

    return () => clearInterval(interval)
  }, [checkConnection])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      textAlign: 'center',
      background: 'var(--bg, #191919)',
      color: 'var(--fg, #ffffff)'
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        padding: '32px',
        background: 'var(--card, #1f1f1f)',
        borderRadius: '16px',
        border: '1px solid var(--border, #2e2e2e)'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 24px',
          borderRadius: '50%',
          background: 'rgba(255, 68, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="rgba(255, 68, 0, 0.5)" strokeWidth="2"/>
            <path d="M12 8V12M12 16H12.01" stroke="rgba(255, 68, 0, 0.8)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        
        <h2 style={{
          margin: '0 0 12px',
          fontSize: '20px',
          fontWeight: '600',
          color: 'var(--fg, #ffffff)'
        }}>
          Нет подключения к базе данных
        </h2>
        
        <p style={{
          margin: '0 0 24px',
          fontSize: '14px',
          color: 'var(--fg-secondary, #9b9a97)',
          lineHeight: '1.5'
        }}>
          Сервер временно недоступен. Пожалуйста, попробуйте позже.
          <br />
          Приложение автоматически проверит подключение через несколько секунд.
        </p>

        {lastCheck && (
          <p style={{
            margin: '0 0 24px',
            fontSize: '12px',
            color: 'var(--fg-muted, #787774)'
          }}>
            Последняя проверка: {lastCheck.toLocaleTimeString()}
          </p>
        )}

        <button
          onClick={checkConnection}
          disabled={isRetrying}
          style={{
            width: '100%',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#ffffff',
            background: isRetrying ? 'var(--fg-muted, #787774)' : 'var(--primary, #2383e2)',
            border: 'none',
            borderRadius: '8px',
            cursor: isRetrying ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            opacity: isRetrying ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!isRetrying) {
              e.currentTarget.style.background = 'var(--primary-hover, #1a73d1)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isRetrying) {
              e.currentTarget.style.background = 'var(--primary, #2383e2)'
            }
          }}
        >
          {isRetrying ? 'Проверка подключения...' : 'Попробовать снова'}
        </button>
      </div>
    </div>
  )
}

