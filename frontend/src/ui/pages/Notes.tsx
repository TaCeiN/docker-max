import { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { api, createDeadline, getDeadline, updateDeadline, deleteDeadline, toggleDeadlineNotifications, testDeadlineNotification, type Deadline } from '../../api/client'
import { useNotesContext } from '../contexts/NotesContext'
import { useDialog } from '../contexts/DialogContext'
import { saveNoteRefGlobal } from '../App'
import { FolderIcon } from '../../assets/icons/FolderIcon'
import { PlusIcon } from '../../assets/icons/PlusIcon'
import { TrashIcon } from '../../assets/icons/TrashIcon'
import { DocumentIcon } from '../../assets/icons/DocumentIcon'
import { LightningIcon } from '../../assets/icons/LightningIcon'
import { AlarmIcon } from '../../assets/icons/AlarmIcon'
import { BellIcon } from '../../assets/icons/BellIcon'
import DeadlineModal from '../components/DeadlineModal'

type Tag = { id: number; name: string; color?: string | null }
type Note = { id: number; title: string; content?: string | null; folder_id?: number | null; is_favorite?: boolean; tags: Tag[]; has_deadline_notifications?: boolean }
type Folder = { id: number; name: string; is_default: boolean; created_at: string }

type TodoItem = { id: number; text: string; completed: boolean }
type TodoData = { type: 'todo'; items: TodoItem[] }

// Функция для форматирования превью заметки для поиска (как в Dashboard)
function formatNotePreview(content: string | null | undefined, maxLength: number = 100): string {
  if (!content) return ''
  
  try {
    const parsed = JSON.parse(content)
    if (parsed.type === 'todo' && Array.isArray(parsed.items)) {
      const items = parsed.items.filter((item: TodoItem) => item.text.trim())
      if (items.length === 0) {
        return '• Todo лист (пустой)'
      }
      const preview = items
        .slice(0, 3)
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
  
  return content.length > maxLength ? content.substring(0, maxLength) + '...' : content
}

// Функция для выделения найденного текста
function highlightText(text: string, searchQuery: string): React.ReactNode {
  if (!searchQuery.trim() || !text) return text
  
  const query = searchQuery.trim()
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  const parts = text.split(regex)
  
  return parts.map((part, index) => {
    // Проверяем, является ли часть совпадением (чередуются совпадения и несовпадения)
    const isMatch = index % 2 === 1
    return isMatch ? (
      <mark key={index} style={{ backgroundColor: '#4a90e2', color: '#fff', padding: '0 2px', borderRadius: '2px' }}>
        {part}
      </mark>
    ) : (
      part
    )
  })
}


// Функция для получения релевантного фрагмента текста с выделением
function getHighlightedPreview(text: string, searchQuery: string, maxLength: number = 50): React.ReactNode {
  if (!text) return null
  
  // Проверяем, является ли это todo-листом
  try {
    const parsed = JSON.parse(text)
    if (parsed.type === 'todo' && Array.isArray(parsed.items)) {
      // Для todo-листа используем форматированное превью
      const formatted = formatNotePreview(text, maxLength)
      const query = searchQuery.trim().toLowerCase()
      const formattedLower = formatted.toLowerCase()
      const index = formattedLower.indexOf(query)
      
      if (index === -1) {
        return formatted
      }
      
      // Выделяем найденный текст в форматированном превью
      const beforeMatch = formatted.substring(0, index)
      const match = formatted.substring(index, index + query.length)
      const afterMatch = formatted.substring(index + query.length)
      
      return (
        <>
          {beforeMatch}
          <mark style={{ backgroundColor: '#4a90e2', color: '#fff', padding: '0 2px', borderRadius: '2px' }}>
            {match}
          </mark>
          {afterMatch}
        </>
      )
    }
  } catch {
    // Не JSON - обычный текст
  }
  
  const query = searchQuery.trim().toLowerCase()
  const textLower = text.toLowerCase()
  const index = textLower.indexOf(query)
  
  if (index === -1) {
    // Если не найдено, возвращаем начало текста
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }
  
  // Находим контекст вокруг совпадения
  const start = Math.max(0, index - 20)
  const end = Math.min(text.length, index + query.length + 20)
  let preview = text.substring(start, end)
  
  // Выделяем найденный текст
  const beforeMatch = text.substring(start, index)
  const match = text.substring(index, index + query.length)
  const afterMatch = text.substring(index + query.length, end)
  
  return (
    <>
      {start > 0 && '...'}
      {beforeMatch}
      <mark style={{ backgroundColor: '#4a90e2', color: '#fff', padding: '0 2px', borderRadius: '2px' }}>
        {match}
      </mark>
      {afterMatch}
      {end < text.length && '...'}
    </>
  )
}

// Компонент SVG звездочки
function StarIcon({ isActive }: { isActive: boolean }) {
  const fillColor = isActive ? "#4a90e2" : "rgba(255, 255, 255, 0.35)"
  const strokeColor = isActive ? "#4a90e2" : "rgba(255, 255, 255, 0.35)"
  
  return (
    <svg 
      width="20" 
      height="20" 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="star-icon"
      style={{ 
        width: '20px', 
        height: '20px',
        transition: 'all 0.2s ease'
      }}
    >
      <path 
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Компонент TodoList
function TodoList({ 
  items, 
  onChange,
  onConfirmDelete
}: { 
  items: TodoItem[]
  onChange: (items: TodoItem[]) => void
  onConfirmDelete: (message: string) => Promise<boolean>
}) {
  const updateItem = (id: number, updates: Partial<TodoItem>) => {
    const newItems = items.map(item => 
      item.id === id ? { ...item, ...updates } : item
    )
    onChange(newItems)
  }

  const addItem = (afterId?: number) => {
    const newItem: TodoItem = { id: Date.now(), text: '', completed: false }
    if (afterId !== undefined) {
      const index = items.findIndex(item => item.id === afterId)
      const newItems = [...items]
      newItems.splice(index + 1, 0, newItem)
      onChange(newItems)
    } else {
      onChange([...items, newItem])
    }
  }

  const removeItem = async (id: number) => {
    const item = items.find(i => i.id === id)
    const itemText = item?.text?.trim() || ''
    
    // Если пункт пустой, удаляем без подтверждения
    if (!itemText) {
      const newItems = items.filter(item => item.id !== id)
      // Если удалили последний пункт, добавляем новый пустой
      if (newItems.length === 0) {
        onChange([{ id: Date.now(), text: '', completed: false }])
      } else {
        onChange(newItems)
      }
      return
    }
    
    // Для непустых пунктов запрашиваем подтверждение
    const confirmed = await onConfirmDelete(`Вы уверены, что хотите удалить пункт "${itemText}"?`)
    if (confirmed) {
      const newItems = items.filter(item => item.id !== id)
      // Если удалили последний пункт, добавляем новый пустой
      if (newItems.length === 0) {
        onChange([{ id: Date.now(), text: '', completed: false }])
      } else {
        onChange(newItems)
      }
    }
  }

  return (
    <div className="todo-list-container">
      {items.map((item, index) => (
        <div key={item.id} className="todo-item-wrapper">
          <div className="todo-item">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={(e) => updateItem(item.id, { completed: e.target.checked })}
              className="todo-checkbox"
            />
            <input
              type="text"
              value={item.text}
              onChange={(e) => updateItem(item.id, { text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addItem(item.id)
                  // Фокус на новый элемент после небольшой задержки
                  setTimeout(() => {
                    const nextInput = document.querySelector(`.todo-item-wrapper:nth-child(${index + 2}) .todo-text-input`) as HTMLInputElement
                    nextInput?.focus()
                  }, 10)
                } else if (e.key === 'Backspace' && item.text === '' && items.length > 1) {
                  e.preventDefault()
                  const prevInput = document.querySelector(`.todo-item-wrapper:nth-child(${index}) .todo-text-input`) as HTMLInputElement
                  removeItem(item.id)
                  prevInput?.focus()
                }
              }}
              placeholder="Введите пункт todo..."
              className="todo-text-input"
              style={{
                textDecoration: item.completed ? 'line-through' : 'none',
                opacity: item.completed ? 0.6 : 1
              }}
            />
          </div>
          <button
            onClick={async (e) => {
              e.stopPropagation()
              await removeItem(item.id)
            }}
            className="todo-delete-button"
            title="Удалить пункт"
            type="button"
          >
            <TrashIcon width={16} height={16} />
          </button>
        </div>
      ))}
      <div className="todo-item-wrapper todo-add-wrapper">
        <button
          onClick={() => {
            const lastItem = items.length > 0 ? items[items.length - 1] : null
            if (lastItem) {
              addItem(lastItem.id)
            } else {
              addItem()
            }
            // Фокус на новый элемент после небольшой задержки
            setTimeout(() => {
              const nextInput = document.querySelector(`.todo-item-wrapper:last-child .todo-text-input`) as HTMLInputElement
              nextInput?.focus()
            }, 10)
          }}
          className="todo-add-button"
          title="Добавить пункт"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function Notes() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { searchQuery, setSearchQuery, setHandleCreateNote, isNoteEditorOpen, setIsNoteEditorOpen, handleSaveNote, setHandleSaveNote, setCloseNoteEditor } = useNotesContext()
  const { confirm, alert } = useDialog()
  
  // Инициализируем состояние из sessionStorage синхронно, чтобы избежать показа списка папок при первом рендере
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const folderIdStr = sessionStorage.getItem('selectedFolderId')
      return folderIdStr ? parseInt(folderIdStr) : null
    }
    return null
  })
  // Обертка для setSelectedNoteId с логированием
  const setSelectedNoteIdWithLog = (value: number | null, reason?: string) => {
    setSelectedNoteId((prevValue) => {
      console.log('[Notes] setSelectedNoteId вызван:', {
        новоеЗначение: value,
        староеЗначение: prevValue,
        причина: reason || 'не указана',
        stackTrace: new Error().stack?.split('\n').slice(2, 5).join('\n')
      })
      return value
    })
  }
  
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const noteIdStr = sessionStorage.getItem('selectedNoteId')
      const noteId = noteIdStr ? parseInt(noteIdStr) : null
      if (noteId) {
        console.log('[Notes] Инициализация: selectedNoteId из sessionStorage:', noteId)
      } else {
        console.log('[Notes] Инициализация: selectedNoteId не найден в sessionStorage')
      }
      return noteId
    }
    return null
  })
  
  // Используем обертку вместо прямого setSelectedNoteId
  // Но оставляем setSelectedNoteId для обратной совместимости
  const setSelectedNoteIdWrapper = (value: number | null, reason?: string) => {
    setSelectedNoteIdWithLog(value, reason)
  }
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  
  // Читаем tag_id из URL параметров
  const tagIdFromUrl = searchParams.get('tag_id')
  const [selectedTagId, setSelectedTagId] = useState<number | null>(
    tagIdFromUrl ? parseInt(tagIdFromUrl) : null
  )
  const [showFolderSelect, setShowFolderSelect] = useState(false)
  const [previousView, setPreviousView] = useState<'folders' | 'folder' | 'search' | 'tag' | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [showSaveNotification, setShowSaveNotification] = useState(false)
  
  // Состояния для дедлайнов
  const [showDeadlineModal, setShowDeadlineModal] = useState(false)
  
  // Состояния для поиска с расширением вверх
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const searchPillRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const topElementRef = useRef<HTMLDivElement>(null)
  const [maxHeight, setMaxHeight] = useState<string | undefined>(undefined)
  
  const { data: folders, isLoading: foldersLoading } = useQuery({ 
    queryKey: ['folders'], 
    queryFn: () => api<Folder[]>('/api/folders') 
  })
  

  // Загружаем заметки: если выбрана папка - из папки, если есть фильтр по тегу - все заметки с тегом
  const { data: notes, isLoading: notesLoading } = useQuery({ 
    queryKey: ['notes', selectedFolderId, selectedTagId], 
    queryFn: () => {
      const params = new URLSearchParams()
      if (selectedFolderId && !selectedTagId) {
        // Если выбрана папка и нет фильтра по тегу - фильтруем по папке
        params.append('folder_id', selectedFolderId.toString())
      }
      if (selectedTagId) {
        // Если есть фильтр по тегу - фильтруем по тегу (все заметки с этим тегом)
        params.append('tag_id', selectedTagId.toString())
      }
      const queryString = params.toString()
      return api<Note[]>(`/api/notes${queryString ? `?${queryString}` : ''}`)
    },
    enabled: selectedFolderId !== null || selectedTagId !== null
  })
  
  const { data: allTags } = useQuery({ 
    queryKey: ['tags'], 
    queryFn: () => api<Tag[]>('/api/tags'), 
    enabled: true 
  })

  // Получаем все заметки для тегов (используется в редакторе)
  const { data: allNotes, isLoading: allNotesLoading } = useQuery({ 
    queryKey: ['notes'], 
    queryFn: () => api<Note[]>('/api/notes')
  })

  // Загружаем текущую избранную заметку
  const { data: currentFavoriteNote } = useQuery({ 
    queryKey: ['favoriteNote'], 
    queryFn: () => api<Note | null>('/api/notes/favorite'),
    enabled: true 
  })

  // Собираем теги для автодополнения и отображения
  const allAvailableTags = useMemo(() => {
    const tagMap = new Map<number, Tag>()
    if (allNotes) allNotes.forEach(n => n.tags?.forEach(tag => tagMap.set(tag.id, tag)))
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allNotes])

  // Используем те же теги для отображения на главном экране
  const availableTags = allAvailableTags

  const [title, setTitleState] = useState('')
  const [content, setContentState] = useState('')
  const [tagsText, setTagsTextState] = useState('')
  const [todoItems, setTodoItemsState] = useState<TodoItem[]>([])
  const [isTodoMode, setIsTodoMode] = useState(false)
  
  // Обертки для setter'ов, которые сбрасывают флаги загрузки при первом изменении
  const setTitle = (value: string | ((prev: string) => string)) => {
    // Сбрасываем флаги при первом изменении
    if (isInitialLoad || justLoadedRef.current) {
      setIsInitialLoad(false)
      justLoadedRef.current = false
      console.log('[Notes] Флаги isInitialLoad и justLoadedRef сброшены при изменении title')
    }
    setTitleState(value)
  }
  
  const setContent = (value: string | ((prev: string) => string)) => {
    // Сбрасываем флаги при первом изменении
    if (isInitialLoad || justLoadedRef.current) {
      setIsInitialLoad(false)
      justLoadedRef.current = false
      console.log('[Notes] Флаги isInitialLoad и justLoadedRef сброшены при изменении content')
    }
    setContentState(value)
  }
  
  const setTagsText = (value: string | ((prev: string) => string)) => {
    // Сбрасываем флаги при первом изменении
    if (isInitialLoad || justLoadedRef.current) {
      setIsInitialLoad(false)
      justLoadedRef.current = false
      console.log('[Notes] Флаги isInitialLoad и justLoadedRef сброшены при изменении tagsText')
    }
    setTagsTextState(value)
  }
  
  const setTodoItems = (value: TodoItem[] | ((prev: TodoItem[]) => TodoItem[])) => {
    // Сбрасываем флаги при первом изменении
    if (isInitialLoad || justLoadedRef.current) {
      setIsInitialLoad(false)
      justLoadedRef.current = false
      console.log('[Notes] Флаги isInitialLoad и justLoadedRef сброшены при изменении todoItems')
    }
    setTodoItemsState(value)
  }

  const currentNote = useMemo(() => {
    if (!selectedNoteId) return null
    // Ищем заметку сначала в notes, потом в allNotes
    if (notes) {
      const found = notes.find(n => n.id === selectedNoteId)
      if (found) return found
    }
    if (allNotes) {
      const found = allNotes.find(n => n.id === selectedNoteId)
      if (found) return found
    }
    return null
  }, [notes, allNotes, selectedNoteId])

  // Определяем заметку для отображения: используем currentNote или ищем напрямую в allNotes
  // Это нужно для того, чтобы заметка открывалась сразу после загрузки allNotes, даже если notes еще не загружен
  // ВАЖНО: сначала ищем в allNotes, чтобы заметка находилась сразу после загрузки allNotes
  const noteToShow = useMemo(() => {
    if (!selectedNoteId) return null
    // Сначала ищем в allNotes (быстрее, так как allNotes загружается сразу)
    if (allNotes) {
      const found = allNotes.find(n => n.id === selectedNoteId)
      if (found) {
        console.log('[Notes] noteToShow: найдена в allNotes:', found.id)
        return found
      }
    }
    // Потом используем currentNote (который ищет в notes и allNotes)
    if (currentNote) {
      console.log('[Notes] noteToShow: найдена в currentNote:', currentNote.id)
      return currentNote
    }
    console.log('[Notes] noteToShow: не найдена, selectedNoteId:', selectedNoteId, 'allNotes:', allNotes?.length)
    return null
  }, [selectedNoteId, allNotes, currentNote])

  // Проверяем, является ли текущая заметка todo для загрузки дедлайна
  const isNoteTodo = useMemo(() => {
    if (!noteToShow?.content) return false
    try {
      const parsed = JSON.parse(noteToShow.content)
      return parsed.type === 'todo' && Array.isArray(parsed.items)
    } catch {
      return false
    }
  }, [noteToShow])

  // Загружаем дедлайн для текущей заметки (только для todo-заметок)
  const { data: deadline, isLoading: deadlineLoading } = useQuery<Deadline | null>({
    queryKey: ['deadline', selectedNoteId],
    queryFn: async () => {
      if (!selectedNoteId) return null
      try {
        return await getDeadline(selectedNoteId)
      } catch (error: any) {
        if (error.message?.includes('404') || error.message?.includes('не найден')) {
          return null
        }
        throw error
      }
    },
    enabled: !!selectedNoteId && isNoteTodo,
    retry: false
  })

  // Фильтрация заметок по поисковому запросу
  // Если есть поиск по тексту, используем все заметки, иначе используем notes из запроса
  const notesToFilter = useMemo(() => {
    // Если есть поиск по тексту, используем все заметки для поиска по всем папкам
    if (searchQuery.trim() && allNotes) {
      return allNotes
    }
    // Иначе используем заметки из текущего запроса
    return notes || []
  }, [notes, allNotes, searchQuery])

  const filteredNotes = useMemo(() => {
    if (!notesToFilter || notesToFilter.length === 0) return []
    
    // Если есть поиск по тексту, фильтруем
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      let filtered = notesToFilter.filter(n => 
        n.title.toLowerCase().includes(query) || 
        (n.content && n.content.toLowerCase().includes(query))
      )
      
      // Если также выбран тег, дополнительно фильтруем по тегу
      if (selectedTagId) {
        filtered = filtered.filter(n => 
          n.tags && n.tags.some(tag => tag.id === selectedTagId)
        )
      }
      
      return filtered
    }
    
    // Если нет поиска по тексту, возвращаем как есть (уже отфильтровано по папке/тегу на сервере)
    return notesToFilter
  }, [notesToFilter, searchQuery, selectedTagId])

  // Функция для парсинга content и определения, является ли это todo листом
  const parseTodoData = (content: string | null | undefined): { isTodo: boolean; items: TodoItem[] } => {
    if (!content) return { isTodo: false, items: [] }
    try {
      const parsed = JSON.parse(content)
      if (parsed.type === 'todo' && Array.isArray(parsed.items)) {
        return { isTodo: true, items: parsed.items }
      }
    } catch {
      // Не JSON или не todo формат
    }
    return { isTodo: false, items: [] }
  }

  // Функция для сериализации todo листа в JSON
  const serializeTodoData = (items: TodoItem[]): string => {
    return JSON.stringify({ type: 'todo', items })
  }

  // Храним ID последней загруженной заметки для предотвращения повторных загрузок
  const lastLoadedNoteIdRef = useRef<number | null>(null)
  
  // Флаг для отслеживания, была ли заметка только что загружена (для предотвращения сохранения при открытии)
  const justLoadedRef = useRef<boolean>(false)
  
  // Флаг для предотвращения закрытия редактора, если заметка только что открылась из sessionStorage
  const justOpenedFromStorageRef = useRef<boolean>(false)

  useEffect(() => {
    // Проверяем, действительно ли изменилась заметка (по ID)
    const currentNoteId = currentNote?.id || null
    // Если lastLoadedNoteIdRef был сброшен (null), принудительно перезагружаем
    const shouldReload = lastLoadedNoteIdRef.current === null || currentNoteId !== lastLoadedNoteIdRef.current
    if (!shouldReload) {
      // Та же заметка, не перезагружаем
      return
    }
    
    // Сбрасываем флаг при смене заметки
    justLoadedRef.current = false
    
    // Обновляем ID последней загруженной заметки
    lastLoadedNoteIdRef.current = currentNoteId
    
    if (noteToShow) {
      // Устанавливаем флаг загрузки ПЕРЕД обновлением состояния
      // Это важно, чтобы предотвратить сохранение с неправильными данными
      setIsInitialLoad(true)
      justLoadedRef.current = true // Устанавливаем флаг, что заметка только что загружена
      
      const contentValue = noteToShow.content || ''
      const { isTodo, items } = parseTodoData(contentValue)
      const initialTagsText = (noteToShow.tags || []).map(t => `#${t.name}`).join(' ') || ''
      
      console.log('[Notes] Загрузка заметки:', {
        id: noteToShow.id,
        title: noteToShow.title,
        contentLength: contentValue.length,
        isTodo,
        itemsCount: items.length
      })
      
      // Устанавливаем состояния напрямую через setState (без сброса флагов)
      setTitleState(noteToShow.title || '')
      setIsTodoMode(isTodo)
      if (isTodo) {
        setTodoItemsState(items.length > 0 ? items : [{ id: Date.now(), text: '', completed: false }])
        setContentState('')
        console.log('[Notes] Заметка распознана как todo, установлено todoItems:', items.length)
      } else {
        setContentState(contentValue)
        setTodoItemsState([])
        console.log('[Notes] Заметка распознана как обычная, установлен content:', contentValue.length, 'символов')
      }
      setTagsTextState(initialTagsText)
      
      // Сбрасываем флаги после задержки (увеличено до 1000ms для гарантии полной загрузки)
      // Это важно, чтобы предотвратить сохранение с неправильными данными при открытии заметки
      const timeoutId = setTimeout(() => {
        setIsInitialLoad(false)
        justLoadedRef.current = false // Сбрасываем флаг после задержки
        console.log('[Notes] isInitialLoad и justLoadedRef установлены в false после загрузки заметки')
      }, 1000)
      
      return () => clearTimeout(timeoutId)
    } else {
      setTitleState('')
      setContentState('')
      setTagsTextState('')
      setTodoItemsState([])
      setIsTodoMode(false)
      setIsInitialLoad(true)
    }
  }, [noteToShow?.id, noteToShow?.content]) // Добавляем зависимость от content, чтобы перезагружать при изменении формата (todo <-> заметка)


  // Отслеживаем предыдущий вид при открытии заметки
  useEffect(() => {
    if (selectedNoteId) {
      if (selectedFolderId !== null) {
        setPreviousView('folder')
      } else if (searchQuery.trim() || selectedTagId) {
        setPreviousView(searchQuery.trim() ? 'search' : 'tag')
      } else {
        setPreviousView('folders')
      }
    }
  }, [selectedNoteId])

  // Обновляем флаг открытия редактора заметки
  useEffect(() => {
    setIsNoteEditorOpen(selectedNoteId !== null && noteToShow !== null)
  }, [selectedNoteId, noteToShow, setIsNoteEditorOpen])

  // Обновляем selectedTagId при изменении URL параметра
  useEffect(() => {
    const tagIdFromUrl = searchParams.get('tag_id')
    if (tagIdFromUrl) {
      setSelectedTagId(parseInt(tagIdFromUrl))
    } else {
      setSelectedTagId(null)
    }
  }, [searchParams])

  // Проверяем sessionStorage при монтировании и при переходе на страницу /notes
  useEffect(() => {
    // Проверяем только если мы на странице /notes
    if (location.pathname !== '/notes') {
      return
    }
    
    // Проверяем sessionStorage на наличие новых данных (например, при создании заметки из Dashboard)
    const selectedNoteIdStr = sessionStorage.getItem('selectedNoteId')
    const selectedFolderIdStr = sessionStorage.getItem('selectedFolderId')
    
    // Если selectedNoteId уже установлен из инициализации, но в sessionStorage есть другой ID
    // или если selectedNoteId не установлен, но в sessionStorage есть данные
    if (selectedNoteIdStr) {
      const noteId = parseInt(selectedNoteIdStr)
      const folderId = selectedFolderIdStr ? parseInt(selectedFolderIdStr) : null
      
      // Если selectedNoteId уже установлен и совпадает с sessionStorage, просто очищаем sessionStorage
      // НО устанавливаем флаг, что заметка только что открылась из sessionStorage
      if (selectedNoteId === noteId) {
        console.log('[Notes] selectedNoteId уже установлен и совпадает с sessionStorage:', noteId, 'очищаем sessionStorage')
        
        // ВАЖНО: Устанавливаем флаг, даже если selectedNoteId уже установлен
        // Это предотвратит автоматическое закрытие редактора при навигации
        justOpenedFromStorageRef.current = true
        console.log('[Notes] Установлен флаг justOpenedFromStorageRef для заметки (уже установлен):', noteId)
        
        // Сбрасываем флаг через небольшую задержку, чтобы дать время всем эффектам выполниться
        setTimeout(() => {
          justOpenedFromStorageRef.current = false
          console.log('[Notes] Сброшен флаг justOpenedFromStorageRef')
        }, 1000)
        
        sessionStorage.removeItem('selectedNoteId')
        if (selectedFolderIdStr) {
          sessionStorage.removeItem('selectedFolderId')
        }
        return
      }
      
      // Если selectedNoteId не установлен или отличается, устанавливаем из sessionStorage
      console.log('[Notes] Устанавливаем selectedNoteId из sessionStorage: noteId:', noteId, 'folderId:', folderId, 'текущий selectedNoteId:', selectedNoteId)
      
      // Устанавливаем выбранную заметку сразу
      // Важно: сначала устанавливаем selectedNoteId, чтобы currentNote мог найти заметку в allNotes
      setSelectedNoteIdWithLog(noteId, 'из sessionStorage при навигации')
      // Устанавливаем folderId только если он есть
      if (folderId !== null) {
        setSelectedFolderId(folderId)
      }
      
      // Устанавливаем флаг, что заметка только что открылась из sessionStorage
      // Это предотвратит автоматическое закрытие редактора при навигации
      justOpenedFromStorageRef.current = true
      console.log('[Notes] Установлен флаг justOpenedFromStorageRef для заметки:', noteId)
      
      // Сбрасываем флаг через небольшую задержку, чтобы дать время всем эффектам выполниться
      setTimeout(() => {
        justOpenedFromStorageRef.current = false
        console.log('[Notes] Сброшен флаг justOpenedFromStorageRef')
      }, 1000)
      
      // Очищаем sessionStorage ПОСЛЕ установки состояния, чтобы не потерять данные
      sessionStorage.removeItem('selectedNoteId')
      if (selectedFolderIdStr) {
        sessionStorage.removeItem('selectedFolderId')
      }
    } else if (selectedNoteId !== null) {
      // Если selectedNoteId установлен, но sessionStorage пуст, просто очищаем (на случай остатков)
      // НО НЕ сбрасываем selectedNoteId - он уже установлен и должен остаться
      console.log('[Notes] selectedNoteId установлен, но sessionStorage пуст, очищаем остатки (selectedNoteId остается:', selectedNoteId, ')')
      sessionStorage.removeItem('selectedNoteId')
      sessionStorage.removeItem('selectedFolderId')
    } else {
      console.log('[Notes] sessionStorage пуст и selectedNoteId не установлен')
    }
  }, [location.pathname, location.key, location.state]) // УБИРАЕМ selectedNoteId из зависимостей, чтобы избежать повторных срабатываний

  // Открываем заметку после загрузки данных, если она была установлена из sessionStorage
  useEffect(() => {
    // Проверяем только если мы на странице /notes и есть selectedNoteId
    if (location.pathname !== '/notes' || !selectedNoteId) {
      return
    }
    
    // Если заметка уже найдена (noteToShow), ничего не делаем
    if (noteToShow) {
      console.log('[Notes] Заметка уже найдена в noteToShow:', noteToShow.id)
      return
    }
    
    // Если заметка не найдена в текущих данных, но есть allNotes, ищем там
    if (allNotes) {
      const note = allNotes.find(n => n.id === selectedNoteId)
      if (note) {
        // ВАЖНО: НЕ устанавливаем selectedFolderId при открытии заметки из Dashboard
        // Это может вызывать переключение на папку вместо редактора
        // selectedFolderId будет установлен только если его нет в sessionStorage
        // Заметка будет найдена в noteToShow через allNotes без установки selectedFolderId
        console.log('[Notes] Найдена заметка в allNotes:', note.id, 'folder_id:', note.folder_id, 'selectedFolderId:', selectedFolderId, 'title:', note.title)
        // Заметка будет найдена в noteToShow при следующем рендере
      } else {
        console.log('[Notes] Заметка не найдена в allNotes, selectedNoteId:', selectedNoteId, 'allNotes count:', allNotes.length, 'allNotes IDs:', allNotes.map(n => n.id))
      }
    } else {
      console.log('[Notes] allNotes еще не загружен, ждем... selectedNoteId:', selectedNoteId)
    }
  }, [location.pathname, selectedNoteId, noteToShow, allNotes, selectedFolderId])

  // Создание папки
  const createFolder = useMutation({
    mutationFn: (name: string) => 
      api<Folder>('/api/folders', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] })
      setNewFolderName('')
      setShowNewFolderInput(false)
    },
    onError: async (e) => {
      console.error('Ошибка создания папки:', e)
      await alert('Не удалось создать папку')
    }
  })

  // Удаление папки
  const deleteFolder = useMutation({
    mutationFn: (folderId: number) => 
      api(`/api/folders/${folderId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] })
      qc.invalidateQueries({ queryKey: ['notes'] })
      // Если удалили текущую папку, возвращаемся к списку папок
      if (selectedFolderId !== null) {
        setSelectedFolderId(null)
        setSelectedNoteIdWithLog(null, 'при удалении папки')
      }
    },
    onError: async (e: any) => {
      console.error('Ошибка удаления папки:', e)
      const errorMessage = e?.response?.data?.detail || 'Не удалось удалить папку'
      await alert(errorMessage)
    }
  })

  // Создание заметки
  const createNote = useMutation({
    mutationFn: (payload: { title: string; content?: string | null; tags_text?: string | null; folder_id?: number | null }) => 
      api<Note>('/api/notes', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      // Всегда открываем папку заметки (папка "Все") и показываем созданную заметку
      if (note.folder_id) {
        setSelectedFolderId(note.folder_id)
      }
      setSelectedNoteIdWithLog(note.id, 'при создании заметки в Notes.tsx')
    },
    onError: async (e) => {
      console.error('Ошибка создания заметки:', e)
      await alert('Не удалось создать заметку')
    }
  })

  // Обновление заметки
  const updateNote = useMutation({
    mutationFn: (payload: { id: number; title?: string | null; content?: string | null; tags_text?: string | null; folder_id?: number | null }) => 
      api<Note>(`/api/notes/${payload.id}`, { 
        method: 'PATCH', 
        body: JSON.stringify({ 
          title: payload.title, 
          content: payload.content, 
          tags_text: payload.tags_text,
          folder_id: payload.folder_id
        }) 
      }),
    onSuccess: (updatedNote, variables) => {
      // Обновляем кэш оптимистично, чтобы изменения сразу отображались
      // Используем setQueryData вместо invalidateQueries, чтобы не триггерить лишние запросы
      
      // Функция для обновления массива заметок
      const updateNotesArray = (oldNotes: Note[] | undefined) => {
        if (!oldNotes) return oldNotes
        return oldNotes.map(note => note.id === variables.id ? updatedNote : note)
      }
      
      // Обновляем основной кэш заметок
      qc.setQueryData(['notes'], updateNotesArray)
      
      // Обновляем запросы с фильтрами (если они есть)
      if (selectedFolderId !== null || selectedTagId !== null) {
        qc.setQueryData(['notes', selectedFolderId, selectedTagId], updateNotesArray)
      }
      
      // Также обновляем все возможные варианты кэша заметок
      // Это нужно, чтобы при следующем открытии заметки использовались обновленные данные
      const allCacheKeys = qc.getQueryCache().getAll()
      allCacheKeys.forEach(query => {
        const queryKey = query.queryKey
        // Обновляем все кэши, которые содержат массив заметок
        if (queryKey[0] === 'notes' && Array.isArray(query.state.data)) {
          try {
            qc.setQueryData(queryKey, updateNotesArray)
          } catch (e) {
            // Игнорируем ошибки обновления кэша
          }
        }
      })
      
      // Также обновляем favoriteNote, если это была избранная заметка
      qc.setQueryData(['favoriteNote'], (oldFavorite: Note | null | undefined) => {
        if (!oldFavorite || oldFavorite.id !== variables.id) return oldFavorite
        return updatedNote
      })
    },
    onError: (e) => {
      console.error('Ошибка сохранения заметки:', e)
      // Показываем alert только если это не сетевая ошибка (чтобы не спамить при проблемах с сетью)
      const errorMessage = e instanceof Error ? e.message : String(e)
      if (!errorMessage.includes('подключиться к серверу') && !errorMessage.includes('Failed to fetch')) {
        alert('Не удалось сохранить заметку: ' + errorMessage)
      }
    }
  })

  // Удаление заметки
  const deleteNote = useMutation({
    mutationFn: (noteId: number) => 
      api(`/api/notes/${noteId}`, { method: 'DELETE' }),
    onSuccess: (_, noteId) => {
      // Если удалили избранную заметку, сразу обновляем кэш favoriteNote на null
      qc.setQueryData(['favoriteNote'], (oldFavorite: Note | null | undefined) => {
        if (oldFavorite && oldFavorite.id === noteId) {
          return null
        }
        return oldFavorite
      })
      
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: ['tags'] })
      qc.invalidateQueries({ queryKey: ['favoriteNote'] })
      setSelectedNoteIdWithLog(null, 'при удалении заметки')
    },
    onError: async (e) => {
      console.error('Ошибка удаления заметки:', e)
      await alert('Не удалось удалить заметку')
    }
  })

  // Переключение избранного
  const toggleFavorite = useMutation({
    mutationFn: (noteId: number) => 
      api<Note>(`/api/notes/${noteId}/favorite`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: ['favoriteNote'] })
    },
    onError: async (e) => {
      console.error('Ошибка изменения избранного:', e)
      await alert('Не удалось изменить избранное')
    }
  })

  // Мутации для работы с дедлайнами
  const createDeadlineMutation = useMutation({
    mutationFn: (data: { noteId: number; deadlineAt: string }) =>
      createDeadline(data.noteId, data.deadlineAt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deadline', selectedNoteId] })
      // Обновляем список заметок, чтобы обновить иконку колокольчика
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
    onError: async (e) => {
      console.error('Ошибка создания дедлайна:', e)
      const errorMessage = e instanceof Error ? e.message : String(e)
      await alert('Не удалось создать дедлайн: ' + errorMessage)
    }
  })

  const updateDeadlineMutation = useMutation({
    mutationFn: (data: { noteId: number; deadlineAt?: string; notification_enabled?: boolean }) =>
      updateDeadline(data.noteId, { deadline_at: data.deadlineAt, notification_enabled: data.notification_enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deadline', selectedNoteId] })
      // Обновляем список заметок, чтобы обновить иконку колокольчика
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
    onError: async (e) => {
      console.error('Ошибка обновления дедлайна:', e)
      const errorMessage = e instanceof Error ? e.message : String(e)
      await alert('Не удалось обновить дедлайн: ' + errorMessage)
    }
  })

  const deleteDeadlineMutation = useMutation({
    mutationFn: (noteId: number) => deleteDeadline(noteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deadline', selectedNoteId] })
      // Обновляем список заметок, чтобы скрыть иконку колокольчика
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
    onError: async (e) => {
      console.error('Ошибка удаления дедлайна:', e)
      await alert('Не удалось удалить дедлайн')
    }
  })

  const toggleDeadlineNotificationsMutation = useMutation({
    mutationFn: (noteId: number) => toggleDeadlineNotifications(noteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deadline', selectedNoteId] })
      // Обновляем список заметок, чтобы обновить иконку колокольчика
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
    onError: async (e) => {
      console.error('Ошибка переключения уведомлений:', e)
      await alert('Не удалось переключить уведомления')
    }
  })

  const testDeadlineNotificationMutation = useMutation({
    mutationFn: (noteId: number) => testDeadlineNotification(noteId),
    onSuccess: async (data) => {
      await alert(data.message || 'Тестовое уведомление отправлено')
    },
    onError: async (e) => {
      console.error('Ошибка отправки тестового уведомления:', e)
      const errorMessage = e instanceof Error ? e.message : String(e)
      await alert('Не удалось отправить тестовое уведомление: ' + errorMessage)
    }
  })

  // Обработчик клика на кнопку избранного
  const handleToggleFavorite = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation()
    
    // Если заметка уже в избранном, просто снимаем её (без подтверждения)
    if (note.is_favorite) {
      toggleFavorite.mutate(note.id)
      return
    }
    
    // Ищем текущую избранную заметку в списке всех заметок
    const existingFavorite = allNotes?.find(n => n.is_favorite && n.id !== note.id)
    
    // Если есть другая избранная заметка, показываем диалог подтверждения
    if (existingFavorite) {
      const currentTitle = existingFavorite.title || 'Без названия'
      const newTitle = note.title || 'Без названия'
      
      confirm(
        `В избранном уже есть заметка "${currentTitle}".\n\n` +
        `Заменить её на заметку "${newTitle}"?\n\n` +
        `Текущая избранная заметка будет удалена из избранного.`
      ).then((result) => {
        if (result) {
          toggleFavorite.mutate(note.id)
        }
      })
    } else {
      // Если нет избранной заметки, просто добавляем
      toggleFavorite.mutate(note.id)
    }
  }

  // Функция для проверки, является ли заметка todo-листом
  const isTodoNote = (content: string | null | undefined): boolean => {
    if (!content) return false
    try {
      const parsed = JSON.parse(content)
      return parsed.type === 'todo' && Array.isArray(parsed.items)
    } catch {
      return false
    }
  }

  // Вычисляем максимальную высоту для расширенного блока поиска (расширение вверх)
  useEffect(() => {
    const calculateMaxHeight = () => {
      if (searchPillRef.current && topElementRef.current && (isSearchFocused || searchQuery.trim())) {
        const searchRect = searchPillRef.current.getBoundingClientRect()
        const topRect = topElementRef.current.getBoundingClientRect()
        
        // Вычисляем расстояние от нижнего края блока поиска до верхнего края topElement
        // gap = 16px (отступ между элементами)
        const gap = 16
        const distance = searchRect.top - topRect.top
        
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

  // Восстанавливаем фокус после изменения searchQuery, если input был в фокусе
  useEffect(() => {
    if (isSearchFocused && searchInputRef.current && document.activeElement !== searchInputRef.current) {
      // Восстанавливаем фокус только если он был потерян
      const timeoutId = setTimeout(() => {
        searchInputRef.current?.focus()
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [searchQuery, isSearchFocused])

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder.mutate(newFolderName.trim())
    }
  }

  const handleCreateNote = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    let folderId: number | null = null
    
    // Если открыта конкретная папка, создаем заметку в этой папке
    // Иначе создаем в папке "Все"
    if (selectedFolderId !== null) {
      folderId = selectedFolderId
    } else {
      // Если открыта страница со списком папок, создаем в папке "Все"
      folderId = folders?.find(f => f.is_default)?.id || folders?.[0]?.id || null
    }
    
    if (!folderId) {
      alert('Сначала создайте папку')
      return
    }
    console.log('Creating note with folderId:', folderId)
    createNote.mutate({ 
      title: 'Нет названия', 
      content: '', 
      tags_text: null,
      folder_id: folderId
    })
  }

  // Храним selectedFolderId в ref для использования в обработчике создания заметки
  const selectedFolderIdRef = useRef<number | null>(null)
  useEffect(() => {
    selectedFolderIdRef.current = selectedFolderId
  }, [selectedFolderId])

  // Храним createNote и folders в ref для избежания бесконечных циклов
  const createNoteDataRef = useRef<{
    createNote: typeof createNote
    folders: Folder[] | undefined
  }>({
    createNote,
    folders
  })
  
  // Обновляем ref при изменении данных (без триггеринга useEffect)
  useEffect(() => {
    createNoteDataRef.current = {
      createNote,
      folders
    }
  }, [createNote, folders])

  // Регистрируем обработчик создания заметки в контексте
  // Используем ref для избежания бесконечных циклов при изменении зависимостей
  useEffect(() => {
    setHandleCreateNote(() => () => {
      const data = createNoteDataRef.current
      // Используем текущий selectedFolderId из ref
      let folderId: number | null = null
      
      // Если открыта конкретная папка, создаем заметку в этой папке
      // Иначе создаем в папке "Все"
      if (selectedFolderIdRef.current !== null) {
        folderId = selectedFolderIdRef.current
      } else {
        // Если открыта страница со списком папок, создаем в папке "Все"
        folderId = data.folders?.find(f => f.is_default)?.id || data.folders?.[0]?.id || null
      }
      
      if (!folderId) {
        alert('Сначала создайте папку')
        return
      }
      data.createNote.mutate({ 
        title: 'Нет названия', 
        content: '', 
        tags_text: null,
        folder_id: folderId
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHandleCreateNote]) // Только setHandleCreateNote, остальное через ref

  // Регистрируем обработчик сохранения заметки в контексте
  // Используем useRef для хранения актуальных значений без триггеринга useEffect
  const saveNoteDataRef = useRef<{
    selectedNoteId: number | null
    isTodoMode: boolean
    todoItems: TodoItem[]
    content: string
    title: string
    tagsText: string
    updateNote: typeof updateNote
    setShowSaveNotification: (show: boolean) => void
    }>({
      selectedNoteId: null,
      isTodoMode: false,
      todoItems: [],
      content: '',
      title: '',
      tagsText: '',
      updateNote,
      setShowSaveNotification: () => {}
    })
  
  // Ref для хранения актуальных значений состояния при закрытии редактора
  const closeEditorDataRef = useRef<{
    selectedFolderId: number | null
    previousView: 'folders' | 'folder' | 'search' | 'tag' | null
    setSelectedFolderId: (id: number | null) => void
    setSearchQuery: (query: string) => void
    setSelectedTagId: (id: number | null) => void
  }>({
    selectedFolderId: null,
    previousView: null,
    setSelectedFolderId,
    setSearchQuery,
    setSelectedTagId
  })
  
  // Обновляем ref при изменении данных (без триггеринга useEffect)
  useEffect(() => {
    console.log('[Notes] useEffect saveNoteDataRef: обновляем данные для сохранения:', {
      selectedNoteId,
      title,
      contentLength: content?.length || 0,
      tagsText,
      isTodoMode,
      todoItemsCount: todoItems.length,
      updateNoteType: typeof updateNote
    })
    saveNoteDataRef.current = {
      selectedNoteId,
      isTodoMode,
      todoItems,
      content,
      title,
      tagsText,
      updateNote,
      setShowSaveNotification // Добавляем функцию для показа уведомления
    }
  }, [selectedNoteId, isTodoMode, todoItems, content, title, tagsText, updateNote, setShowSaveNotification])

  // Обновляем ref для закрытия редактора
  useEffect(() => {
    closeEditorDataRef.current = {
      selectedFolderId,
      previousView,
      setSelectedFolderId,
      setSearchQuery,
      setSelectedTagId
    }
  }, [selectedFolderId, previousView, setSearchQuery, setSelectedTagId])
  
  // Функция сохранения заметки БЕЗ закрытия редактора
  // Используется для сохранения перед навигацией
  // ВАЖНО: Использует данные из ref, чтобы функция была стабильной и не пересоздавалась
  const saveNoteOnlyRef = useRef<() => Promise<void>>()
  const isSavingNoteRef = useRef(false) // Защита от множественных вызовов
  
  // Обновляем функцию сохранения (без пересоздания функции)
  // ВАЖНО: Обновляем ref только если данные изменились, чтобы избежать лишних операций
  useEffect(() => {
    saveNoteOnlyRef.current = async () => {
      console.log('[Notes] saveNoteOnlyRef.current: НАЧИНАЕМ СОХРАНЕНИЕ')
      
      // Защита от множественных вызовов
      if (isSavingNoteRef.current) {
        console.log('[Notes] saveNoteOnlyRef.current: уже сохраняется, пропускаем')
        return
      }
      
      isSavingNoteRef.current = true
      
      try {
        const data = saveNoteDataRef.current
        
        console.log('[Notes] saveNoteOnlyRef.current: data =', data)
        
        if (!data.selectedNoteId) {
          console.log('[Notes] saveNoteOnlyRef.current: нет selectedNoteId, выходим')
          return
        }
        
        if (!data.updateNote || !data.updateNote.mutateAsync) {
          console.log('[Notes] saveNoteOnlyRef.current: нет updateNote.mutateAsync, выходим')
          return
        }
        
        console.log('[Notes] saveNoteOnlyRef.current: начинаем отправку PATCH запроса')
        
        // Консистентная логика сохранения (та же, что в handleBack)
        const finalTitle = data.title.trim() || 'Нет названия'
        let contentToSave: string | null = null
        
        if (data.isTodoMode) {
          contentToSave = serializeTodoData(data.todoItems && data.todoItems.length > 0 ? data.todoItems : [{ id: Date.now(), text: '', completed: false }])
        } else {
          contentToSave = (data.content && data.content.trim()) ? data.content.trim() : null
        }
        
        console.log('[Notes] saveNoteOnlyRef.current: вызываем mutateAsync с данными:', { 
          id: data.selectedNoteId, 
          title: finalTitle, 
          contentLength: contentToSave?.length || 0, 
          tags_text: data.tagsText.trim() 
        })
        
        await data.updateNote.mutateAsync({ 
          id: data.selectedNoteId, 
          title: finalTitle, 
          content: contentToSave, 
          tags_text: data.tagsText.trim() 
        })
        
        console.log('[Notes] saveNoteOnlyRef.current: mutateAsync завершено УСПЕШНО')
      } catch (saveError) {
        console.error('[Notes] saveNoteOnlyRef.current: ошибка при сохранении', saveError)
        throw saveError
      } finally {
        // Сбрасываем флаг после завершения
        setTimeout(() => {
          isSavingNoteRef.current = false
        }, 100)
      }
    }
  }, []) // Пустой массив - функция использует только ref
  
  // Создаем стабильную обертку, которая не пересоздается
  const stableSaveNoteOnly = useCallback(async () => {
    console.log('[Notes] stableSaveNoteOnly: вызвана, saveNoteOnlyRef.current =', typeof saveNoteOnlyRef.current)
    if (saveNoteOnlyRef.current) {
      console.log('[Notes] stableSaveNoteOnly: вызываем saveNoteOnlyRef.current()')
      const result = await saveNoteOnlyRef.current()
      console.log('[Notes] stableSaveNoteOnly: saveNoteOnlyRef.current() завершено')
      return result
    } else {
      console.log('[Notes] stableSaveNoteOnly: saveNoteOnlyRef.current = null или undefined!')
    }
  }, []) // Пустой массив зависимостей - функция стабильна
  
  // Регистрируем стабильную функцию сохранения в контексте ОДИН РАЗ
  useEffect(() => {
    console.log('[Notes] useEffect: регистрируем stableSaveNoteOnly в контексте')
    setHandleSaveNote(stableSaveNoteOnly)
    console.log('[Notes] useEffect: stableSaveNoteOnly зарегистрирована')
    
    // ТАКЖЕ устанавливаем глобальный ref для прямого доступа из App.tsx
    if (saveNoteOnlyRef.current) {
      saveNoteRefGlobal.current = saveNoteOnlyRef.current
      console.log('[Notes] useEffect: saveNoteRefGlobal установлен')
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Регистрируем только один раз при монтировании

  // Создаем стабильную функцию закрытия редактора через ref
  const closeNoteEditorInternalRef = useRef<(forceShowAllNotes?: boolean) => Promise<void>>()
  const isClosingEditorRef = useRef(false) // Защита от множественных вызовов
  
  // Обновляем функцию закрытия редактора (без пересоздания функции)
  // ВАЖНО: Обновляем ref только один раз, функция использует только ref
  useEffect(() => {
    closeNoteEditorInternalRef.current = async (forceShowAllNotes = false) => {
      // Защита от множественных вызовов
      if (isClosingEditorRef.current) {
        return
      }
      
      isClosingEditorRef.current = true
      
      try {
        // Сохраняем заметку перед закрытием (та же логика, что в handleBack)
        const saveData = saveNoteDataRef.current
        
        // ВАЖНО: ВСЕГДА сохраняем заметку, даже если justOpenedFromStorageRef.current === true
        // Просто не закрываем редактор в этом случае
        if (saveData.selectedNoteId && saveData.updateNote && saveData.updateNote.mutateAsync) {
          try {
            // Консистентная логика сохранения (та же, что в handleBack)
            const finalTitle = saveData.title.trim() || 'Нет названия'
            let contentToSave: string | null = null
            
            if (saveData.isTodoMode) {
              contentToSave = serializeTodoData(saveData.todoItems && saveData.todoItems.length > 0 ? saveData.todoItems : [{ id: Date.now(), text: '', completed: false }])
            } else {
              contentToSave = (saveData.content && saveData.content.trim()) ? saveData.content.trim() : null
            }
            
            await saveData.updateNote.mutateAsync({ 
              id: saveData.selectedNoteId, 
              title: finalTitle, 
              content: contentToSave, 
              tags_text: saveData.tagsText.trim() 
            })
          } catch (saveError) {
            console.error('[Notes] closeNoteEditor: ошибка при сохранении', saveError)
          }
        }
        
        // ВАЖНО: Если заметка только что открылась из sessionStorage, НЕ закрываем редактор
        const shouldCloseEditor = !justOpenedFromStorageRef.current
        
        if (!shouldCloseEditor) {
          return
        }
        
        // Закрываем редактор только если shouldCloseEditor = true
        const data = closeEditorDataRef.current
        // Закрываем редактор, сбрасывая selectedNoteId
        setSelectedNoteIdWithLog(null, 'через closeNoteEditor')
        
        // Если forceShowAllNotes = true, всегда показываем список всех заметок
        if (forceShowAllNotes) {
          data.setSelectedFolderId(null)
          data.setSearchQuery('')
          data.setSelectedTagId(null)
          return
        }
        
        // Восстанавливаем предыдущий вид на основе актуальных данных из ref
        // Приоритет: если открыта папка (selectedFolderId !== null), остаемся в ней
        if (data.selectedFolderId !== null) {
          // Остаемся в папке - ничего не меняем, просто закрываем редактор
          return
        }
        // Если папка не открыта, проверяем previousView
        if (data.previousView === 'folders') {
          // Возвращаемся к списку всех папок
          data.setSelectedFolderId(null)
          data.setSearchQuery('')
          data.setSelectedTagId(null)
        } else if (data.previousView === 'search' || data.previousView === 'tag') {
          // Возвращаемся к поиску/тегу
          data.setSelectedFolderId(null)
          data.setSearchQuery('')
          data.setSelectedTagId(null)
        } else {
          // Если previousView не установлен, возвращаемся к списку папок
          data.setSelectedFolderId(null)
          data.setSearchQuery('')
          data.setSelectedTagId(null)
        }
      } finally {
        // Сбрасываем флаг после завершения
        setTimeout(() => {
          isClosingEditorRef.current = false
        }, 100)
      }
    }
  }, []) // Пустой массив - функция использует только ref
  
  // Создаем стабильную обертку для closeNoteEditor
  const stableCloseNoteEditor = useCallback(async (forceShowAllNotes = false) => {
    if (closeNoteEditorInternalRef.current) {
      return await closeNoteEditorInternalRef.current(forceShowAllNotes)
    }
  }, []) // Пустой массив зависимостей - функция стабильна
  
  // Регистрируем стабильную функцию закрытия редактора в контексте ОДИН РАЗ
  useEffect(() => {
    setCloseNoteEditor(stableCloseNoteEditor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Регистрируем только один раз при монтировании


  const handleSave = () => {
    if (!selectedNoteId) return
    // ВАЖНО: Консистентная логика сохранения
    // Если isTodoMode === true, ВСЕГДА сохраняем как todo (даже если items пустые)
    const contentToSave = isTodoMode 
      ? serializeTodoData(todoItems && todoItems.length > 0 ? todoItems : [{ id: Date.now(), text: '', completed: false }])
      : (content && content.trim() ? content.trim() : null)
    updateNote.mutate({ 
      id: selectedNoteId, 
      title: title.trim() || 'Нет названия', 
      content: contentToSave, 
      tags_text: tagsText.trim() 
    })
  }

  const handleDelete = async (e: React.MouseEvent | React.TouchEvent, noteId: number) => {
    e.stopPropagation()
    const result = await confirm('Вы уверены, что хотите удалить эту заметку?')
    if (result) {
      deleteNote.mutate(noteId)
    }
  }

  const handleBack = async () => {
    try {
      if (selectedNoteId) {
        // Сохраняем заметку перед выходом
        // Используем данные напрямую из состояния, чтобы гарантировать актуальность
        console.log('[Notes] handleBack: текущее состояние перед сохранением', {
          selectedNoteId,
          isTodoMode,
          content,
          todoItems: todoItems.length,
          title
        })
        
        // Сохраняем напрямую, используя актуальные данные из состояния
        const finalTitle = title.trim() || 'Нет названия'
        
        // ВАЖНО: Логика сохранения должна быть консистентной во всех местах
        // Если isTodoMode === true, ВСЕГДА сохраняем как todo (даже если items пустые)
        // Если isTodoMode === false, сохраняем как обычную заметку
        let contentToSave: string | null = null
        
        if (isTodoMode) {
          // Режим todo - сериализуем todoItems (даже если они пустые)
          // Это важно, чтобы при переоткрытии заметка правильно распознавалась как todo
          contentToSave = serializeTodoData(todoItems && todoItems.length > 0 ? todoItems : [{ id: Date.now(), text: '', completed: false }])
        } else {
          // Обычная заметка - используем content
          // Если content пустой или только пробелы - сохраняем null
          contentToSave = (content && content.trim()) ? content.trim() : null
        }
        
        console.log('[Notes] handleBack: сохраняем заметку напрямую', {
          id: selectedNoteId,
          title: finalTitle,
          content: contentToSave,
          isTodoMode,
          contentLength: content?.length || 0,
          todoItemsCount: todoItems.length,
          tagsText: tagsText.trim()
        })
        
        try {
          await updateNote.mutateAsync({ 
            id: selectedNoteId, 
            title: finalTitle, 
            content: contentToSave, 
            tags_text: tagsText.trim() 
          })
          console.log('[Notes] handleBack: заметка сохранена успешно')
        } catch (saveError) {
          console.error('[Notes] handleBack: ошибка при сохранении', saveError)
          // Продолжаем выполнение даже при ошибке сохранения
        }
        
        // Закрываем редактор независимо от того, была ли заметка сохранена
        setSelectedNoteIdWithLog(null, 'в handleBack после сохранения')
        // Восстанавливаем предыдущий вид
        if (previousView === 'folder' && selectedFolderId !== null) {
          // Остаемся в папке
        } else if (previousView === 'folders') {
          setSelectedFolderId(null)
          setSearchQuery('')
          setSelectedTagId(null)
        } else if (previousView === 'search' || previousView === 'tag') {
          setSelectedFolderId(null)
          setSearchQuery('')
          setSelectedTagId(null)
        }
      } else if (selectedFolderId) {
        setSelectedFolderId(null)
        setSearchQuery('')
        setSelectedTagId(null)
      }
    } catch (error) {
      console.error('[Notes] handleBack: ошибка при сохранении/выходе', error)
      // Даже при ошибке закрываем редактор, чтобы пользователь не застрял
      setSelectedNoteIdWithLog(null, 'в handleBack при ошибке')
    }
  }

  const handleMoveToFolder = (folderId: number) => {
    if (!selectedNoteId) return
    updateNote.mutate({ 
      id: selectedNoteId, 
      folder_id: folderId
    })
    setShowFolderSelect(false)
  }

  // Если выбран тег, показываем список заметок с этим тегом
  if (selectedTagId && !selectedFolderId && !selectedNoteId) {
    const tagName = allTags?.find(t => t.id === selectedTagId)?.name || availableTags.find(t => t.id === selectedTagId)?.name || 'неизвестно'
    return (
      <div className="notes-folders-view">
        <div className="notes-folders-header">
          <button 
            className="notes-back-button" 
            onClick={() => {
              setSearchParams({})
              setSelectedTagId(null)
            }}
          >
            ←
          </button>
          <h1 className="notes-folders-title">
            Тег: {tagName}
          </h1>
        </div>
        
        <div style={{ padding: '0 16px' }}>
          {notesLoading ? (
            <div className="notes-empty">Загрузка...</div>
          ) : (
            <>
              {filteredNotes && filteredNotes.length > 0 ? (
                filteredNotes.map(note => (
                  <div 
                    key={note.id} 
                    className="notes-folder-item"
                    onClick={() => {
                      // Находим папку заметки и открываем её
                      const noteFolder = folders?.find(f => f.id === note.folder_id)
                      if (noteFolder) {
                        setSelectedFolderId(noteFolder.id)
                        setSelectedNoteIdWithLog(note.id, 'при создании заметки в Notes.tsx')
                        // Очищаем параметр тега из URL
                        setSearchParams({})
                      }
                    }}
                    style={{ marginBottom: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div className="notes-folder-item-title" style={{ flex: 1 }}>
                          {note.title || 'Нет названия'}
                        </div>
                        {note.folder_id && folders && (
                          <div className="notes-folder-badge">
                            <FolderIcon width={14} height={14} />
                            <span>{folders.find(f => f.id === note.folder_id)?.name || 'Неизвестная папка'}</span>
                          </div>
                        )}
                      </div>
                      {note.content && (
                        <div className="notes-folder-item-preview">
                          {formatNotePreview(note.content, 50)}
                        </div>
                      )}
                      {note.tags && note.tags.length > 0 && (
                        <div className="notes-tags-list">
                          {note.tags.map(tag => {
                            // Если тег "учеба", используем желтый цвет
                            const tagColor = tag.name.toLowerCase() === 'учеба' ? '#FFC300' : (tag.color || 'var(--fg-secondary)')
                            return (
                              <span key={tag.id} className="notes-tag-item" style={{ color: tagColor }}>
                                #{tag.name}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      {isTodoNote(note.content) && note.has_deadline_notifications && (
                        <button 
                          className="inner-nav-item"
                          style={{ cursor: 'default', pointerEvents: 'none' }}
                          title="Уведомления о дедлайне включены"
                        >
                          <BellIcon isActive={true} width={18} height={18} />
                        </button>
                      )}
                      {isTodoNote(note.content) && (
                        <button 
                          className={`inner-nav-item ${note.is_favorite ? 'active' : ''}`}
                          onClick={(e) => handleToggleFavorite(e, note)}
                          title={note.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                        >
                          <StarIcon isActive={note.is_favorite || false} />
                        </button>
                      )}
                      <button 
                        className="inner-nav-item" 
                        onClick={(e) => handleDelete(e, note.id)}
                        title="Удалить заметку"
                      >
                        <TrashIcon width={18} height={18} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="notes-empty">
                  Нет заметок с этим тегом
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // Если выбрана заметка - показываем редактор (проверяем ПЕРВЫМ, чтобы не показывать список папок)
  // noteToShow уже определен выше
  // Если есть selectedNoteId, но заметка еще не найдена и allNotes загружается, ждем
  // ВАЖНО: эта проверка должна быть ПЕРВОЙ, чтобы список папок никогда не показывался, если есть selectedNoteId
  
  // Логируем состояние в начале рендера для отладки
  console.log('[Notes] Рендер: selectedNoteId:', selectedNoteId, 'selectedFolderId:', selectedFolderId, 'noteToShow:', noteToShow?.id || 'null', 'allNotes count:', allNotes?.length || 0)
  
  if (selectedNoteId) {
    console.log('[Notes] selectedNoteId есть:', selectedNoteId, 'noteToShow:', noteToShow?.id || 'null', 'allNotesLoading:', allNotesLoading, 'allNotes IDs:', allNotes?.map(n => n.id) || [])
    // Если заметка найдена - показываем редактор
    if (noteToShow) {
      console.log('[Notes] Показываем редактор для заметки:', noteToShow.id, 'title:', noteToShow.title)
      return (
      <>
        <div className="notes-editor-new">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '16px' }}>
            <button 
              className="notes-back-button" 
              onClick={handleBack}
            >
              ←
            </button>
            {isNoteTodo && deadline && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ 
                  color: deadline.status === 'overdue' ? '#ff6b6b' : deadline.status === 'today' ? '#ffa500' : 'rgba(255, 255, 255, 0.9)',
                  fontSize: '14px',
                  fontWeight: 500,
                  flex: 1
                }}>
                  {deadline.time_remaining_text}
                </div>
                <button
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (selectedNoteId) {
                      const result = await confirm('Удалить дедлайн?')
                      if (result) {
                        deleteDeadlineMutation.mutate(selectedNoteId)
                      }
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255, 255, 255, 0.5)',
                    transition: 'color 0.2s'
                  }}
                  title="Удалить дедлайн"
                >
                  <TrashIcon width={18} height={18} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (selectedNoteId) {
                      toggleDeadlineNotificationsMutation.mutate(selectedNoteId)
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: deadline.notification_enabled ? '#4a90e2' : 'rgba(255, 255, 255, 0.5)',
                    transition: 'color 0.2s'
                  }}
                  title={deadline.notification_enabled ? "Отключить уведомления" : "Включить уведомления"}
                >
                  <BellIcon width={20} height={20} isActive={deadline.notification_enabled} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (selectedNoteId) {
                      testDeadlineNotificationMutation.mutate(selectedNoteId)
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255, 255, 255, 0.5)',
                    transition: 'color 0.2s',
                    opacity: testDeadlineNotificationMutation.isPending ? 0.5 : 1
                  }}
                  title="Отправить тестовое уведомление"
                  disabled={testDeadlineNotificationMutation.isPending}
                >
                  <svg 
                    width="18" 
                    height="18" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ stroke: 'currentColor' }}
                  >
                    <path 
                      d="M22 2L11 13" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                    <path 
                      d="M22 2L15 22L11 13L2 9L22 2Z" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
          <div className="note-title-input-wrapper">
            <div className="note-title-input__light"></div>
            <input 
              className="note-title-input" 
              placeholder="Введите заголовок" 
              value={title} 
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          
          <div className="note-tags-input-wrapper">
            <input
              type="text"
              className="note-tags-input"
              placeholder="Введите тег (например: #для_самореализации)"
              value={tagsText}
              onChange={e => setTagsText(e.target.value)}
              list="tag-suggestions-notes"
            />
          </div>
          <datalist id="tag-suggestions-notes">
            {allAvailableTags.map(tag => (
              <option key={tag.id} value={`#${tag.name}`} />
            ))}
          </datalist>
          
          {isTodoMode ? (
            <TodoList 
              items={todoItems} 
              onChange={setTodoItems}
              onConfirmDelete={confirm}
            />
          ) : (
            <textarea 
              className="note-content-input" 
              placeholder="Начните писать вашу заметку" 
              value={content} 
              onChange={e => setContent(e.target.value)}
              style={{ position: 'relative', zIndex: 2 }}
            />
          )}
        </div>
        <div className="notes-inner-nav" data-mobile-nav>
          <div className="notes-inner-nav-left">
            <button 
              className={`inner-nav-item ${isTodoMode ? 'active' : ''}`}
              title={isTodoMode ? "Преобразовать в заметку" : "Todo лист"}
              onClick={async () => {
                if (!isTodoMode) {
                  // Преобразуем обычную заметку в todo лист
                  // Проверяем, есть ли контент в заметке
                  const hasContent = content && content.trim().length > 0
                  
                  if (hasContent) {
                    // Показываем предупреждение, если заметка не пустая
                    const result = await confirm('Внимание! При преобразовании в todo лист текущее содержимое заметки будет удалено. Продолжить?')
                    if (!result) {
                      return
                    }
                  }
                  
                  // Преобразуем заметку в todo лист
                  const newItems: TodoItem[] = [{ id: Date.now(), text: '', completed: false }]
                  const todoContent = serializeTodoData(newItems)
                  
                  // Обновляем состояние
                  setTodoItems(newItems)
                  setIsTodoMode(true)
                  setContent('') // Очищаем content
                  
                  // Обновляем ref сразу, чтобы handleSaveNote использовал актуальные данные
                  saveNoteDataRef.current = {
                    ...saveNoteDataRef.current,
                    isTodoMode: true,
                    todoItems: newItems,
                    content: '', // Очищаем content при преобразовании в todo
                    title: title, // Сохраняем текущий title
                    tagsText: tagsText, // Сохраняем текущие теги
                    setShowSaveNotification // Сохраняем функцию
                  }
                  
                  console.log('[Notes] Преобразование заметки в todo: обновлен saveNoteDataRef', {
                    isTodoMode: saveNoteDataRef.current.isTodoMode,
                    todoItems: saveNoteDataRef.current.todoItems.length,
                    selectedNoteId
                  })
                  
                  // ПРИНУДИТЕЛЬНОЕ сохранение преобразования на сервер немедленно
                  if (selectedNoteId) {
                    console.log('[Notes] ПРИНУДИТЕЛЬНОЕ сохранение преобразования заметки в todo на сервер', {
                      id: selectedNoteId,
                      title: title.trim() || 'Нет названия',
                      content: todoContent,
                      tagsText: tagsText.trim(),
                      isTodoMode: true,
                      todoItemsCount: newItems.length
                    })
                    try {
                      const savedNote = await updateNote.mutateAsync({ 
                        id: selectedNoteId, 
                        title: title.trim() || 'Нет названия', 
                        content: todoContent, 
                        tags_text: tagsText.trim() 
                      })
                      console.log('[Notes] Преобразование заметки в todo сохранено на сервер успешно', savedNote)
                      
                      // Обновляем кэш после сохранения
                      qc.setQueryData(['note', selectedNoteId], savedNote)
                      // Обновляем allNotes в кэше (ключ ['notes'])
                      qc.setQueryData(['notes'], (old: any) => {
                        if (!old) return old
                        return old.map((n: any) => n.id === selectedNoteId ? savedNote : n)
                      })
                      qc.invalidateQueries({ queryKey: ['notes'] })
                      
                      // Сбрасываем lastLoadedNoteIdRef, чтобы заметка перезагрузилась с новыми данными
                      lastLoadedNoteIdRef.current = null
                      
                      // ПРИНУДИТЕЛЬНО обновляем состояние из savedNote, чтобы parseTodoData правильно распознал todo
                      const { isTodo, items } = parseTodoData(savedNote.content)
                      if (isTodo) {
                        setIsTodoMode(true)
                        setTodoItems(items.length > 0 ? items : [{ id: Date.now(), text: '', completed: false }])
                        setContent('')
                        console.log('[Notes] Состояние принудительно обновлено после преобразования в todo', { isTodo, itemsCount: items.length })
                      }
                      
                      console.log('[Notes] Кэш обновлен, lastLoadedNoteIdRef сброшен после преобразования в todo')
                    } catch (error) {
                      console.error('[Notes] Ошибка при сохранении преобразования заметки в todo:', error)
                      throw error // Пробрасываем ошибку дальше
                    }
                  }
                } else {
                  // Преобразуем todo лист обратно в обычную заметку
                  // Проверяем, есть ли выполненные или невыполненные пункты
                  const hasItems = todoItems.some(item => item.text.trim().length > 0)
                  
                  if (hasItems) {
                    // Показываем предупреждение, если есть пункты в todo
                    const result = await confirm('Внимание! При преобразовании todo листа в обычную заметку все пункты будут удалены. Продолжить?')
                    if (!result) {
                      return
                    }
                  }
                  
                  // Преобразуем todo лист в обычную заметку
                  const noteContent: string | null = null // Пустая заметка
                  
                  // Обновляем состояние
                  setContent('')
                  setTodoItems([])
                  setIsTodoMode(false)
                  
                  // Обновляем ref сразу, чтобы handleSaveNote использовал актуальные данные
                  saveNoteDataRef.current = {
                    ...saveNoteDataRef.current,
                    isTodoMode: false,
                    todoItems: [],
                    content: '', // Очищаем content при преобразовании в заметку
                    title: title, // Сохраняем текущий title
                    tagsText: tagsText, // Сохраняем текущие теги
                    setShowSaveNotification // Сохраняем функцию
                  }
                  
                  console.log('[Notes] Преобразование todo в заметку: обновлен saveNoteDataRef', {
                    isTodoMode: saveNoteDataRef.current.isTodoMode,
                    content: saveNoteDataRef.current.content,
                    selectedNoteId
                  })
                  
                  // ПРИНУДИТЕЛЬНОЕ сохранение преобразования на сервер немедленно
                  if (selectedNoteId) {
                    console.log('[Notes] ПРИНУДИТЕЛЬНОЕ сохранение преобразования todo в заметку на сервер', {
                      id: selectedNoteId,
                      title: title.trim() || 'Нет названия',
                      content: noteContent,
                      tagsText: tagsText.trim(),
                      isTodoMode: false,
                      todoItemsCount: 0
                    })
                    try {
                      const savedNote = await updateNote.mutateAsync({ 
                        id: selectedNoteId, 
                        title: title.trim() || 'Нет названия', 
                        content: noteContent, // Пустая заметка
                        tags_text: tagsText.trim() 
                      })
                      console.log('[Notes] Преобразование todo в заметку сохранено на сервер успешно', savedNote)
                      
                      // Обновляем кэш после сохранения
                      qc.setQueryData(['note', selectedNoteId], savedNote)
                      // Обновляем allNotes в кэше (ключ ['notes'])
                      qc.setQueryData(['notes'], (old: any) => {
                        if (!old) return old
                        return old.map((n: any) => n.id === selectedNoteId ? savedNote : n)
                      })
                      qc.invalidateQueries({ queryKey: ['notes'] })
                      
                      // Сбрасываем lastLoadedNoteIdRef, чтобы заметка перезагрузилась с новыми данными
                      lastLoadedNoteIdRef.current = null
                      
                      // ПРИНУДИТЕЛЬНО обновляем состояние из savedNote, чтобы parseTodoData правильно распознал обычную заметку
                      const { isTodo } = parseTodoData(savedNote.content)
                      if (!isTodo) {
                        setIsTodoMode(false)
                        setContent(savedNote.content || '')
                        setTodoItems([])
                        console.log('[Notes] Состояние принудительно обновлено после преобразования в заметку', { isTodo, content: savedNote.content })
                      }
                      
                      console.log('[Notes] Кэш обновлен, lastLoadedNoteIdRef сброшен после преобразования в заметку')
                    } catch (error) {
                      console.error('[Notes] Ошибка при сохранении преобразования todo в заметку:', error)
                      throw error // Пробрасываем ошибку дальше
                    }
                  }
                }
              }}
            >
              <span className="inner-nav-icon">
                <svg width="24" height="24" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6L6 8L10 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="4" y1="10" x2="16" y2="10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="4" y1="13" x2="16" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="4" y1="16" x2="16" y2="16" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
            </button>
            <button 
              className="inner-nav-item active" 
              onClick={(e) => {
                e.stopPropagation()
                setShowFolderSelect(!showFolderSelect)
              }}
            >
              <span className="inner-nav-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 6C3 5.44772 3.44772 5 4 5H8L10 7H16C16.5523 7 17 7.44772 17 8V15C17 15.5523 16.5523 16 16 16H4C3.44772 16 3 15.5523 3 15V6Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </span>
            </button>
            {isNoteTodo && (
              <button
                className="inner-nav-item"
                onClick={async (e) => {
                  e.stopPropagation()
                  
                  // ВАЖНО: Сохраняем заметку перед созданием дедлайна, чтобы избежать ошибок
                  if (selectedNoteId) {
                    try {
                      // Сохраняем заметку как todo перед созданием дедлайна
                      const contentToSave = isTodoMode 
                        ? serializeTodoData(todoItems && todoItems.length > 0 ? todoItems : [{ id: Date.now(), text: '', completed: false }])
                        : (content && content.trim() ? content.trim() : null)
                      
                      await updateNote.mutateAsync({ 
                        id: selectedNoteId, 
                        title: title.trim() || 'Нет названия', 
                        content: contentToSave, 
                        tags_text: tagsText.trim() 
                      })
                      
                      // Обновляем кэш после сохранения
                      qc.invalidateQueries({ queryKey: ['notes'] })
                      qc.invalidateQueries({ queryKey: ['note', selectedNoteId] })
                      
                      // Только после успешного сохранения открываем модальное окно
                      setShowDeadlineModal(true)
                    } catch (error) {
                      console.error('Ошибка при сохранении заметки перед созданием дедлайна:', error)
                      await alert('Не удалось сохранить заметку. Попробуйте еще раз.')
                    }
                  } else {
                    // Если заметки еще нет, открываем модальное окно (но это не должно произойти, т.к. кнопка видна только для todo)
                    setShowDeadlineModal(true)
                  }
                }}
                title={deadline ? "Изменить дедлайн" : "Создать дедлайн"}
              >
                <span className="inner-nav-icon">
                  <AlarmIcon width={20} height={20} />
                </span>
              </button>
            )}
            {showFolderSelect && folders && (
              <>
                <div 
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 999
                  }}
                  onClick={() => setShowFolderSelect(false)}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: '8px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '8px',
                  minWidth: '200px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  {folders.map(folder => (
                    <div
                      key={folder.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveToFolder(folder.id)
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        marginBottom: '4px',
                        backgroundColor: noteToShow?.folder_id === folder.id ? 'var(--hover)' : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (noteToShow?.folder_id !== folder.id) {
                          e.currentTarget.style.backgroundColor = 'var(--hover)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (noteToShow?.folder_id !== folder.id) {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }
                      }}
                    >
                      {folder.name}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="notes-inner-nav-right">
            <button 
              className="inner-nav-item active" 
              onClick={handleCreateNote}
              title="Создать новую заметку"
            >
              <span className="inner-nav-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="5" y="3" width="10" height="14" rx="1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="7" y1="7" x2="13" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="7" y1="10" x2="11" y2="10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="7" y1="13" x2="9" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
            </button>
          </div>
        </div>
        <DeadlineModal
          open={showDeadlineModal}
          onClose={() => setShowDeadlineModal(false)}
          onConfirm={async (deadlineAt) => {
            if (!selectedNoteId) return
            try {
              // Убеждаемся, что заметка сохранена как todo перед созданием дедлайна
              // (на всякий случай, хотя это уже должно быть сделано при открытии модального окна)
              if (!deadline) {
                // Перед созданием нового дедлайна еще раз сохраняем заметку
                const contentToSave = isTodoMode 
                  ? serializeTodoData(todoItems && todoItems.length > 0 ? todoItems : [{ id: Date.now(), text: '', completed: false }])
                  : (content && content.trim() ? content.trim() : null)
                
                try {
                  await updateNote.mutateAsync({ 
                    id: selectedNoteId, 
                    title: title.trim() || 'Нет названия', 
                    content: contentToSave, 
                    tags_text: tagsText.trim() 
                  })
                  // Небольшая задержка, чтобы сервер успел обработать сохранение
                  await new Promise(resolve => setTimeout(resolve, 100))
                } catch (saveError) {
                  console.error('Ошибка при сохранении заметки перед созданием дедлайна:', saveError)
                  // Продолжаем попытку создать дедлайн, возможно заметка уже сохранена
                }
              }
              
              if (deadline) {
                // Обновляем существующий дедлайн
                await updateDeadlineMutation.mutateAsync({
                  noteId: selectedNoteId,
                  deadlineAt
                })
              } else {
                // Создаем новый дедлайн
                // Если дедлайн уже существует (например, был создан в другом месте),
                // пытаемся обновить его
                try {
                  await createDeadlineMutation.mutateAsync({
                    noteId: selectedNoteId,
                    deadlineAt
                  })
                } catch (error: any) {
                  // Если дедлайн уже существует, обновляем его
                  if (error.message?.includes('уже существует')) {
                    await updateDeadlineMutation.mutateAsync({
                      noteId: selectedNoteId,
                      deadlineAt
                    })
                  } else {
                    throw error
                  }
                }
              }
            } catch (error) {
              console.error('Ошибка при сохранении дедлайна:', error)
              const errorMessage = error instanceof Error ? error.message : String(error)
              await alert('Не удалось сохранить дедлайн: ' + errorMessage)
            }
          }}
          initialDeadline={deadline?.deadline_at || null}
        />
      </>
      )
    }
    // Если заметка еще не найдена, но есть selectedNoteId и allNotes загружается, показываем загрузку
    if (allNotesLoading) {
      console.log('[Notes] Загрузка allNotes, ждем...')
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
          Загрузка заметки...
        </div>
      )
    }
    // Если заметка не найдена и загрузка завершена, показываем сообщение об ошибке
    // НО ГЛАВНОЕ - не показываем список папок
    console.log('[Notes] Заметка не найдена, но selectedNoteId есть:', selectedNoteId, 'allNotes:', allNotes?.length, 'заметок')
    // Пытаемся найти заметку еще раз напрямую в allNotes
    if (allNotes) {
      const note = allNotes.find(n => n.id === selectedNoteId)
      if (note) {
        console.log('[Notes] Заметка найдена напрямую в allNotes, открываем редактор')
        // Если заметка найдена, но noteToShow еще null, это значит, что нужно обновить состояние
        // Но мы не можем обновить состояние здесь, поэтому просто покажем загрузку
        // Заметка должна быть найдена в следующем рендере через noteToShow
        return (
          <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
            Загрузка заметки...
          </div>
        )
      }
    }
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
        Заметка не найдена (ID: {selectedNoteId})
      </div>
    )
  }

  // Если выбрана папка - показываем список заметок (второй скриншот)
  // НО только если НЕ выбрана заметка (чтобы не показывать список папок вместо заметки)
  // ВАЖНО: проверяем selectedNoteId еще раз, чтобы убедиться, что заметка не выбрана
  if (selectedFolderId !== null && !selectedNoteId) {
    console.log('[Notes] Показываем список папок, selectedFolderId:', selectedFolderId, 'selectedNoteId:', selectedNoteId)
    const selectedFolder = folders?.find(f => f.id === selectedFolderId)
    
    return (
      <div className="notes-folder-view">
        <div ref={topElementRef} className="notes-folder-header">
          <button className="notes-back-button" onClick={handleBack}>
            ←
          </button>
          <h1 className="notes-folder-title">{selectedFolder?.name || 'Заметки'}</h1>
        </div>

        <div className="notes-folder-content">
          <div className="notes-folder-list">
            {notesLoading ? (
              <div className="notes-empty">Загрузка...</div>
            ) : (
              <>
                {filteredNotes && filteredNotes.length > 0 ? (
                  filteredNotes.map(note => (
                    <div 
                      key={note.id} 
                      className="notes-folder-item"
                      onClick={() => setSelectedNoteIdWithLog(note.id, 'клик по заметке в папке')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="notes-folder-item-title">
                          {searchQuery.trim() ? highlightText(note.title || 'Без названия', searchQuery) : (note.title || 'Без названия')}
                        </div>
                        {note.content && (
                          <div className="notes-folder-item-preview">
                            {searchQuery.trim() ? getHighlightedPreview(note.content, searchQuery) : formatNotePreview(note.content, 50)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        {isTodoNote(note.content) && note.has_deadline_notifications && (
                          <button 
                            className="inner-nav-item"
                            style={{ cursor: 'default', pointerEvents: 'none' }}
                            title="Уведомления о дедлайне включены"
                          >
                            <BellIcon isActive={true} width={18} height={18} />
                          </button>
                        )}
                        {isTodoNote(note.content) && (
                          <button 
                            className={`inner-nav-item ${note.is_favorite ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleFavorite.mutate(note.id)
                            }}
                            title={note.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                          >
                            <LightningIcon isActive={note.is_favorite || false} width={20} height={20} />
                          </button>
                        )}
                        <button 
                          className="inner-nav-item" 
                          onClick={(e) => handleDelete(e, note.id)}
                          title="Удалить заметку"
                        >
                          <TrashIcon width={18} height={18} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="notes-empty">
                    {searchQuery ? 'Заметки не найдены' : 'Нет заметок'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Поиск и кнопка создания заметки внизу */}
        {!isNoteEditorOpen && (
          <div className="notes-search-pill-wrapper">
            <div 
              ref={searchPillRef}
              className={`notes-search-pill ${isSearchFocused || searchQuery.trim() ? 'notes-search-pill--expanded' : ''}`}
              role="search" 
              aria-label="Поиск"
              style={maxHeight ? { maxHeight } : undefined}
            >
              <div className="notes-search-pill__input-wrapper">
                <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  key="search-input-main"
                  ref={searchInputRef}
                  type="text"
                  placeholder="Поиск"
                  value={searchQuery}
                  onInput={e => {
                    const target = e.target as HTMLInputElement
                    const newValue = target.value
                    setSearchQuery(newValue)
                  }}
                  onChange={e => {
                    setSearchQuery(e.target.value)
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    // Не сбрасываем фокус сразу, чтобы можно было кликнуть на результат
                    setTimeout(() => setIsSearchFocused(false), 200)
                  }}
                  className="notes-search-input"
                />
              </div>
              
              {/* Результаты поиска внутри расширенного блока */}
              {(isSearchFocused || searchQuery.trim()) && (
                <div className="notes-search-pill__results">
                  {searchQuery.trim() && filteredNotes.length > 0 && (
                    <div className="notes-search-pill__results-list">
                      {filteredNotes.map(note => (
                        <div
                          key={note.id}
                          className="notes-search-pill__result-item"
                          onClick={() => {
                            setSelectedNoteIdWithLog(note.id, 'при создании заметки в Notes.tsx')
                          }}
                        >
                          <div className="notes-search-pill__result-title">
                            {note.title || 'Без названия'}
                          </div>
                          {note.content && (
                            <div className="notes-search-pill__result-content">
                              {formatNotePreview(note.content, 80)}
                            </div>
                          )}
                          {note.tags && note.tags.length > 0 && (
                            <div className="notes-search-pill__result-tags">
                              {note.tags.map(tag => (
                                <span 
                                  key={tag.id} 
                                  className="notes-search-pill__result-tag"
                                  style={{ 
                                    color: tag.name.toLowerCase() === 'учеба' ? '#FFC300' : (tag.color || 'var(--fg-secondary)')
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
                    <div className="notes-search-pill__no-results">
                      Заметки не найдены
                    </div>
                  )}
                </div>
              )}
            </div>
            <button 
              className="notes-create-note-btn"
              onClick={handleCreateNote}
              title="Создать новую заметку"
            >
              <div className="notes-create-note-btn__light"></div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="4" width="12" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="9" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="9" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="9" y1="15" x2="11" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    )
  }

  // Показываем список папок (первый скриншот)
  // Если есть поисковый запрос, показываем результаты поиска вместо списка папок
  const showSearchResults = searchQuery.trim() && !selectedFolderId && !selectedTagId

  return (
    <div className="notes-folders-view">
      <div ref={topElementRef} className="notes-folders-header">
        <button 
          className="notes-back-button" 
          onClick={() => {
            if (showSearchResults) {
              setSearchQuery('')
            } else {
              navigate('/')
            }
          }}
        >
          ←
        </button>
        <h1 className="notes-folders-title">{showSearchResults ? 'Результаты поиска' : 'Папки'}</h1>
      </div>
      
      {showSearchResults ? (
        <div className="notes-folder-content">
          <div className="notes-folder-list">
            {filteredNotes && filteredNotes.length > 0 ? (
              filteredNotes.map(note => {
                const noteFolder = folders?.find(f => f.id === note.folder_id)
                return (
                  <div 
                    key={note.id} 
                    className="notes-folder-item"
                    onClick={() => {
                      // Открываем папку заметки и саму заметку
                      if (noteFolder) {
                        setSelectedFolderId(noteFolder.id)
                      }
                      setSelectedNoteIdWithLog(note.id, 'при создании заметки в Notes.tsx')
                    }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div className="notes-folder-item-title">
                          {highlightText(note.title || 'Без названия', searchQuery)}
                        </div>
                        {noteFolder && (
                          <div className="notes-folder-badge">
                            <FolderIcon width={14} height={14} />
                            <span>{noteFolder.name}</span>
                          </div>
                        )}
                      </div>
                      {note.content && (
                        <div className="notes-folder-item-preview">
                          {getHighlightedPreview(note.content, searchQuery)}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      {isTodoNote(note.content) && note.has_deadline_notifications && (
                        <button 
                          className="inner-nav-item"
                          style={{ cursor: 'default', pointerEvents: 'none' }}
                          title="Уведомления о дедлайне включены"
                        >
                          <BellIcon isActive={true} width={18} height={18} />
                        </button>
                      )}
                      {isTodoNote(note.content) && (
                        <button 
                          className={`inner-nav-item ${note.is_favorite ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorite.mutate(note.id)
                          }}
                          title={note.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
                        >
                          <StarIcon isActive={note.is_favorite || false} />
                        </button>
                      )}
                      <button 
                        className="inner-nav-item" 
                        onClick={(e) => handleDelete(e, note.id)}
                        title="Удалить заметку"
                      >
                        <TrashIcon width={18} height={18} />
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="notes-empty">
                Заметки не найдены
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="notes-folders-container">
          {foldersLoading ? (
            <div className="notes-empty">Загрузка...</div>
          ) : (
            <>
              {folders?.map(folder => (
                <div 
                  key={folder.id} 
                  className="notes-folder-item-card"
                  onClick={() => setSelectedFolderId(folder.id)}
                >
                  <span className="notes-folder-icon">
                    <FolderIcon width={20} height={20} />
                  </span>
                  <span className="notes-folder-name">{folder.name}</span>
                  {!folder.is_default && (
                    <button
                      className="notes-folder-delete-btn"
                      onClick={async (e) => {
                        e.stopPropagation()
                        const result = await confirm(`Вы уверены, что хотите удалить папку "${folder.name}"? Заметки из этой папки будут перемещены в папку "Все".`)
                        if (result) {
                          deleteFolder.mutate(folder.id)
                        }
                      }}
                      disabled={deleteFolder.isPending}
                      title="Удалить папку"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
              
              {showNewFolderInput ? (
                <div className="notes-folder-item-card notes-folder-new-input">
                  <input
                    type="text"
                    placeholder="Название папки"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        handleCreateFolder()
                      } else if (e.key === 'Escape') {
                        setShowNewFolderInput(false)
                        setNewFolderName('')
                      }
                    }}
                    autoFocus
                    className="notes-folder-input"
                  />
                  <button 
                    className="notes-folder-create-btn"
                    onClick={handleCreateFolder}
                  >
                    ✓
                  </button>
                  <button 
                    className="notes-folder-cancel-btn"
                    onClick={() => {
                      setShowNewFolderInput(false)
                      setNewFolderName('')
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div 
                  className="notes-folder-item-card notes-folder-new"
                  onClick={() => setShowNewFolderInput(true)}
                >
                  <span className="notes-folder-icon">
                    <PlusIcon width={20} height={20} />
                  </span>
                  <span className="notes-folder-name">Новая папка</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!showSearchResults && (
        <>
          <h2 className="notes-tags-title">Теги</h2>
      
          <div className="notes-tags-container">
            {availableTags.length > 0 ? (
              availableTags.map(tag => (
                <span 
                  key={tag.id} 
                  className="notes-tag-pill"
                  style={{ 
                    cursor: 'pointer',
                    opacity: selectedTagId === tag.id ? 1 : 0.7,
                    backgroundColor: selectedTagId === tag.id ? (tag.color || 'var(--primary)') : 'transparent',
                    border: selectedTagId === tag.id ? `1px solid ${tag.color || 'var(--primary)'}` : '1px solid var(--border)'
                  }}
                  onClick={() => {
                    // Переходим на страницу заметок с фильтром по тегу
                    navigate(`/notes?tag_id=${tag.id}`)
                  }}
                >
                  #{tag.name}
                </span>
              ))
            ) : (
              <div className="notes-empty-small">Нет тегов</div>
            )}
          </div>
        </>
      )}

      {/* Поиск и кнопка создания заметки внизу - всегда виден */}
      {!isNoteEditorOpen && (
        <div className="notes-search-pill-wrapper">
          <div 
            ref={searchPillRef}
            className={`notes-search-pill ${isSearchFocused || searchQuery.trim() ? 'notes-search-pill--expanded' : ''}`}
            role="search" 
            aria-label="Поиск"
            style={maxHeight ? { maxHeight } : undefined}
          >
            <div className="notes-search-pill__input-wrapper">
              <svg className="icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                key="search-input-main"
                ref={searchInputRef}
                type="text"
                placeholder="Поиск"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => {
                  // Не сбрасываем фокус сразу, чтобы можно было кликнуть на результат
                  setTimeout(() => setIsSearchFocused(false), 200)
                }}
                className="notes-search-input"
              />
            </div>
            
            {/* Результаты поиска внутри расширенного блока */}
            {(isSearchFocused || searchQuery.trim()) && (
              <div className="notes-search-pill__results">
                {searchQuery.trim() && filteredNotes.length > 0 && (
                  <div className="notes-search-pill__results-list">
                    {filteredNotes.map(note => (
                      <div
                        key={note.id}
                        className="notes-search-pill__result-item"
                        onClick={() => {
                          if (note.folder_id) {
                            setSelectedFolderId(note.folder_id)
                            setSelectedNoteIdWithLog(note.id, 'при создании заметки в Notes.tsx')
                          }
                        }}
                      >
                        <div className="notes-search-pill__result-title">
                          {note.title || 'Без названия'}
                        </div>
                        {note.content && (
                          <div className="notes-search-pill__result-content">
                            {formatNotePreview(note.content, 80)}
                          </div>
                        )}
                        {note.tags && note.tags.length > 0 && (
                          <div className="notes-search-pill__result-tags">
                            {note.tags.map(tag => (
                              <span 
                                key={tag.id} 
                                className="notes-search-pill__result-tag"
                                style={{ 
                                  color: tag.name.toLowerCase() === 'учеба' ? '#FFC300' : (tag.color || 'var(--fg-secondary)')
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
                  <div className="notes-search-pill__no-results">
                    Заметки не найдены
                  </div>
                )}
              </div>
            )}
          </div>
            <button 
              className="notes-create-note-btn"
              onClick={handleCreateNote}
              title="Создать новую заметку"
            >
              <div className="notes-create-note-btn__light"></div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="4" width="12" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="9" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="9" y1="12" x2="13" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="9" y1="15" x2="11" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
        </div>
      )}
      
      {/* Уведомление о сохранении */}
      {showSaveNotification && (
        <div className="save-notification">
          <div className="save-notification__content">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Заметка сохранена</span>
          </div>
        </div>
      )}
    </div>
  )
}
