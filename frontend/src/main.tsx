import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NotesProvider } from './ui/contexts/NotesContext'
import { DialogProvider } from './ui/contexts/DialogContext'
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
        if (!localStorage.getItem('token')) {
          autoLogin().catch(e => console.error('[App] Ошибка autoLogin из postMessage:', e))
        }
      } else if (event.data.user_id) {
        console.log('[App] ✅ Найден user_id в postMessage, формируем initData...')
        const initData = `user_id=${event.data.user_id}&first_name=${event.data.first_name || ''}&last_name=${event.data.last_name || ''}`
        sessionStorage.setItem('initData_from_postMessage', initData)
        if (!localStorage.getItem('token')) {
          autoLogin().catch(e => console.error('[App] Ошибка autoLogin из postMessage:', e))
        }
      }
    } else if (typeof event.data === 'string' && (event.data.includes('user_id') || event.data.includes('initData'))) {
      console.log('[App] ✅ Найдены данные в postMessage (строка)')
      sessionStorage.setItem('initData_from_postMessage', event.data)
      if (!localStorage.getItem('token')) {
        autoLogin().catch(e => console.error('[App] Ошибка autoLogin из postMessage:', e))
      }
    }
  })
}

// Пробуем автоматически залогиниться при загрузке приложения (если нет токена)
if (!localStorage.getItem('token')) {
  console.log('[App] Токена нет, пытаемся autoLogin при загрузке...')
  // Небольшая задержка, чтобы postMessage успел прийти
  setTimeout(() => {
    autoLogin().then(ok => {
      if (ok) {
        console.log('[App] ✅ autoLogin успешен при загрузке приложения')
        // Перезагружаем страницу, чтобы роутер перенаправил на главную
        if (window.location.pathname === '/login') {
          window.location.href = '/'
        }
      } else {
        console.log('[App] ⚠️ autoLogin не удался при загрузке приложения')
      }
    }).catch(e => {
      console.error('[App] ❌ Ошибка в autoLogin при загрузке:', e)
    })
  }, 500) // Даем 500ms на получение postMessage
} else {
  console.log('[App] Токен уже есть в localStorage, пропускаем autoLogin')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <DialogProvider>
      <NotesProvider>
        <RouterProvider router={router} />
      </NotesProvider>
      </DialogProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
