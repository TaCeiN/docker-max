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

// Логируем информацию о загрузке приложения
console.log('[App] ========================================')
console.log('[App] 🚀 Приложение загружается...')
console.log('[App] ========================================')
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
}

// Глобальный флаг для отслеживания, была ли уже попытка авторизации
let authAttempted = false

// Функция для попытки авторизации, если токена еще нет
async function tryAutoLoginIfNeeded() {
  if (localStorage.getItem('token')) {
    console.log('[App] Токен уже есть, пропускаем авторизацию')
    return
  }
  
  if (authAttempted) {
    console.log('[App] Авторизация уже была попытка, пропускаем')
    return
  }
  
  authAttempted = true
  console.log('[App] Пытаемся авторизоваться...')
  
  try {
    const ok = await autoLogin(true) // Ждем загрузки SDK
    if (ok) {
      console.log('[App] ✅ Авторизация успешна из postMessage/SDK')
      // Если мы на странице логина, перенаправляем на главную
      if (window.location.pathname === '/login') {
        window.location.href = '/'
      }
    } else {
      console.log('[App] ⚠️ Авторизация не удалась, но это нормально - будет повторная попытка')
      authAttempted = false // Разрешаем повторную попытку
    }
  } catch (e) {
    console.error('[App] ❌ Ошибка при авторизации:', e)
    authAttempted = false // Разрешаем повторную попытку при ошибке
  }
}

// Слушаем postMessage от родительского окна Max (если открыто в iframe)
if (window.parent !== window) {
  console.log('[App] Приложение открыто в iframe, слушаем postMessage от Max...')
  window.addEventListener('message', (event) => {
    console.log('[App] Получено postMessage:', event.data)
    console.log('[App] Origin:', event.origin)
    
    // Пробуем найти initData в сообщении
    if (event.data && typeof event.data === 'object') {
      if (event.data.initData) {
        console.log('[App] ✅ Найден initData в postMessage!')
        // Сохраняем во временное хранилище
        sessionStorage.setItem('initData_from_postMessage', event.data.initData)
        // Пробуем авторизоваться
        tryAutoLoginIfNeeded()
      } else if (event.data.user_id) {
        console.log('[App] ✅ Найден user_id в postMessage, формируем initData...')
        const initData = `user_id=${event.data.user_id}&first_name=${event.data.first_name || ''}&last_name=${event.data.last_name || ''}`
        sessionStorage.setItem('initData_from_postMessage', initData)
        tryAutoLoginIfNeeded()
      }
    } else if (typeof event.data === 'string' && (event.data.includes('user_id') || event.data.includes('initData'))) {
      console.log('[App] ✅ Найдены данные в postMessage (строка)')
      sessionStorage.setItem('initData_from_postMessage', event.data)
      tryAutoLoginIfNeeded()
    }
  })
}

// Слушаем изменения в Max WebApp SDK (если SDK загружается асинхронно)
let lastInitData: string | null = null

// Проверяем появление initData в SDK с интервалом
const checkSDKInterval = setInterval(() => {
  if (localStorage.getItem('token')) {
    clearInterval(checkSDKInterval)
    return
  }
  
  const currentInitData = w?.MaxWebApp?.initData || 
                         w?.Telegram?.WebApp?.initData || 
                         w?.Max?.WebApp?.initData
  
  if (currentInitData && currentInitData !== lastInitData) {
    console.log('[App] ✅ initData появился в SDK!')
    lastInitData = currentInitData
    tryAutoLoginIfNeeded()
    // Останавливаем проверку после успешной авторизации или через 10 секунд
    setTimeout(() => clearInterval(checkSDKInterval), 10000)
  }
}, 500) // Проверяем каждые 500ms

// Останавливаем проверку через 10 секунд
setTimeout(() => {
  clearInterval(checkSDKInterval)
  console.log('[App] Остановлена проверка SDK (прошло 10 секунд)')
}, 10000)

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
