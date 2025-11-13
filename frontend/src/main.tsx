import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NotesProvider } from './ui/contexts/NotesContext'
import { DialogProvider } from './ui/contexts/DialogContext'
import { LanguageProvider } from './ui/contexts/LanguageContext'
import App from './ui/App'
import Login from './ui/pages/Login'
import Dashboard from './ui/pages/Dashboard'
import Settings from './ui/pages/Settings'
import Notes from './ui/pages/Notes'
import { autoLogin } from './auth/autoLogin'
import './ui/styles.css'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'settings', element: <Settings /> },
      { path: 'notes', element: <Notes /> },
    ]
  }
])

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

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

const platformInfo = detectPlatform()
console.log('[App] ========================================')
console.log('[App] 🚀 Приложение загружается...')
console.log('[App] ========================================')
console.log('[App] Платформа:', platformInfo.platform)
console.log('[App] iOS:', platformInfo.isIOS)
console.log('[App] Android:', platformInfo.isAndroid)
console.log('[App] Mobile:', platformInfo.isMobile)
console.log('[App] URL:', window.location.href)
console.log('[App] User Agent:', navigator.userAgent)
console.log('[App] Все параметры URL:')
const allUrlParams = new URLSearchParams(window.location.search)
for (const [key, value] of allUrlParams.entries()) {
  console.log(`[App]   ${key} = ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`)
}
if (allUrlParams.entries().next().done) {
  console.log('[App]   (параметров нет)')
}

// Пробуем найти initData сразу при загрузке
const w = window as any
console.log('[App] Проверяем window объекты...')
console.log('[App] window.MaxWebApp:', w?.MaxWebApp ? 'найден' : 'не найден')
console.log('[App] window.Telegram:', w?.Telegram ? 'найден' : 'не найден')
console.log('[App] window.Max:', w?.Max ? 'найден' : 'не найден')

if (w?.MaxWebApp) {
  console.log('[App] MaxWebApp найден:', Object.keys(w.MaxWebApp))
  console.log('[App] MaxWebApp.initData:', w.MaxWebApp.initData ? 'есть' : 'нет')
  if (w.MaxWebApp.initData) {
    console.log('[App] MaxWebApp.initData (первые 100 символов):', w.MaxWebApp.initData.substring(0, 100))
  }
} else {
  console.log('[App] ⚠️ MaxWebApp не найден при загрузке (может загрузиться позже)')
}

// Проверяем наличие SDK на iOS отдельно
if (platformInfo.isIOS) {
  console.log('[App] 📱 iOS устройство обнаружено, применяем специальные настройки...')
  console.log('[App] iOS: Проверяем наличие SDK с увеличенным временем ожидания')
  console.log('[App] iOS: window.MaxWebApp:', w?.MaxWebApp ? 'найден' : 'не найден (будет проверяться)')
  console.log('[App] iOS: window.Telegram:', w?.Telegram ? 'найден' : 'не найден')
  console.log('[App] iOS: window.Max:', w?.Max ? 'найден' : 'не найден')
}

// Глобальный флаг для отслеживания, была ли уже попытка авторизации
let authAttempted = false
let authInProgress = false

// Функция для попытки авторизации, если токена еще нет
async function tryAutoLoginIfNeeded() {
  if (localStorage.getItem('token')) {
    console.log('[App] Токен уже есть, пропускаем авторизацию')
    return
  }
  
  if (authInProgress) {
    console.log('[App] Авторизация уже в процессе, пропускаем')
    return
  }
  
  authInProgress = true
  console.log('[App] Пытаемся авторизоваться...')
  
  try {
    const ok = await autoLogin(true) // Ждем загрузки SDK (до 15 секунд)
    if (ok) {
      console.log('[App] ✅ Авторизация успешна из postMessage/SDK')
      authAttempted = true
      // Если мы на странице логина, перенаправляем на главную
      if (window.location.pathname === '/login') {
        window.location.href = '/'
      }
    } else {
      console.log('[App] ⚠️ Авторизация не удалась, разрешаем повторную попытку')
      // Не блокируем повторные попытки - разрешаем повторять
    }
  } catch (e) {
    console.error('[App] ❌ Ошибка при авторизации:', e)
    // Разрешаем повторную попытку при ошибке
  } finally {
    authInProgress = false
  }
}

// Функция для обработки initData из postMessage
function handleInitDataFromPostMessage(initData: string, source: string) {
  console.log(`[App] ✅ Получен initData из ${source}`)
  console.log(`[App] initData (первые 100 символов):`, initData.substring(0, 100))
  
  // Сохраняем в sessionStorage для немедленного использования
  try {
    sessionStorage.setItem('initData_from_postMessage', initData)
    console.log('[App] ✅ initData сохранен в sessionStorage')
  } catch (e) {
    console.warn('[App] ⚠️ Не удалось сохранить в sessionStorage:', e)
  }
  
  // Также сохраняем в localStorage для последующих запусков
  try {
    localStorage.setItem('initData_saved', initData)
    console.log('[App] ✅ initData сохранен в localStorage для последующих запусков')
  } catch (e) {
    console.warn('[App] ⚠️ Не удалось сохранить в localStorage:', e)
  }
  
  // Пробуем авторизоваться немедленно
  tryAutoLoginIfNeeded()
}

// Слушаем postMessage от родительского окна Max (всегда, не только в iframe)
// Max может отправлять postMessage даже если не в iframe
console.log('[App] Настраиваем обработчик postMessage...')
console.log('[App] window.parent !== window:', window.parent !== window)

// Обработчик postMessage событий
const postMessageHandler = (event: MessageEvent) => {
  console.log('[App] ========================================')
  console.log('[App] 📨 Получено postMessage событие')
  console.log('[App] Платформа:', platformInfo.platform, platformInfo.isIOS ? '(iOS)' : platformInfo.isAndroid ? '(Android)' : '')
  console.log('[App] Origin:', event.origin)
  console.log('[App] Data type:', typeof event.data)
  console.log('[App] Data:', event.data)
  
  // На iOS события могут приходить в другом формате, добавляем дополнительное логирование
  if (platformInfo.isIOS) {
    console.log('[App] iOS: Обработка postMessage события...')
    console.log('[App] iOS: event.origin:', event.origin)
    console.log('[App] iOS: event.data type:', typeof event.data)
    if (typeof event.data === 'object' && event.data !== null) {
      console.log('[App] iOS: event.data keys:', Object.keys(event.data))
    }
  }
  
  // Проверяем различные форматы данных
  if (!event.data) {
    console.log('[App] ⚠️ postMessage без данных, пропускаем')
    return
  }
  
  // Формат 1: Объект с initData
  if (typeof event.data === 'object' && event.data !== null) {
    if (event.data.initData && typeof event.data.initData === 'string') {
      console.log('[App] ✅ Найден initData в postMessage (объект)')
      handleInitDataFromPostMessage(event.data.initData, 'postMessage (объект)')
      return
    }
    
    // Формат 2: Объект с user_id и другими полями
    if (event.data.user_id || event.data.userId || event.data.id) {
      console.log('[App] ✅ Найден user_id в postMessage, формируем initData...')
      const userId = event.data.user_id || event.data.userId || event.data.id
      const firstName = event.data.first_name || event.data.firstName || event.data.firstname || ''
      const lastName = event.data.last_name || event.data.lastName || event.data.lastname || ''
      const username = event.data.username || event.data.userName || event.data.user || ''
      
      const initData = `user_id=${userId}${firstName ? `&first_name=${encodeURIComponent(firstName)}` : ''}${lastName ? `&last_name=${encodeURIComponent(lastName)}` : ''}${username ? `&username=${encodeURIComponent(username)}` : ''}`
      handleInitDataFromPostMessage(initData, 'postMessage (user_id)')
      return
    }
    
    // Формат 3: Объект с вложенным user объектом
    if (event.data.user && typeof event.data.user === 'object') {
      const user = event.data.user
      if (user.user_id || user.id) {
        console.log('[App] ✅ Найден user объект в postMessage, формируем initData...')
        const userId = user.user_id || user.id
        const firstName = user.first_name || user.firstName || ''
        const lastName = user.last_name || user.lastName || ''
        const username = user.username || user.userName || ''
        
        const initData = `user_id=${userId}${firstName ? `&first_name=${encodeURIComponent(firstName)}` : ''}${lastName ? `&last_name=${encodeURIComponent(lastName)}` : ''}${username ? `&username=${encodeURIComponent(username)}` : ''}`
        handleInitDataFromPostMessage(initData, 'postMessage (user объект)')
        return
      }
    }
    
    // Формат 4: JSON строка в объекте
    if (event.data.data && typeof event.data.data === 'string') {
      try {
        const parsed = JSON.parse(event.data.data)
        if (parsed.user || parsed.user_id) {
          console.log('[App] ✅ Найден JSON в postMessage.data, формируем initData...')
          const userId = parsed.user?.user_id || parsed.user?.id || parsed.user_id || parsed.id
          if (userId) {
            const firstName = parsed.user?.first_name || parsed.first_name || ''
            const lastName = parsed.user?.last_name || parsed.last_name || ''
            const username = parsed.user?.username || parsed.username || ''
            
            const initData = `user_id=${userId}${firstName ? `&first_name=${encodeURIComponent(firstName)}` : ''}${lastName ? `&last_name=${encodeURIComponent(lastName)}` : ''}${username ? `&username=${encodeURIComponent(username)}` : ''}`
            handleInitDataFromPostMessage(initData, 'postMessage (JSON data)')
            return
          }
        }
      } catch (e) {
        // Не JSON, пробуем использовать как строку
        console.log('[App] postMessage.data не является JSON, используем как строку')
        if (event.data.data.includes('user_id') || event.data.data.includes('initData')) {
          handleInitDataFromPostMessage(event.data.data, 'postMessage (data строка)')
          return
        }
      }
    }
  }
  
  // Формат 5: Строка с initData или user_id
  if (typeof event.data === 'string') {
    if (event.data.includes('user_id') || event.data.includes('initData') || event.data.includes('init_data')) {
      console.log('[App] ✅ Найдены данные в postMessage (строка)')
      handleInitDataFromPostMessage(event.data, 'postMessage (строка)')
      return
    }
    
    // Пробуем распарсить как JSON
    try {
      const parsed = JSON.parse(event.data)
      if (parsed.user || parsed.user_id || parsed.initData) {
        console.log('[App] ✅ Найден JSON в postMessage (строка), формируем initData...')
        if (parsed.initData) {
          handleInitDataFromPostMessage(parsed.initData, 'postMessage (JSON initData)')
          return
        }
        
        const userId = parsed.user?.user_id || parsed.user?.id || parsed.user_id || parsed.id
        if (userId) {
          const firstName = parsed.user?.first_name || parsed.first_name || ''
          const lastName = parsed.user?.last_name || parsed.last_name || ''
          const username = parsed.user?.username || parsed.username || ''
          
          const initData = `user_id=${userId}${firstName ? `&first_name=${encodeURIComponent(firstName)}` : ''}${lastName ? `&last_name=${encodeURIComponent(lastName)}` : ''}${username ? `&username=${encodeURIComponent(username)}` : ''}`
          handleInitDataFromPostMessage(initData, 'postMessage (JSON user)')
          return
        }
      }
    } catch (e) {
      // Не JSON, пропускаем
      console.log('[App] postMessage строка не является JSON или не содержит initData')
    }
  }
  
  console.log('[App] ⚠️ postMessage не содержит initData или user_id, пропускаем')
  console.log('[App] ========================================')
}

// Добавляем обработчик postMessage
// Слушаем всегда, не только в iframe, так как Max может отправлять postMessage разными способами
window.addEventListener('message', postMessageHandler, false)
console.log('[App] ✅ Обработчик postMessage добавлен')

// Также добавляем обработчик на document для раннего перехвата событий
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[App] DOM загружен, проверяем postMessage события...')
  })
}

// Дополнительно: запрашиваем initData у родительского окна (если в iframe)
if (window.parent !== window) {
  console.log('[App] Приложение открыто в iframe, запрашиваем initData у родителя...')
  try {
    // Отправляем сообщение родителю с запросом initData
    window.parent.postMessage({ type: 'requestInitData' }, '*')
    console.log('[App] ✅ Запрос initData отправлен родителю')
  } catch (e) {
    console.warn('[App] ⚠️ Не удалось отправить запрос родителю:', e)
  }
}

// Слушаем изменения в Max WebApp SDK (если SDK загружается асинхронно)
let lastInitData: string | null = null
let checkSDKInterval: ReturnType<typeof setInterval> | null = null
let checkSDKStartTime = Date.now()
// Увеличено время ожидания SDK при первом запуске до 60 секунд для iOS (SDK может загружаться медленнее)
// Для Android и других платформ - 30 секунд
const MAX_SDK_CHECK_TIME = platformInfo.isIOS ? 60000 : 30000 // 60 секунд для iOS, 30 секунд для других
const SDK_CHECK_INTERVAL = 200 // Проверяем каждые 200ms (чаще, чем раньше)

console.log(`[App] ⏱️ Максимальное время ожидания SDK: ${MAX_SDK_CHECK_TIME / 1000} секунд (${platformInfo.isIOS ? 'iOS' : 'другие платформы'})`)

// Функция для проверки SDK и остановки при необходимости
function checkSDKAndStopIfNeeded() {
  if (localStorage.getItem('token')) {
    if (checkSDKInterval) {
      clearInterval(checkSDKInterval)
      checkSDKInterval = null
    }
    console.log('[App] ✅ Токен получен, останавливаем проверку SDK')
    return true
  }
  
  const elapsed = Date.now() - checkSDKStartTime
  if (elapsed > MAX_SDK_CHECK_TIME) {
    if (checkSDKInterval) {
      clearInterval(checkSDKInterval)
      checkSDKInterval = null
    }
    console.log(`[App] ⏱️ Остановлена проверка SDK (прошло ${Math.round(elapsed / 1000)} секунд)`)
    return true
  }
  
  return false
}

// Функция для обработки найденного initData из SDK
function handleInitDataFromSDK(initData: string, source: string) {
  if (initData === lastInitData) {
    return // Уже обработали
  }
  
  console.log(`[App] ✅ initData появился в SDK: ${source}`)
  console.log(`[App] initData (первые 100 символов):`, initData.substring(0, 100))
  lastInitData = initData
  
  // Сохраняем в sessionStorage для немедленного использования
  try {
    sessionStorage.setItem('initData_from_postMessage', initData)
    console.log('[App] ✅ initData сохранен в sessionStorage')
  } catch (e) {
    console.warn('[App] ⚠️ Не удалось сохранить в sessionStorage:', e)
  }
  
  // Также сохраняем в localStorage для последующих запусков
  try {
    localStorage.setItem('initData_saved', initData)
    console.log('[App] ✅ initData сохранен в localStorage для последующих запусков')
  } catch (e) {
    console.warn('[App] ⚠️ Не удалось сохранить в localStorage:', e)
  }
  
  // Пробуем авторизоваться немедленно
  tryAutoLoginIfNeeded()
}

// Проверяем появление initData в SDK с интервалом
console.log('[App] Запускаем проверку SDK с интервалом', SDK_CHECK_INTERVAL, 'ms')
let checkAttempts = 0
checkSDKInterval = setInterval(() => {
  if (checkSDKAndStopIfNeeded()) {
    return
  }
  
  checkAttempts++
  
  // На iOS логируем каждые 10 попыток для диагностики
  if (platformInfo.isIOS && checkAttempts % 10 === 0) {
    const elapsed = Date.now() - checkSDKStartTime
    console.log(`[App] iOS: Проверка SDK (попытка ${checkAttempts}, прошло ${Math.round(elapsed / 1000)} секунд)`)
    console.log(`[App] iOS: window.MaxWebApp:`, w?.MaxWebApp ? 'найден' : 'не найден')
    console.log(`[App] iOS: window.Telegram:`, w?.Telegram ? 'найден' : 'не найден')
    console.log(`[App] iOS: window.Max:`, w?.Max ? 'найден' : 'не найден')
    console.log(`[App] iOS: localStorage.getItem('initData_saved'):`, localStorage.getItem('initData_saved') ? 'есть' : 'нет')
    console.log(`[App] iOS: sessionStorage.getItem('initData_from_postMessage'):`, sessionStorage.getItem('initData_from_postMessage') ? 'есть' : 'нет')
  }
  
  // Проверяем SDK объекты
  const currentInitData = w?.MaxWebApp?.initData || 
                         w?.Telegram?.WebApp?.initData || 
                         w?.Max?.WebApp?.initData
  
  if (currentInitData && currentInitData !== lastInitData) {
    if (platformInfo.isIOS) {
      console.log('[App] iOS: ✅ initData найден в SDK объекте')
    }
    handleInitDataFromSDK(currentInitData, 'SDK объект')
    return
  }
  
  // Также проверяем sessionStorage (может быть сохранен из postMessage)
  try {
    const fromSessionStorage = sessionStorage.getItem('initData_from_postMessage')
    if (fromSessionStorage && fromSessionStorage !== lastInitData) {
      if (platformInfo.isIOS) {
        console.log('[App] iOS: ✅ initData найден в sessionStorage')
      }
      handleInitDataFromSDK(fromSessionStorage, 'sessionStorage (postMessage)')
      return
    }
  } catch (e) {
    // Игнорируем ошибки sessionStorage
    if (platformInfo.isIOS) {
      console.warn('[App] iOS: ⚠️ Ошибка при чтении sessionStorage:', e)
    }
  }
  
  // Проверяем localStorage для сохраненного initData (если токена еще нет)
  if (!localStorage.getItem('token')) {
    try {
      const savedInitData = localStorage.getItem('initData_saved')
      if (savedInitData && savedInitData !== lastInitData) {
        console.log('[App] ✅ Найден сохраненный initData в localStorage, используем для авторизации')
        if (platformInfo.isIOS) {
          console.log('[App] iOS: Используем сохраненный initData для авторизации')
        }
        handleInitDataFromSDK(savedInitData, 'localStorage (сохраненный)')
        return
      }
    } catch (e) {
      // Игнорируем ошибки localStorage
      if (platformInfo.isIOS) {
        console.warn('[App] iOS: ⚠️ Ошибка при чтении localStorage:', e)
      }
    }
  }
}, SDK_CHECK_INTERVAL)

// Останавливаем проверку через максимальное время
setTimeout(() => {
  if (checkSDKInterval) {
    clearInterval(checkSDKInterval)
    checkSDKInterval = null
    const timeoutSeconds = MAX_SDK_CHECK_TIME / 1000
    console.log(`[App] ⏱️ Остановлена проверка SDK (достигнут максимальный таймаут ${timeoutSeconds} секунд)`)
    if (platformInfo.isIOS) {
      console.log('[App] iOS: ⚠️ Проверка SDK остановлена. Если авторизация не произошла, проверьте логи выше.')
      console.log('[App] iOS: Проверьте, что SDK Max загружается правильно и initData приходит через postMessage или SDK.')
    }
  }
}, MAX_SDK_CHECK_TIME)

// НЕ вызываем autoLogin здесь - это будет сделано в ProtectedRoute или Login
// Это предотвращает дублирующие вызовы и гонки условий
console.log('[App] Токен в localStorage:', localStorage.getItem('token') ? 'есть' : 'нет')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <DialogProvider>
          <NotesProvider>
            <RouterProvider router={router} />
          </NotesProvider>
        </DialogProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
