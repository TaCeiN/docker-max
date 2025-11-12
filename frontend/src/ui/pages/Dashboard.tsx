import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getDeadline, type Deadline } from '../../api/client'
import { useDialog } from '../contexts/DialogContext'
import CalendarPopup from '../components/CalendarPopup'

type Folder = { id: number; name: string; is_default: boolean; created_at: string }
type Tag = { id: number; name: string; color?: string | null }
type Note = { id: number; title: string; content?: string | null; folder_id?: number | null; is_favorite?: boolean; tags: Tag[]; has_deadline_notifications?: boolean }
type TodoItem = { id: number; text: string; completed: boolean }

// Функция для форматирования превью заметки (обычный текст или todo-лист)
function formatNotePreview(content: string | null | undefined, maxLength: number = 100): string {
  if (!content) return ''
  
  try {
    const parsed = JSON.parse(content)
    if (parsed.type === 'todo' && Array.isArray(parsed.items)) {
      // Форматируем todo-лист
      const items = parsed.items.filter((item: TodoItem) => item.text.trim())
      if (items.length === 0) {
        return '• Todo лист (пустой)'
      }
      const preview = items
        .slice(0, 3) // Показываем максимум 3 пункта
        .map((item: TodoItem) => {
          const checkbox = item.completed ? '●' : '○'
          const text = item.text.length > 30 ? item.text.substring(0, 30) + '...' : item.text
          return `${checkbox} ${text}`
        })
        .join(', ')
      const more = items.length > 3 ? ` (+${items.length - 3})` : ''
      return `• ${preview}${more}`
    }
  } catch {
    // Не JSON или не todo формат - обычный текст
  }
  
  // Обычный текст
  return content.length > maxLength ? content.substring(0, maxLength) + '...' : content
}

// Функция для проверки, является ли заметка todo-листом
function isTodoNote(content: string | null | undefined): boolean {
  if (!content) return false
  try {
    const parsed = JSON.parse(content)
    return parsed.type === 'todo' && Array.isArray(parsed.items)
  } catch {
    return false
  }
}

// Мини-превью для todo: иконка "бургер" + мини-шкала прогресса
function TodoMiniPreview({ content }: { content: string }) {
  try {
    const parsed = JSON.parse(content) as { type: 'todo'; items: TodoItem[] }
    if (parsed.type !== 'todo' || !Array.isArray(parsed.items)) return null
    const items = parsed.items.filter((i: TodoItem) => i.text && i.text.trim())
    const total = Math.max(1, items.length)
    const completed = items.filter(i => i.completed).length
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <rect x="2" y="3" width="10" height="2" rx="1" fill="rgba(255,255,255,0.8)" />
          <rect x="2" y="6" width="10" height="2" rx="1" fill="rgba(255,255,255,0.8)" />
          <rect x="2" y="9" width="10" height="2" rx="1" fill="rgba(255,255,255,0.8)" />
        </svg>
        <div
          style={{
            flex: 1,
            height: '6px',
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '3px',
            display: 'grid',
            gridTemplateColumns: `repeat(${total}, 1fr)`,
            gap: '2px',
            overflow: 'hidden',
            minWidth: '80px',
            maxWidth: '180px'
          }}
        >
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              style={{
                background: i < completed ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.25)',
                borderRadius: i === 0 ? '3px 0 0 3px' : i === total - 1 ? '0 3px 3px 0' : '0'
              }}
            />
          ))}
        </div>
      </div>
    )
  } catch {
    return null
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { alert } = useDialog()
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const searchPillRef = useRef<HTMLDivElement>(null)
  const scenarioPillRef = useRef<HTMLDivElement>(null)
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [maxHeight, setMaxHeight] = useState<string | undefined>(undefined)
  
  const { data: folders } = useQuery({ 
    queryKey: ['folders'], 
    queryFn: () => api<Folder[]>('/api/folders') 
  })

  // Загружаем все заметки для поиска
  const { data: allNotes } = useQuery({ 
    queryKey: ['notes'], 
    queryFn: () => api<Note[]>('/api/notes')
  })

  // Загружаем все теги
  const { data: allTags } = useQuery({ 
    queryKey: ['tags'], 
    queryFn: () => api<Tag[]>('/api/tags'), 
    enabled: true 
  })

  // Загружаем избранную заметку
  const { data: favoriteNote } = useQuery({ 
    queryKey: ['favoriteNote'], 
    queryFn: () => api<Note | null>('/api/notes/favorite'),
    enabled: true 
  })

  // Загружаем дедлайн для избранной заметки
  const { data: favoriteDeadline } = useQuery<Deadline | null>({
    queryKey: ['deadline', favoriteNote?.id],
    queryFn: async () => {
      if (!favoriteNote?.id) return null
      try {
        return await getDeadline(favoriteNote.id)
      } catch (error: any) {
        if (error.message?.includes('404') || error.message?.includes('не найден')) {
          return null
        }
        throw error
      }
    },
    enabled: !!favoriteNote?.id
  })

  // Функция для расчета процента выполнения todo-листа
  const calculateTodoProgress = (content: string | null | undefined): { percentage: number; completed: number; total: number; items: TodoItem[] } => {
    if (!content) return { percentage: 0, completed: 0, total: 0, items: [] }
    try {
      const parsed = JSON.parse(content)
      if (parsed.type === 'todo' && Array.isArray(parsed.items)) {
        const items = parsed.items.filter((item: TodoItem) => item.text.trim())
        if (items.length === 0) return { percentage: 0, completed: 0, total: 0, items: [] }
        const completed = items.filter((item: TodoItem) => item.completed).length
        const total = items.length
        const percentage = Math.round((completed / total) * 100)
        return { percentage, completed, total, items }
      }
    } catch {
      // Не todo формат
    }
    return { percentage: 0, completed: 0, total: 0, items: [] }
  }

  const todoProgress = favoriteNote ? calculateTodoProgress(favoriteNote.content) : null

  const createNote = useMutation({
    mutationFn: (payload: { title: string; content?: string | null; tags_text?: string | null; folder_id?: number | null }) => 
      api<Note>('/api/notes', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (note) => {
      // ВАЖНО: Устанавливаем sessionStorage ПЕРЕД навигацией, чтобы заметка открылась сразу
      // Это аналогично тому, как это работает в Notes.tsx при создании заметки
      sessionStorage.setItem('selectedNoteId', note.id.toString())
      if (note.folder_id) {
        sessionStorage.setItem('selectedFolderId', note.folder_id.toString())
      }
      console.log('[Dashboard] Создана заметка, устанавливаем sessionStorage:', {
        noteId: note.id,
        folderId: note.folder_id,
        title: note.title
      })
      
      // Обновляем кэш сразу, добавляя новую заметку в allNotes
      // Это гарантирует, что заметка будет доступна сразу после навигации
      // ВАЖНО: Делаем это ПОСЛЕ установки sessionStorage
      qc.setQueryData(['notes'], (old: Note[] | undefined) => {
        if (!old) {
          console.log('[Dashboard] Кэш allNotes пуст, создаем новый с заметкой:', note.id)
          return [note]
        }
        // Проверяем, нет ли уже такой заметки в кэше
        const exists = old.find((n: Note) => n.id === note.id)
        if (exists) {
          console.log('[Dashboard] Заметка уже есть в кэше, обновляем:', note.id)
          return old.map((n: Note) => n.id === note.id ? note : n)
        }
        console.log('[Dashboard] Добавляем заметку в кэш:', note.id, 'текущий размер кэша:', old.length, 'новый размер:', old.length + 1)
        return [...old, note]
      })
      
      // Получаем обновленный кэш для проверки
      const updatedCache = qc.getQueryData<Note[]>(['notes'])
      console.log('[Dashboard] Кэш обновлен, проверяем наличие заметки:', updatedCache?.find((n: Note) => n.id === note.id) ? 'найдена' : 'не найдена')
      
      // Инвалидируем запросы для обновления данных на сервере в фоне
      // Но кэш уже обновлен вручную, так что заметка будет доступна сразу
      qc.invalidateQueries({ queryKey: ['notes'] })
      
      // Переходим на страницу заметок - заметка откроется автоматически через sessionStorage
      navigate('/notes', { replace: false, state: { fromDashboard: true } })
    },
    onError: async (e) => {
      console.error('Ошибка создания заметки:', e)
      await alert('Не удалось создать заметку')
    }
  })

  const handleCreateNote = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    // Если папка не выбрана, используем папку по умолчанию
    const folderId = folders?.find(f => f.is_default)?.id || folders?.[0]?.id || null
    if (!folderId) {
      await alert('Сначала создайте папку')
      return
    }
    console.log('Creating note with folderId:', folderId)
    createNote.mutate({ 
      title: 'Без названия', 
      content: '', 
      tags_text: null,
      folder_id: folderId
    })
  }

  // Фильтрация заметок по поисковому запросу и тегам
  const filteredNotes = useMemo(() => {
    if (!allNotes || allNotes.length === 0) return []
    
    if (!searchQuery.trim()) return []
    
    const query = searchQuery.toLowerCase().trim()
    
    // Проверяем, является ли запрос тегом (начинается с #)
    const isTagSearch = query.startsWith('#')
    const tagName = isTagSearch ? query.slice(1) : null
    
    let filtered = allNotes
    
    // Если поиск по тегу
    if (isTagSearch && tagName) {
      filtered = filtered.filter(note => 
        note.tags && note.tags.some(tag => tag.name.toLowerCase() === tagName)
      )
    } else {
      // Поиск по ключевым словам в заголовке и содержимом
      filtered = filtered.filter(note => {
        const titleMatch = note.title?.toLowerCase().includes(query) || false
        const contentMatch = note.content?.toLowerCase().includes(query) || false
        const tagMatch = note.tags?.some(tag => tag.name.toLowerCase().includes(query)) || false
        return titleMatch || contentMatch || tagMatch
      })
    }
    
    return filtered
  }, [allNotes, searchQuery])

  // Вычисляем максимальную высоту для расширенного блока поиска
  useEffect(() => {
    const calculateMaxHeight = () => {
      if (searchPillRef.current && scenarioPillRef.current && (isSearchFocused || searchQuery.trim())) {
        const searchRect = searchPillRef.current.getBoundingClientRect()
        const scenarioRect = scenarioPillRef.current.getBoundingClientRect()
        
        // Вычисляем расстояние от верхнего края блока поиска до верхнего края pill--scenario
        // gap = 16px (отступ между элементами в .screen)
        const gap = 16
        const distance = scenarioRect.top - searchRect.top
        
        // Максимальная высота = расстояние минус gap (отступ между блоками)
        // Но нужно убедиться, что высота не меньше минимальной (56px)
        const minHeight = 56
        const calculatedMaxHeight = distance - gap
        
        if (calculatedMaxHeight >= minHeight) {
          setMaxHeight(`${calculatedMaxHeight}px`)
        } else {
          setMaxHeight(`${minHeight}px`)
        }
      } else {
        setMaxHeight(undefined)
      }
    }

    // Вызываем расчет сразу и после небольших задержек для корректного результата после рендера
    calculateMaxHeight()
    const timeout1 = setTimeout(calculateMaxHeight, 50)
    const timeout2 = setTimeout(calculateMaxHeight, 200)
    const timeout3 = setTimeout(calculateMaxHeight, 500)

    window.addEventListener('resize', calculateMaxHeight)
    window.addEventListener('scroll', calculateMaxHeight)

    return () => {
      clearTimeout(timeout1)
      clearTimeout(timeout2)
      clearTimeout(timeout3)
      window.removeEventListener('resize', calculateMaxHeight)
      window.removeEventListener('scroll', calculateMaxHeight)
    }
  }, [isSearchFocused, searchQuery])

  // Очистка таймера уведомления при размонтировании
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current)
      }
    }
  }, [])
  
  // Получаем текущую дату
  const now = new Date()
  const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
  const months = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря']
  const dayName = days[now.getDay()]
  const dayNumber = now.getDate()
  const monthName = months[now.getMonth()]

  return (
    <main className="screen">
      {/* Top-wide Goal Card */}
      <section 
        className="card card--goal" 
        role="button" 
        aria-label={favoriteNote ? favoriteNote.title : "Цель не задана"}
        onClick={() => {
          if (favoriteNote) {
            // ВАЖНО: Устанавливаем ТОЛЬКО selectedNoteId, НЕ selectedFolderId
            // Это гарантирует, что заметка откроется сразу в редакторе, а не в папке
            sessionStorage.setItem('selectedNoteId', favoriteNote.id.toString())
            // НЕ устанавливаем selectedFolderId - заметка откроется напрямую через allNotes
            // Используем replace: false и state для принудительного обновления
            navigate('/notes', { replace: false, state: { fromDashboard: true } })
          } else {
            // Показываем уведомление вместо перехода на /tasks
            setShowNotification(true)
            // Очищаем предыдущий таймер, если есть
            if (notificationTimeoutRef.current) {
              clearTimeout(notificationTimeoutRef.current)
            }
            // Скрываем уведомление через 5 секунд
            notificationTimeoutRef.current = setTimeout(() => {
              setShowNotification(false)
            }, 5000)
          }
        }}
      >
        {/* Слой для белого освещения в левом верхнем углу */}
        <div className="card--goal__light"></div>
        <div className="card__text">
          <div className="title">
            {favoriteNote ? favoriteNote.title : 'Цель не задана'}
          </div>
          <div className="subtitle">
            {favoriteNote && todoProgress && todoProgress.total > 0 ? (
              <>
                {todoProgress.completed} из {todoProgress.total}, {todoProgress.completed === 0 ? 'пора действовать!' : 'так держать!'}
              </>
            ) : (
              'Отслеживайте свою цель и ставьте новые задачи'
            )}
          </div>
          {favoriteNote && todoProgress && todoProgress.total > 0 && (
            <div style={{
              marginTop: '12px',
              width: '100%',
              height: '8px',
              background: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Равные сегменты по числу задач */}
              {(() => {
                const total = Math.max(1, todoProgress.total)
                const completed = Math.max(0, Math.min(todoProgress.completed, total))
                const gap = 2
                return (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'grid',
                      gridTemplateColumns: `repeat(${total}, 1fr)`,
                      gap: `${gap}px`,
                      padding: 0
                    }}
                  >
                    {Array.from({ length: total }).map((_, i) => {
                      const isFilled = i < completed
                      const radiusLeft = i === 0 ? '4px' : '0'
                      const radiusRight = i === total - 1 ? '4px' : '0'
                      return (
                        <div
                          key={i}
                          style={{
                            background: isFilled ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.15)',
                            borderRadius: `${radiusLeft} ${radiusRight} ${radiusRight} ${radiusLeft}`,
                            transition: 'background-color 0.3s ease'
                          }}
                        />
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
        <svg className="chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </section>

      {/* Middle row - две квадратные карточки */}
      <div className="row two-columns">
        {/* Date Card */}
        <div 
          className="card card--date" 
          aria-label="Дата"
          role="button"
          onClick={() => setShowCalendar(true)}
        >
          <div className="card--date__light"></div>
          <div className="day">{dayName}</div>
          <div className="date-num">{dayNumber}</div>
          <div className="month">{monthName}</div>
        </div>

        {/* New Note Card */}
        <div 
          className="card card--note" 
          role="button" 
          aria-label="Новая заметка"
          onClick={handleCreateNote}
        >
          <div className="card--note__light"></div>
          <div className="card--note__content">
            <div className="label">
              <div>Новая</div>
              <div>заметка</div>
            </div>
            <svg className="chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <svg className="pencil" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'none' }} aria-hidden="true">
            <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M18.5 2.5C18.8978 2.10217 19.4374 1.87868 20 1.87868C20.5626 1.87868 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1213 3.43739 22.1213 4C22.1213 4.56261 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Search Bar */}
      <div 
        className="search-pill-wrapper"
        style={{ position: 'relative' }}
      >
        <div 
          ref={searchPillRef}
          className={`search-pill ${isSearchFocused || searchQuery.trim() ? 'search-pill--expanded' : ''}`}
          role="search" 
          aria-label="Поиск"
          style={maxHeight ? { maxHeight } : undefined}
        >
        <div className="search-pill__input-wrapper">
          <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="11" cy="11" r="8" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/>
            <path d="M21 21L16.65 16.65" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Поиск"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '1rem',
              outline: 'none',
              padding: 0
            }}
          />
        </div>
        
        {/* Результаты поиска внутри расширенного блока */}
        {(isSearchFocused || searchQuery.trim()) && (
          <div className="search-pill__results">
            {searchQuery.trim() && filteredNotes.length > 0 && (
              <div className="search-pill__results-list">
                {filteredNotes.map(note => (
                  <div
                    key={note.id}
                    className="search-pill__result-item"
                    onClick={() => {
                      navigate('/notes')
                      if (note.folder_id) {
                        sessionStorage.setItem('selectedNoteId', note.id.toString())
                        sessionStorage.setItem('selectedFolderId', note.folder_id.toString())
                      }
                    }}
                  >
                    <div className="search-pill__result-title">
                      {note.title || 'Без названия'}
                    </div>
                    {note.content && (
                      <div className="search-pill__result-content">
                        {isTodoNote(note.content) ? <TodoMiniPreview content={note.content} /> : formatNotePreview(note.content, 80)}
                      </div>
                    )}
                    {note.tags && note.tags.length > 0 && (
                      <div className="search-pill__result-tags">
                        {note.tags.map(tag => (
                          <span 
                            key={tag.id} 
                            className="search-pill__result-tag"
                            style={{ 
                              color: tag.color || 'var(--fg-secondary)'
                            }}
                          >
                            #{tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {searchQuery.trim() && filteredNotes.length === 0 && (
              <div className="search-pill__no-results">
                Заметки не найдены
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Уведомление над элементом "Сценарий использования не выбран" */}
      {showNotification && (
        <div className="notification--goal">
          Сначала необходимо добавить TO-DO LIST в избранное
        </div>
      )}

      {/* Thin Scenario Pill - всегда видимый, статичная позиция */}
      <div 
        ref={scenarioPillRef} 
        className={`pill--scenario ${favoriteDeadline && favoriteDeadline.notification_enabled ? 'pill--scenario--active' : ''}`}
      >
        {favoriteDeadline && favoriteDeadline.notification_enabled ? 'Уведомления включены' : 'Уведомления выключены'}
      </div>

      {/* Calendar Popup */}
      <CalendarPopup open={showCalendar} onClose={() => setShowCalendar(false)} />
    </main>
  )
}
