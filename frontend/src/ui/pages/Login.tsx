import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register } from '../../api/client'
import { autoLogin } from '../../auth/autoLogin'

export default function Login() {
  const [username, setUsername] = useState('')
  const [uuid, setUuid] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRegister, setIsRegister] = useState(false)
  const [authFailed, setAuthFailed] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const navigate = useNavigate()

  // Пытаемся автоматически залогиниться при загрузке страницы
  useEffect(() => {
    console.log('[Login] Компонент Login загружен')
    console.log('[Login] Проверяем токен в localStorage:', !!localStorage.getItem('token'))
    
    // Если токен уже есть, перенаправляем
    if (localStorage.getItem('token')) {
      console.log('[Login] Токен найден, перенаправляем на главную')
      navigate('/')
      return
    }
    
    // Пытаемся автоматически залогиниться с ожиданием SDK
    console.log('[Login] Токена нет, пытаемся autoLogin с ожиданием SDK...')
    let canceled = false
    ;(async () => {
      try {
        // Ждем загрузки SDK и initData (до 5 секунд)
        const ok = await autoLogin(true)
        if (!canceled && ok) {
          console.log('[Login] autoLogin успешен, перенаправляем на главную')
          navigate('/')
        } else if (!canceled) {
          console.log('[Login] autoLogin не удался, показываем страницу ошибки')
          setAuthFailed(true)
          setCheckingAuth(false)
        }
      } catch (e) {
        console.error('[Login] Ошибка в autoLogin:', e)
        if (!canceled) {
          setAuthFailed(true)
          setCheckingAuth(false)
        }
      }
    })()
    
    return () => { canceled = true }
  }, [navigate])

  async function handleSubmit() {
    if (!username || !uuid) {
      setError('Заполните все поля')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      if (isRegister) {
        await register(username, uuid)
        await login(username, uuid)
      } else {
        await login(username, uuid)
      }
      
      navigate('/')
    } catch (e: any) {
      const message = e?.message || (isRegister ? 'Ошибка регистрации' : 'Неверное имя пользователя или UUID')
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  // Показываем загрузку во время проверки авторизации
  if (checkingAuth) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="auth-loading">
            <div className="auth-loading-spinner"></div>
            <p>Проверка авторизации...</p>
          </div>
        </div>
      </div>
    )
  }

  // Показываем страницу ошибки, если авторизация не удалась
  if (authFailed) {
    const handleReload = () => {
      // Пытаемся использовать API мини-приложения для перезагрузки
      const w = window as any
      if (w?.MaxWebApp?.reload) {
        w.MaxWebApp.reload()
      } else if (w?.Telegram?.WebApp?.reload) {
        w.Telegram.WebApp.reload()
      } else if (w?.Max?.WebApp?.reload) {
        w.Max.WebApp.reload()
      } else {
        // Если API недоступен, используем обычную перезагрузку страницы
        window.location.reload()
      }
    }

    return (
      <div className="login-container">
        <div className="login-card login-card--error">
          <div className="auth-error">
            <div className="auth-error-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="rgba(255, 68, 0, 0.3)" strokeWidth="2"/>
                <path d="M12 8V12M12 16H12.01" stroke="rgba(255, 68, 0, 0.8)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className="auth-error-title">Ошибка авторизации</h2>
            <p className="auth-error-message">
              Не удалось выполнить автоматический вход в систему.
              <br />
              Пожалуйста, перезагрузите мини-приложение и попробуйте снова.
            </p>
            <button 
              className="btn btn-primary auth-error-button" 
              onClick={handleReload}
            >
              Перезагрузить мини-приложение
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Обычная форма входа (для ручного входа, если нужно)
  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">{isRegister ? 'Регистрация' : 'Вход'}</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <div className="input-group">
          <label className="input-label">Имя пользователя</label>
          <input
            type="text"
            placeholder="Ваше имя"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            disabled={loading}
          />
        </div>
        
        <div className="input-group">
          <label className="input-label">UUID</label>
          <input
            type="text"
            placeholder="Ваш UUID"
            value={uuid}
            onChange={e => setUuid(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            disabled={loading}
          />
        </div>
        
        <div className="btn-group" style={{ flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Загрузка...' : (isRegister ? 'Зарегистрироваться' : 'Войти')}
          </button>
          <button
            className="btn"
            onClick={() => {
              setIsRegister(!isRegister)
              setError(null)
            }}
            disabled={loading}
            style={{ width: '100%' }}
          >
            {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
          </button>
        </div>
      </div>
    </div>
  )
}
