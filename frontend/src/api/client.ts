// Определяем API URL в зависимости от окружения
// В dev режиме используем localhost, в production - домен
const getApiUrl = (): string => {
  // Если явно указан VITE_API_URL, используем его
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // В dev режиме используем localhost
  if (import.meta.env.DEV) {
    return 'http://localhost:8000'
  }
  
  // В production используем домен
  return 'https://backend-devcore-max.cloudpub.ru'
}

const API_URL = getApiUrl()

function getToken(): string | null {
  return localStorage.getItem('token')
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined)
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const url = `${API_URL}${path}`
  console.log(`[API] ${options.method || 'GET'} ${url}`, { headers, body: options.body })
  console.log(`[API] Full URL: ${url}`)
  console.log(`[API] Mode: ${import.meta.env.MODE} (DEV: ${import.meta.env.DEV}, PROD: ${import.meta.env.PROD})`)
  console.log(`[API] API_URL from env: ${import.meta.env.VITE_API_URL || 'not set (using auto-detected: ' + API_URL + ')'}`)

  try {
    const res = await fetch(url, { ...options, headers })
    console.log(`[API] Response: ${res.status} ${res.statusText}`)
    console.log(`[API] Response URL: ${res.url}`)
    console.log(`[API] Response headers:`, Object.fromEntries(res.headers.entries()))
    
    if (!res.ok) {
      // Только при 401 (Unauthorized) удаляем токен и редиректим на логин
      // При других ошибках (502, 503, network errors) не удаляем токен,
      // чтобы пользователь мог видеть сообщение об ошибке подключения
      if (res.status === 401) {
        localStorage.removeItem('token')
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        throw new Error('Неавторизован')
      }
      
      // Специальная обработка 502 Bad Gateway
      if (res.status === 502) {
        console.error(`[API] 502 Bad Gateway при запросе к ${url}`)
        console.error('[API] Возможные причины:')
        console.error('[API] 1. Бэкенд не запущен или упал')
        console.error('[API] 2. Nginx не может подключиться к бэкенду')
        console.error('[API] 3. Бэкенд перегружен или не отвечает')
        console.error('[API] 4. Проблемы с сетью между nginx и бэкендом')
        throw new Error('Сервер временно недоступен (502 Bad Gateway). Пожалуйста, попробуйте позже.')
      }
      
      // Обработка 503 Service Unavailable
      if (res.status === 503) {
        console.error(`[API] 503 Service Unavailable при запросе к ${url}`)
        throw new Error('Сервис временно недоступен. Пожалуйста, попробуйте позже.')
      }
      
      let errorMessage = 'Ошибка запроса'
      try {
        const text = await res.text()
        if (text) {
          try {
            const data = JSON.parse(text)
            errorMessage = data.detail || data.message || errorMessage
          } catch {
            errorMessage = text || errorMessage
          }
        }
      } catch {
        // Игнорируем ошибки чтения тела ответа
      }
      throw new Error(errorMessage)
    }
    const ct = res.headers.get('content-type') || ''
    let data: T
    
    // Безопасная обработка ответа
    if (ct.includes('application/json')) {
      try {
        const text = await res.text()
        data = text ? JSON.parse(text) : (undefined as unknown as T)
      } catch (parseError) {
        console.error(`[API] Failed to parse JSON response:`, parseError)
        // Если ответ успешный, но не JSON - возвращаем undefined
        data = undefined as unknown as T
      }
    } else {
      data = undefined as unknown as T
    }
    
    // Дополнительное логирование для отладки
    console.log(`[API] Response data:`, data)
    console.log(`[API] Response came from: ${res.url}`)
    if (res.url !== url) {
      console.warn(`[API] WARNING: Response URL (${res.url}) differs from request URL (${url})!`)
    }
    
    return data
  } catch (error) {
    // Обработка сетевых ошибок (бэкенд недоступен)
    // НЕ удаляем токен при сетевых ошибках - пользователь авторизован, просто нет подключения
    if (
      error instanceof TypeError && 
      (error.message.includes('fetch') || 
       error.message.includes('Failed to fetch') ||
       error.message.includes('NetworkError') ||
       error.message.includes('network'))
    ) {
      console.error(`[API] Network error: Cannot connect to ${url}`)
      throw new Error('Нет подключения к базе данных. Пожалуйста, попробуйте позже.')
    }
    // Обработка других сетевых ошибок
    if (error instanceof Error && (
      error.message.includes('ERR_CONNECTION_REFUSED') ||
      error.message.includes('ERR_INTERNET_DISCONNECTED') ||
      error.message.includes('Network request failed')
    )) {
      console.error(`[API] Network error: Cannot connect to ${url}`)
      throw new Error('Нет подключения к базе данных. Пожалуйста, попробуйте позже.')
    }
    throw error
  }
}

export async function login(username: string, uuid: string) {
  const data = await api<{ access_token: string }>("/auth/login", { method: 'POST', body: JSON.stringify({ username, uuid }) })
  localStorage.setItem('token', data.access_token)
}

export async function register(username: string, uuid: string) {
  await api("/auth/register", { method: 'POST', body: JSON.stringify({ username, uuid }) })
}

export async function createTag(name: string) {
  return api<{ id: number; name: string }>("/api/tags", { method: 'POST', body: JSON.stringify({ name }) })
}

export async function getCurrentUser() {
  return api<{ id: number; username: string; uuid: string; created_at: string }>("/auth/me")
}

// Deadlines
export type Deadline = {
  id: number
  note_id: number
  deadline_at: string
  notification_enabled: boolean
  days_remaining: number | null
  status: string | null
  time_remaining_text: string | null
}

export async function createDeadline(noteId: number, deadlineAt: string) {
  return api<Deadline>("/api/deadlines", {
    method: "POST",
    body: JSON.stringify({ note_id: noteId, deadline_at: deadlineAt }),
  })
}

export async function getDeadline(noteId: number) {
  return api<Deadline>(`/api/deadlines/${noteId}`)
}

export async function updateDeadline(noteId: number, data: { deadline_at?: string; notification_enabled?: boolean }) {
  return api<Deadline>(`/api/deadlines/${noteId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteDeadline(noteId: number) {
  return api<{ ok: boolean }>(`/api/deadlines/${noteId}`, {
    method: "DELETE",
  })
}

export async function toggleDeadlineNotifications(noteId: number) {
  return api<Deadline>(`/api/deadlines/${noteId}/notifications/toggle`, {
    method: "POST",
  })
}

export async function testDeadlineNotification(noteId: number) {
  return api<{ ok: boolean; message: string }>(`/api/deadlines/${noteId}/notifications/test`, {
    method: "POST",
  })
}

export interface UserSettings {
  id: number
  user_id: number
  language: 'ru' | 'en'
  theme: 'light' | 'dark'
  notification_times_minutes: number[]  // Массив минут до дедлайна (до 10 штук)
}

export interface UserSettingsUpdate {
  language?: 'ru' | 'en'
  theme?: 'light' | 'dark'
  notification_times_minutes?: number[]  // Массив минут до дедлайна (до 10 штук)
}

export async function getUserSettings(): Promise<UserSettings> {
  return api<UserSettings>('/api/settings')
}

export async function updateUserSettings(settings: UserSettingsUpdate): Promise<UserSettings> {
  return api<UserSettings>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  })
}


