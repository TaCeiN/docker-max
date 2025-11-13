import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef, useCallback, type MouseEvent as ReactMouseEvent } from 'react'
import ProtectedRoute from './components/ProtectedRoute'
import DatabaseConnectionError from './components/DatabaseConnectionError'
import { useNotesContext } from './contexts/NotesContext'
import { api } from '../api/client'
import { HomeIcon } from '../assets/icons/HomeIcon'
import { NotesIcon } from '../assets/icons/NotesIcon'
import { SettingsIcon } from '../assets/icons/SettingsIcon'

// ГЛОБАЛЬНЫЙ REF для сохранения заметки - позволяет App.tsx напрямую вызывать функцию
export const saveNoteRefGlobal = { current: null as (() => Promise<void>) | null }

export default function App() {
  // Загружаем тему из localStorage или используем dark по умолчанию
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as any) || 'dark')
  const location = useLocation()
  const navigate = useNavigate()
  const { isNoteEditorOpen, closeNoteEditor, handleSaveNote } = useNotesContext()
  
  // Состояние для проверки доступности бэкенда
  const [isBackendAvailable, setIsBackendAvailable] = useState<boolean | null>(null)
  const [isCheckingBackend, setIsCheckingBackend] = useState(false)
  
  // Флаг для предотвращения множественных вызовов сохранения
  const isSavingRef = useRef(false)
  const ongoingSavePromiseRef = useRef<Promise<void> | null>(null)
  
  // Сохраняем актуальные версии функций в ref, чтобы избежать проблем с замыканиями
  const closeNoteEditorRef = useRef(closeNoteEditor)
  const handleSaveNoteRef = useRef(handleSaveNote)
  const directSaveNoteRef = useRef(saveNoteRefGlobal.current)
  
  // Обновляем ref при изменении функций (только если они действительно функции)
  useEffect(() => {
    if (typeof closeNoteEditor === 'function') {
      closeNoteEditorRef.current = closeNoteEditor
    }
    
    if (typeof handleSaveNote === 'function') {
      handleSaveNoteRef.current = handleSaveNote
    }
  }, [closeNoteEditor, handleSaveNote])

  // Загружаем тему из localStorage при старте (тема больше не управляется через настройки)
  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme') || 'dark') as 'light' | 'dark'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Проверка доступности бэкенда при монтировании и периодически
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      // Если токена нет, не проверяем бэкенд
      setIsBackendAvailable(null)
      return
    }

    let isMounted = true
    let intervalId: ReturnType<typeof setInterval> | null = null
    let checkingRef = false

    const checkBackend = async () => {
      if (checkingRef) return
      
      checkingRef = true
      setIsCheckingBackend(true)
      try {
        await api('/health')
        if (isMounted) {
          setIsBackendAvailable(true)
        }
      } catch (error) {
        console.warn('[App] Бэкенд недоступен:', error)
        if (isMounted) {
          setIsBackendAvailable(false)
        }
      } finally {
        checkingRef = false
        if (isMounted) {
          setIsCheckingBackend(false)
        }
      }
    }

    // Проверяем сразу при монтировании
    checkBackend()

    // Проверяем каждые 5 секунд
    intervalId = setInterval(() => {
      checkBackend()
    }, 5000)

    return () => {
      isMounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, []) // Пустой массив зависимостей - проверяем только при монтировании

  // Функция для сохранения заметки перед навигацией
  // ПРИНУДИТЕЛЬНО пытается сохранить заметку, даже если редактор закрыт
  const saveNoteBeforeNavigation = useCallback(async (): Promise<void> => {
    console.log('[App] saveNoteBeforeNavigation: ПРИНУДИТЕЛЬНОЕ сохранение перед навигацией')
    
    if (ongoingSavePromiseRef.current) {
      console.log('[App] saveNoteBeforeNavigation: сохранение уже в процессе, ждём')
      await ongoingSavePromiseRef.current
      return
    }
    
    const savePromise = (async () => {
      if (isSavingRef.current) {
        console.log('[App] saveNoteBeforeNavigation: уже сохраняется, пропускаем')
        return
      }
      
      isSavingRef.current = true
      
      try {
        // СНАЧАЛА пробуем ПРЯМОЙ REF (напрямую из Notes.tsx)
        const directSaveNote = saveNoteRefGlobal.current
        console.log('[App] saveNoteBeforeNavigation: directSaveNote type =', typeof directSaveNote)
        
        let saveSucceeded = false
        
        if (typeof directSaveNote === 'function') {
          try {
            console.log('[App] saveNoteBeforeNavigation: вызываем directSaveNote (из Notes.tsx)')
            await directSaveNote()
            console.log('[App] saveNoteBeforeNavigation: directSaveNote завершено УСПЕШНО')
            saveSucceeded = true
          } catch (saveError) {
            console.error('[App] saveNoteBeforeNavigation: ошибка при directSaveNote', saveError)
            saveSucceeded = false
          }
        } else {
          // Если прямой ref не работает, пробуем handleSaveNote из контекста (старый способ)
          const currentHandleSaveNote = handleSaveNoteRef.current
          console.log('[App] saveNoteBeforeNavigation: directSaveNote не функция, пробуем handleSaveNote, type =', typeof currentHandleSaveNote)
          
          if (typeof currentHandleSaveNote === 'function') {
            try {
              console.log('[App] saveNoteBeforeNavigation: вызываем handleSaveNote (из контекста)')
              await currentHandleSaveNote()
              console.log('[App] saveNoteBeforeNavigation: handleSaveNote завершено успешно')
              saveSucceeded = true
            } catch (saveError) {
              console.error('[App] saveNoteBeforeNavigation: ошибка при handleSaveNote', saveError)
              saveSucceeded = false
            }
          }
        }
        
        // Если ничего не сработало, пробуем closeNoteEditor
        if (!saveSucceeded) {
          const currentCloseNoteEditor = closeNoteEditorRef.current
          console.log('[App] saveNoteBeforeNavigation: сохранение не сработало, пробуем closeNoteEditor, type =', typeof currentCloseNoteEditor)
          if (typeof currentCloseNoteEditor === 'function') {
            try {
              await currentCloseNoteEditor(false)
              console.log('[App] saveNoteBeforeNavigation: closeNoteEditor вызван')
            } catch (closeError) {
              console.error('[App] saveNoteBeforeNavigation: ошибка при closeNoteEditor', closeError)
            }
          }
        }
      } catch (error) {
        console.error('[App] saveNoteBeforeNavigation: ОБЩАЯ ОШИБКА', error)
        // НЕ ВЫБРАСЫВАЕМ ошибку, чтобы позволить навигации продолжиться
      } finally {
        setTimeout(() => {
          isSavingRef.current = false
        }, 200)
        ongoingSavePromiseRef.current = null
      }
    })()
    
    ongoingSavePromiseRef.current = savePromise
    await savePromise
  }, [])

  const handleBottomNavClick = useCallback(
    (targetPath: string) =>
      async (event: ReactMouseEvent<HTMLDivElement>) => {
        event.preventDefault()
        event.stopPropagation()
        
        const currentPath = location.pathname
        
        console.log('[App] handleBottomNavClick: targetPath =', targetPath, 'currentPath =', currentPath, 'isNoteEditorOpen =', isNoteEditorOpen)
        
        if (targetPath === '/notes' && currentPath === '/notes' && isNoteEditorOpen) {
          console.log('[App] handleBottomNavClick: тот же путь /notes и редактор открыт, закрываем редактор')
          const currentCloseNoteEditor = closeNoteEditorRef.current
          if (typeof currentCloseNoteEditor === 'function') {
            try {
              await currentCloseNoteEditor(true)
            } catch (error) {
              console.error('[App] handleBottomNavClick: не удалось закрыть редактор заметки', error)
            }
          }
          return
        }
        
        if (targetPath === currentPath) {
          console.log('[App] handleBottomNavClick: тот же путь, выходим')
          return
        }
        
        console.log('[App] handleBottomNavClick: вызываем ПРИНУДИТЕЛЬНОЕ сохранение перед навигацией')
        try {
          await saveNoteBeforeNavigation()
          console.log('[App] handleBottomNavClick: сохранение завершено (успешно или с ошибкой, но продолжаем)')
        } catch (error) {
          console.error(`[App] handleBottomNavClick: ошибка при сохранении, но навигация продолжается`, error)
        }
        
        console.log('[App] handleBottomNavClick: ПЕРЕХОДИМ НА', targetPath)
        navigate(targetPath)
      },
    [location.pathname, navigate, saveNoteBeforeNavigation]
  )

  const isLoginPage = location.pathname === '/login'
  const token = localStorage.getItem('token')
  
  if (isLoginPage) {
    return <Outlet />
  }

  // Если пользователь авторизован (есть токен), но бэкенд недоступен,
  // показываем сообщение об ошибке подключения вместо редиректа на логин
  if (token && isBackendAvailable === false) {
    return <DatabaseConnectionError />
  }

  return (
    <ProtectedRoute>
      <div className="app">
        <div className="main-content">
          <main className="content">
            <div key={location.pathname} className="page-transition">
              <Outlet />
            </div>
          </main>
          <nav className="bottom-nav">
            <div
              className={`bottom-nav-item ${location.pathname === '/' ? 'active' : ''}`}
              onClick={handleBottomNavClick('/')}
            >
              <div className="bottom-nav-icon-wrapper">
                <HomeIcon isActive={location.pathname === '/'} />
              </div>
              <div className="bottom-nav-label">Главная</div>
            </div>
            <div
              className={`bottom-nav-item ${location.pathname === '/notes' ? 'active' : ''}`}
              onClick={handleBottomNavClick('/notes')}
            >
              <div className="bottom-nav-icon-wrapper">
                <NotesIcon isActive={location.pathname === '/notes'} />
              </div>
              <div className="bottom-nav-label">Заметки</div>
            </div>
            <div
              className={`bottom-nav-item ${location.pathname === '/settings' ? 'active' : ''}`}
              onClick={handleBottomNavClick('/settings')}
            >
              <div className="bottom-nav-icon-wrapper">
                <SettingsIcon isActive={location.pathname === '/settings'} />
              </div>
              <div className="bottom-nav-label">Настройки</div>
            </div>
          </nav>
        </div>
      </div>
    </ProtectedRoute>
  )
}
