import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { autoLogin } from '../../auth/autoLogin'

// Определяем платформу (iOS/Android/Desktop)
function detectPlatform(): { platform: string; isIOS: boolean; isAndroid: boolean; isMobile: boolean } {
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || ''
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
  const isAndroid = /android/i.test(ua)
  const isMobile = isIOS || isAndroid || /Mobile|Android|iP(hone|od|ad)/i.test(ua)
  
  let platform = 'desktop'
  if (isIOS) platform = 'iOS'
  else if (isAndroid) platform = 'Android'
  else if (isMobile) platform = 'mobile'
  
  return { platform, isIOS, isAndroid, isMobile }
}

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const platformInfo = detectPlatform()
  const [checking, setChecking] = useState<boolean>(() => !localStorage.getItem('token'))
  const [failed, setFailed] = useState<boolean>(false)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  // Слушаем изменения токена в localStorage
  useEffect(() => {
    const checkToken = () => {
      const currentToken = localStorage.getItem('token')
      if (currentToken !== token) {
        console.log('[ProtectedRoute] Токен изменился в localStorage, обновляем состояние')
        setToken(currentToken)
        if (currentToken) {
          setChecking(false)
          setFailed(false)
        }
      }
    }

    // Проверяем токен сразу
    checkToken()

    // Проверяем токен периодически (на случай, если он изменился извне)
    const interval = setInterval(checkToken, 100)

    return () => clearInterval(interval)
  }, [token])

  useEffect(() => {
    console.log('[ProtectedRoute] Компонент монтирован')
    console.log('[ProtectedRoute] Платформа:', platformInfo.platform, platformInfo.isIOS ? '(iOS)' : platformInfo.isAndroid ? '(Android)' : '')
    const hasToken = !!localStorage.getItem('token')
    console.log('[ProtectedRoute] Токен в localStorage:', hasToken ? 'есть' : 'нет')
    
    if (hasToken) {
      console.log('[ProtectedRoute] Токен найден, пропускаем autoLogin')
      setChecking(false)
      setToken(localStorage.getItem('token'))
      return
    }
    
    console.log('[ProtectedRoute] Токена нет, запускаем autoLogin с ожиданием SDK...')
    if (platformInfo.isIOS) {
      console.log('[ProtectedRoute] iOS: Запуск авторизации с увеличенным временем ожидания...')
    }
    let canceled = false
    let attemptCount = 0
    // Для iOS увеличиваем количество попыток (больше времени ожидания SDK)
    const MAX_ATTEMPTS = platformInfo.isIOS ? 8 : 5 // 8 попыток для iOS, 5 для других
    let lastInitDataCheck: string | null = null
    
    // Проверяем наличие initData перед началом авторизации
    const checkInitDataAvailable = (): boolean => {
      try {
        // Проверяем сохраненный initData
        const savedInitData = localStorage.getItem('initData_saved')
        if (savedInitData && savedInitData !== lastInitDataCheck) {
          console.log('[ProtectedRoute] ✅ Найден сохраненный initData, можно начинать авторизацию')
          lastInitDataCheck = savedInitData
          return true
        }
        
        // Проверяем sessionStorage
        const fromSession = sessionStorage.getItem('initData_from_postMessage')
        if (fromSession && fromSession !== lastInitDataCheck) {
          console.log('[ProtectedRoute] ✅ Найден initData в sessionStorage, можно начинать авторизацию')
          lastInitDataCheck = fromSession
          return true
        }
        
        // Проверяем SDK
        const w = window as any
        const fromSDK = w?.MaxWebApp?.initData || w?.Telegram?.WebApp?.initData || w?.Max?.WebApp?.initData
        if (fromSDK && fromSDK !== lastInitDataCheck) {
          console.log('[ProtectedRoute] ✅ Найден initData в SDK, можно начинать авторизацию')
          lastInitDataCheck = fromSDK
          return true
        }
        
        // Проверяем URL параметры
        const urlParams = new URLSearchParams(window.location.search)
        const fromUrl = urlParams.get('initData') || urlParams.get('init_data') || urlParams.get('data') || urlParams.get('user_id')
        if (fromUrl && fromUrl !== lastInitDataCheck) {
          console.log('[ProtectedRoute] ✅ Найден initData в URL, можно начинать авторизацию')
          lastInitDataCheck = fromUrl
          return true
        }
        
        return false
      } catch (e) {
        console.warn('[ProtectedRoute] Ошибка при проверке initData:', e)
        return false
      }
    }
    
    // Функция для ожидания появления initData
    const waitForInitDataAvailable = async (maxWaitTime: number = 5000): Promise<boolean> => {
      const startTime = Date.now()
      const checkInterval = 200 // Проверяем каждые 200ms
      const maxAttempts = Math.floor(maxWaitTime / checkInterval)
      
      // Для iOS увеличиваем время ожидания, если не указано явно
      const actualMaxWaitTime = platformInfo.isIOS && maxWaitTime === 5000 ? 10000 : maxWaitTime // 10 секунд для iOS
      const actualMaxAttempts = Math.floor(actualMaxWaitTime / checkInterval)
      
      if (platformInfo.isIOS) {
        console.log(`[ProtectedRoute] iOS: Ожидание initData до ${actualMaxWaitTime / 1000} секунд...`)
      }
      
      for (let i = 0; i < actualMaxAttempts; i++) {
        if (canceled) return false
        
        if (checkInitDataAvailable()) {
          const elapsed = (Date.now() - startTime) / 1000
          console.log(`[ProtectedRoute] ✅ initData появился через ${elapsed.toFixed(2)} секунд${platformInfo.isIOS ? ' [iOS]' : ''}`)
          if (platformInfo.isIOS) {
            console.log(`[ProtectedRoute] iOS: ✅ initData найден, можно продолжать авторизацию`)
          }
          return true
        }
        
        // На iOS логируем каждые 10 попыток для диагностики
        if (platformInfo.isIOS && i > 0 && i % 10 === 0) {
          const elapsed = (Date.now() - startTime) / 1000
          console.log(`[ProtectedRoute] iOS: Ожидание initData... (прошло ${elapsed.toFixed(2)} секунд, попытка ${i}/${actualMaxAttempts})`)
        }
        
        if (i < actualMaxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, checkInterval))
        }
      }
      
      const elapsed = (Date.now() - startTime) / 1000
      console.log(`[ProtectedRoute] ⚠️ initData не появился за ${elapsed.toFixed(2)} секунд${platformInfo.isIOS ? ' [iOS]' : ''}`)
      if (platformInfo.isIOS) {
        console.log(`[ProtectedRoute] iOS: ⚠️ initData не появился, но продолжаем попытку авторизации...`)
        console.log(`[ProtectedRoute] iOS: autoLogin() попытается найти initData самостоятельно`)
      }
      return false
    }
    
    const tryAuth = async () => {
      if (canceled) return
      
      attemptCount++
      console.log(`[ProtectedRoute] ========================================`)
      console.log(`[ProtectedRoute] Попытка авторизации ${attemptCount}/${MAX_ATTEMPTS}`)
      
      // Перед авторизацией ждем появления initData
      // Для iOS увеличиваем время ожидания (до 10 секунд для первой попытки, до 5 секунд для последующих)
      // Для других платформ - до 5 секунд для первой попытки, до 2 секунд для последующих
      if (attemptCount === 1) {
        const waitTime = platformInfo.isIOS ? 10000 : 5000
        console.log(`[ProtectedRoute] Первая попытка: ожидаем появления initData... (до ${waitTime / 1000} секунд)${platformInfo.isIOS ? ' [iOS]' : ''}`)
        if (platformInfo.isIOS) {
          console.log('[ProtectedRoute] iOS: Увеличенное время ожидания для первой попытки на iOS')
        }
        const initDataAvailable = await waitForInitDataAvailable(waitTime)
        if (!initDataAvailable) {
          console.log('[ProtectedRoute] initData не появился, но продолжаем попытку авторизации...')
          if (platformInfo.isIOS) {
            console.log('[ProtectedRoute] iOS: autoLogin() будет пытаться найти initData самостоятельно')
          }
        }
      } else {
        // Для последующих попыток ждем меньше (но для iOS все равно больше)
        const waitTime = platformInfo.isIOS ? 5000 : 2000
        await waitForInitDataAvailable(waitTime)
      }
      
      try {
        console.log('[ProtectedRoute] Вызываем autoLogin() с waitForData=true...')
        // Ждем загрузки SDK и initData (до 30 секунд)
        const ok = await autoLogin(true)
        console.log('[ProtectedRoute] autoLogin() вернул:', ok)
        
        if (!canceled) {
          if (ok) {
            // Успешная авторизация - проверяем токен
            const savedToken = localStorage.getItem('token')
            console.log('[ProtectedRoute] ✅ Авторизация успешна, проверяем токен...')
            console.log('[ProtectedRoute] Токен в localStorage:', savedToken ? 'есть' : 'нет')
            
            if (savedToken) {
              console.log('[ProtectedRoute] ✅ Токен найден в localStorage после авторизации')
              setToken(savedToken)
              setChecking(false)
              setFailed(false)
              
              // Небольшая задержка для гарантии обновления компонентов
              setTimeout(() => {
                if (!canceled) {
                  const finalToken = localStorage.getItem('token')
                  console.log('[ProtectedRoute] Финальная проверка токена:', finalToken ? 'есть' : 'нет')
                  if (finalToken) {
                    setToken(finalToken)
                    setChecking(false)
                    setFailed(false)
                  }
                }
              }, 300)
            } else {
              console.error('[ProtectedRoute] ❌ ОШИБКА: Токен не найден после успешной авторизации!')
              // Если это не последняя попытка, пробуем еще раз
              if (attemptCount < MAX_ATTEMPTS) {
                console.log('[ProtectedRoute] Повторная попытка через 2 секунды...')
                setTimeout(() => {
                  if (!canceled) {
                    tryAuth()
                  }
                }, 2000)
              } else {
                setChecking(false)
                setFailed(true)
              }
            }
          } else {
            // Если это не последняя попытка, пробуем еще раз
            if (attemptCount < MAX_ATTEMPTS) {
              console.log(`[ProtectedRoute] autoLogin не удался, повторная попытка через 2 секунды... (${attemptCount + 1}/${MAX_ATTEMPTS})`)
              setTimeout(() => {
                if (!canceled) {
                  tryAuth()
                }
              }, 2000)
            } else {
              // Все попытки исчерпаны
              console.log('[ProtectedRoute] ❌ Все попытки исчерпаны, устанавливаем failed=true')
              setChecking(false)
              setFailed(true)
            }
          }
        }
      } catch (e) {
        console.error(`[ProtectedRoute] Ошибка в autoLogin() (попытка ${attemptCount}/${MAX_ATTEMPTS}):`, e)
        if (!canceled) {
          // Если это не последняя попытка, пробуем еще раз
          if (attemptCount < MAX_ATTEMPTS) {
            console.log('[ProtectedRoute] Повторная попытка через 2 секунды после ошибки...')
            setTimeout(() => {
              if (!canceled) {
                tryAuth()
              }
            }, 2000)
          } else {
            setChecking(false)
            setFailed(true)
          }
        }
      }
    }
    
    // Небольшая задержка перед первой попыткой, чтобы дать время SDK загрузиться
    // Для iOS увеличиваем задержку (SDK может загружаться медленнее)
    const initialDelay = platformInfo.isIOS ? 1000 : 500 // 1 секунда для iOS, 500ms для других
    console.log(`[ProtectedRoute] Ожидание ${initialDelay}ms перед началом авторизации...${platformInfo.isIOS ? ' [iOS]' : ''}`)
    if (platformInfo.isIOS) {
      console.log('[ProtectedRoute] iOS: Увеличенная задержка перед первой попыткой авторизации')
    }
    setTimeout(() => {
      if (!canceled) {
        tryAuth()
      }
    }, initialDelay)
    
    return () => { canceled = true }
  }, [])

  // Используем состояние token вместо прямого чтения из localStorage
  if (token) {
    console.log('[ProtectedRoute] Токен есть, разрешаем доступ к защищенному контенту')
    return <>{children}</>
  }
  
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

