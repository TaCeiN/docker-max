/**
 * Определяет платформу (iOS/Android/Desktop)
 */
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

/**
 * Ожидает загрузки Max WebApp SDK и получения initData
 * Делает повторные попытки с интервалом
 * Увеличено время ожидания для надежной работы с медленной загрузкой SDK
 * Использует сохраненный initData из localStorage как fallback
 */
async function waitForInitData(maxAttempts: number = 60, intervalMs: number = 500): Promise<string | null> {
  const w = window as any
  const platformInfo = detectPlatform()
  
  // Для iOS увеличиваем время ожидания, если не указано явно
  const actualMaxAttempts = platformInfo.isIOS && maxAttempts === 60 ? 120 : maxAttempts // 120 попыток = 60 секунд для iOS
  
  console.log(`[waitForInitData] Начинаем ожидание initData: ${actualMaxAttempts} попыток по ${intervalMs}ms (всего до ${actualMaxAttempts * intervalMs / 1000} секунд)`)
  console.log(`[waitForInitData] Платформа: ${platformInfo.platform}${platformInfo.isIOS ? ' (iOS - увеличенное время ожидания)' : ''}`)
  
  // Сначала проверяем сохраненный initData
  try {
    const savedInitData = localStorage.getItem('initData_saved')
    if (savedInitData) {
      console.log('[waitForInitData] ✅ Найден сохраненный initData в localStorage, используем его')
      return savedInitData
    }
  } catch (e) {
    console.warn('[waitForInitData] Ошибка при чтении localStorage:', e)
  }
  
  for (let attempt = 0; attempt < actualMaxAttempts; attempt++) {
    const attemptNumber = attempt + 1
    const elapsed = attempt * intervalMs
    const elapsedSeconds = Math.round(elapsed / 1000)
    
    // На iOS логируем чаще для диагностики
    const shouldLog = platformInfo.isIOS 
      ? (attemptNumber % 5 === 0 || attemptNumber <= 10) // Каждые 5 попыток или первые 10 для iOS
      : (attemptNumber % 10 === 0 || attemptNumber <= 5) // Каждые 10 попыток или первые 5 для других
    
    if (shouldLog) {
      console.log(`[waitForInitData] Попытка ${attemptNumber}/${actualMaxAttempts} (прошло ${elapsedSeconds} секунд)${platformInfo.isIOS ? ' [iOS]' : ''}`)
      if (platformInfo.isIOS) {
        console.log(`[waitForInitData] iOS: Проверяем SDK объекты...`)
        console.log(`[waitForInitData] iOS: window.MaxWebApp:`, w?.MaxWebApp ? 'найден' : 'не найден')
        console.log(`[waitForInitData] iOS: window.Telegram:`, w?.Telegram ? 'найден' : 'не найден')
        console.log(`[waitForInitData] iOS: window.Max:`, w?.Max ? 'найден' : 'не найден')
      }
    }
    
    // Проверяем все возможные источники
    const initData = getInitData()
    if (initData) {
      console.log(`[waitForInitData] ✅ initData найден на попытке ${attemptNumber} (через ${elapsedSeconds} секунд)`)
      // Сохраняем для последующих запусков (если еще не сохранен)
      try {
        if (!localStorage.getItem('initData_saved')) {
          localStorage.setItem('initData_saved', initData)
          console.log('[waitForInitData] ✅ initData сохранен в localStorage')
        }
      } catch (e) {
        console.warn('[waitForInitData] Не удалось сохранить initData:', e)
      }
      return initData
    }
    
    // Проверяем, загружается ли SDK
    if (w?.MaxWebApp || w?.Telegram?.WebApp || w?.Max?.WebApp) {
      const logInterval = platformInfo.isIOS ? 5 : 10
      if (attemptNumber % logInterval === 0) {
        console.log(`[waitForInitData] SDK обнаружен, но initData еще нет, ждем... (попытка ${attemptNumber})${platformInfo.isIOS ? ' [iOS]' : ''}`)
      }
    } else if (platformInfo.isIOS && attemptNumber % 10 === 0) {
      // На iOS логируем, если SDK не найден
      console.log(`[waitForInitData] iOS: SDK не найден на попытке ${attemptNumber}, продолжаем ожидание...`)
    }
    
    // Также проверяем sessionStorage
    try {
      const fromSessionStorage = sessionStorage.getItem('initData_from_postMessage')
      if (fromSessionStorage) {
        console.log(`[waitForInitData] ✅ initData найден в sessionStorage на попытке ${attemptNumber}`)
        // Сохраняем в localStorage
        try {
          localStorage.setItem('initData_saved', fromSessionStorage)
        } catch (e) {
          console.warn('[waitForInitData] Не удалось сохранить в localStorage:', e)
        }
        return fromSessionStorage
      }
    } catch (e) {
      // Игнорируем ошибки sessionStorage
    }
    
    // Если это не последняя попытка, ждем перед следующей
    if (attempt < actualMaxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }
  
  console.log(`[waitForInitData] ❌ initData не найден после ${actualMaxAttempts} попыток (${actualMaxAttempts * intervalMs / 1000} секунд)`)
  if (platformInfo.isIOS) {
    console.log(`[waitForInitData] iOS: ⚠️ initData не найден после всех попыток`)
    console.log(`[waitForInitData] iOS: Проверьте, что SDK Max загружается правильно и initData приходит через postMessage или SDK`)
    console.log(`[waitForInitData] iOS: window.MaxWebApp:`, w?.MaxWebApp ? 'найден' : 'не найден')
    console.log(`[waitForInitData] iOS: window.Telegram:`, w?.Telegram ? 'найден' : 'не найден')
    console.log(`[waitForInitData] iOS: window.Max:`, w?.Max ? 'найден' : 'не найден')
  }
  
  // Финальная попытка: проверяем сохраненный initData еще раз
  try {
    const savedInitData = localStorage.getItem('initData_saved')
    if (savedInitData) {
      console.log('[waitForInitData] ✅ Используем сохраненный initData из localStorage как fallback')
      if (platformInfo.isIOS) {
        console.log('[waitForInitData] iOS: Используем сохраненный initData из localStorage')
      }
      return savedInitData
    }
  } catch (e) {
    console.warn('[waitForInitData] Ошибка при финальной проверке localStorage:', e)
    if (platformInfo.isIOS) {
      console.warn('[waitForInitData] iOS: Ошибка при чтении localStorage:', e)
    }
  }
  
  return null
}

/**
 * Получает initData из различных источников Max WebApp
 * Max открывает мини-приложение как обычную веб-страницу и передает данные через:
 * 1. URL параметры (?initData=... или другие параметры)
 * 2. postMessage от родительского окна
 * 3. window.MaxWebApp.initData (если SDK загружен)
 */
function getInitData(): string | null {
  const w = window as any
  const platformInfo = detectPlatform()
  
  console.log('[getInitData] ========================================')
  console.log('[getInitData] 🔍 Начинаем поиск initData...')
  console.log('[getInitData] Платформа:', platformInfo.platform, platformInfo.isIOS ? '(iOS)' : platformInfo.isAndroid ? '(Android)' : '')
  console.log('[getInitData] window.location.href:', window.location.href)
  console.log('[getInitData] window.location.search:', window.location.search)
  console.log('[getInitData] window.location.hash:', window.location.hash)
  
  if (platformInfo.isIOS) {
    console.log('[getInitData] iOS: Проверка всех источников initData...')
    console.log('[getInitData] iOS: User Agent:', navigator.userAgent)
  }
  
  // 0. Проверяем localStorage для сохраненного initData (если был сохранен ранее)
  try {
    const savedInitData = localStorage.getItem('initData_saved')
    if (savedInitData) {
      console.log('[getInitData] ✅ Найден сохраненный initData в localStorage')
      // Проверяем, не истек ли он (можно добавить проверку времени, но пока просто используем)
      return savedInitData
    }
  } catch (e) {
    console.warn('[getInitData] Ошибка при чтении localStorage:', e)
  }
  
  // 1. Попытка получить из Max WebApp SDK
  console.log('[getInitData] Проверяем window.MaxWebApp:', w?.MaxWebApp)
  if (platformInfo.isIOS) {
    console.log('[getInitData] iOS: Проверка window.MaxWebApp...')
    console.log('[getInitData] iOS: window.MaxWebApp существует:', !!w?.MaxWebApp)
    if (w?.MaxWebApp) {
      console.log('[getInitData] iOS: window.MaxWebApp ключи:', Object.keys(w.MaxWebApp))
      console.log('[getInitData] iOS: window.MaxWebApp.initData:', w.MaxWebApp.initData ? 'есть' : 'нет')
    }
  }
  
  if (w?.MaxWebApp?.initData) {
    console.log('[getInitData] ✅ Найден в window.MaxWebApp.initData')
    if (platformInfo.isIOS) {
      console.log('[getInitData] iOS: ✅ initData найден в window.MaxWebApp.initData')
    }
    const initData = w.MaxWebApp.initData
    // Сохраняем для последующих запусков
    try {
      localStorage.setItem('initData_saved', initData)
    } catch (e) {
      console.warn('[getInitData] Не удалось сохранить initData в localStorage:', e)
    }
    return initData
  }
  
  // Проверяем другие возможные пути к Max WebApp SDK
  if (w?.Telegram?.WebApp?.initData) {
    console.log('[getInitData] ✅ Найден в window.Telegram.WebApp.initData')
    if (platformInfo.isIOS) {
      console.log('[getInitData] iOS: ✅ initData найден в window.Telegram.WebApp.initData')
    }
    const initData = w.Telegram.WebApp.initData
    try {
      localStorage.setItem('initData_saved', initData)
    } catch (e) {
      console.warn('[getInitData] Не удалось сохранить initData в localStorage:', e)
    }
    return initData
  }
  
  if (w?.Max?.WebApp?.initData) {
    console.log('[getInitData] ✅ Найден в window.Max.WebApp.initData')
    if (platformInfo.isIOS) {
      console.log('[getInitData] iOS: ✅ initData найден в window.Max.WebApp.initData')
    }
    const initData = w.Max.WebApp.initData
    try {
      localStorage.setItem('initData_saved', initData)
    } catch (e) {
      console.warn('[getInitData] Не удалось сохранить initData в localStorage:', e)
    }
    return initData
  }
  
  if (platformInfo.isIOS) {
    console.log('[getInitData] iOS: ⚠️ SDK объекты не содержат initData')
    console.log('[getInitData] iOS: Проверяем другие источники (URL параметры, sessionStorage, localStorage)...')
  }
  
  // 1.5. Проверяем sessionStorage (может быть сохранен из postMessage)
  try {
    const fromPostMessage = sessionStorage.getItem('initData_from_postMessage')
    if (fromPostMessage) {
      console.log('[getInitData] ✅ Найден в sessionStorage (из postMessage)')
      // Также сохраняем в localStorage для последующих запусков
      try {
        localStorage.setItem('initData_saved', fromPostMessage)
      } catch (e) {
        console.warn('[getInitData] Не удалось сохранить initData в localStorage:', e)
      }
      return fromPostMessage
    }
  } catch (e) {
    console.warn('[getInitData] Ошибка при чтении sessionStorage:', e)
  }
  
  // 2. Попытка получить из URL параметров (самый частый случай для Max)
  const urlParams = new URLSearchParams(location.search)
  
  // Расширенный список возможных названий параметров
  const possibleParamNames = [
    'initData', 'init_data', 'data', 'tgWebAppData', 'webAppData',
    'initdata', 'initDataRaw', 'initDataRaw', 'webapp_data', 'webappdata',
    'tg_web_app_data', 'tgWebAppDataRaw', 'start_param'
  ]
  
  let fromUrl: string | null = null
  for (const paramName of possibleParamNames) {
    fromUrl = urlParams.get(paramName)
    if (fromUrl) {
      console.log(`[getInitData] ✅ Найден в URL параметре: ${paramName}`)
      break
    }
  }
  
  if (fromUrl) {
    try {
      const decoded = decodeURIComponent(fromUrl)
      // Сохраняем для последующих запусков
      try {
        localStorage.setItem('initData_saved', decoded)
      } catch (e) {
        console.warn('[getInitData] Не удалось сохранить initData в localStorage:', e)
      }
      return decoded
    } catch (e) {
      console.warn('[getInitData] Ошибка при декодировании URL параметра:', e)
      // Пробуем вернуть как есть
      try {
        localStorage.setItem('initData_saved', fromUrl)
      } catch (e2) {
        console.warn('[getInitData] Не удалось сохранить initData в localStorage:', e2)
      }
      return fromUrl
    }
  }
  
  // 2.5. Проверяем все параметры URL более агрессивно
  const fullUrl = window.location.href
  const allUrlParams = new URLSearchParams(fullUrl.split('?')[1] || '')
  console.log('[getInitData] Все параметры URL:', Array.from(allUrlParams.entries()))
  
  for (const [key, value] of allUrlParams.entries()) {
    const keyLower = key.toLowerCase()
    // Более широкий поиск
    if (keyLower.includes('init') || 
        keyLower.includes('data') || 
        keyLower.includes('webapp') ||
        keyLower.includes('web_app') ||
        keyLower.includes('start')) {
      console.log(`[getInitData] 🔍 Найден потенциальный параметр: ${key}=${value.substring(0, 50)}...`)
      
      // Пробуем распарсить как JSON, если похоже на JSON
      if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(decodeURIComponent(value))
          // Если это объект с пользователем, формируем initData
          if (parsed.user || parsed.user_id) {
            console.log('[getInitData] ✅ Обнаружен JSON объект с пользователем')
            const userId = parsed.user?.user_id || parsed.user?.id || parsed.user_id || parsed.id
            if (userId) {
              const parts = [`user_id=${userId}`]
              if (parsed.user?.first_name || parsed.first_name) {
                parts.push(`first_name=${encodeURIComponent(parsed.user?.first_name || parsed.first_name)}`)
              }
              if (parsed.user?.last_name || parsed.last_name) {
                parts.push(`last_name=${encodeURIComponent(parsed.user?.last_name || parsed.last_name)}`)
              }
              if (parsed.user?.username || parsed.username) {
                parts.push(`username=${encodeURIComponent(parsed.user?.username || parsed.username)}`)
              }
              const constructed = parts.join('&')
              console.log('[getInitData] ✅ Сформирован initData из JSON:', constructed)
              try {
                localStorage.setItem('initData_saved', constructed)
              } catch (e) {
                console.warn('[getInitData] Не удалось сохранить initData в localStorage:', e)
              }
              return constructed
            }
          }
        } catch (e) {
          // Не JSON, пробуем использовать как есть
          console.log(`[getInitData] Параметр ${key} не является JSON, используем как есть`)
        }
      }
      
      // Используем значение как initData
      try {
        const decoded = decodeURIComponent(value)
        console.log(`[getInitData] ✅ Используем параметр ${key} как initData`)
        try {
          localStorage.setItem('initData_saved', decoded)
        } catch (e) {
          console.warn('[getInitData] Не удалось сохранить initData в localStorage:', e)
        }
        return decoded
      } catch (e) {
        console.warn(`[getInitData] Ошибка при декодировании параметра ${key}:`, e)
        try {
          localStorage.setItem('initData_saved', value)
        } catch (e2) {
          console.warn('[getInitData] Не удалось сохранить initData в localStorage:', e2)
        }
        return value
      }
    }
  }
  
  // 3. Попытка получить из hash
  try {
    const hashParams = new URLSearchParams(location.hash.substring(1))
    for (const paramName of possibleParamNames) {
      const fromHash = hashParams.get(paramName)
      if (fromHash) {
        console.log(`[getInitData] ✅ Найден в hash параметре: ${paramName}`)
        try {
          const decoded = decodeURIComponent(fromHash)
          try {
            localStorage.setItem('initData_saved', decoded)
          } catch (e) {
            console.warn('[getInitData] Не удалось сохранить initData в localStorage:', e)
          }
          return decoded
        } catch (e) {
          try {
            localStorage.setItem('initData_saved', fromHash)
          } catch (e2) {
            console.warn('[getInitData] Не удалось сохранить initData в localStorage:', e2)
          }
          return fromHash
        }
      }
    }
  } catch (e) {
    console.warn('[getInitData] Ошибка при чтении hash:', e)
  }
  
  // 4. Попытка получить из window.location (полный URL может содержать initData)
  const urlMatch = fullUrl.match(/[?&#](?:initData|init_data|data|tgWebAppData|webAppData|start_param)=([^&?#]+)/i)
  if (urlMatch && urlMatch[1]) {
    console.log('[getInitData] ✅ Найден в полном URL через regex')
    try {
      const decoded = decodeURIComponent(urlMatch[1])
      try {
        localStorage.setItem('initData_saved', decoded)
      } catch (e) {
        console.warn('[getInitData] Не удалось сохранить initData в localStorage:', e)
      }
      return decoded
    } catch (e) {
      try {
        localStorage.setItem('initData_saved', urlMatch[1])
      } catch (e2) {
        console.warn('[getInitData] Не удалось сохранить initData в localStorage:', e2)
      }
      return urlMatch[1]
    }
  }
  
  // 5. Проверяем, может быть данные переданы как часть query string без имени параметра
  // Например: ?user_id=123&first_name=John (прямые параметры пользователя)
  const userId = urlParams.get('user_id') || urlParams.get('userId') || urlParams.get('id')
  if (userId) {
    console.log('[getInitData] Найден user_id в URL параметрах, формируем initData...')
    const firstName = urlParams.get('first_name') || urlParams.get('firstName') || urlParams.get('firstname') || ''
    const lastName = urlParams.get('last_name') || urlParams.get('lastName') || urlParams.get('lastname') || ''
    const username = urlParams.get('username') || urlParams.get('userName') || urlParams.get('user') || ''
    
    // Формируем initData в формате URL-encoded
    const parts = [`user_id=${userId}`]
    if (firstName) parts.push(`first_name=${encodeURIComponent(firstName)}`)
    if (lastName) parts.push(`last_name=${encodeURIComponent(lastName)}`)
    if (username) parts.push(`username=${encodeURIComponent(username)}`)
    
    const constructed = parts.join('&')
    console.log('[getInitData] ✅ Сформирован initData из URL параметров:', constructed)
    try {
      localStorage.setItem('initData_saved', constructed)
    } catch (e) {
      console.warn('[getInitData] Не удалось сохранить initData в localStorage:', e)
    }
    return constructed
  }
  
  console.log('[getInitData] ❌ initData не найден ни в одном источнике')
  console.log('[getInitData] Все параметры URL:', Array.from(urlParams.entries()))
  console.log('[getInitData] Доступные объекты в window:', Object.keys(w).filter(k => {
    const kLower = k.toLowerCase()
    return kLower.includes('max') || kLower.includes('telegram') || kLower.includes('web')
  }))
  
  if (platformInfo.isIOS) {
    console.log('[getInitData] iOS: ⚠️ initData не найден ни в одном источнике')
    console.log('[getInitData] iOS: Проверка всех источников завершена')
    console.log('[getInitData] iOS: window.MaxWebApp:', w?.MaxWebApp ? 'найден' : 'не найден')
    if (w?.MaxWebApp) {
      console.log('[getInitData] iOS: window.MaxWebApp ключи:', Object.keys(w.MaxWebApp))
      console.log('[getInitData] iOS: window.MaxWebApp.initData:', w.MaxWebApp.initData ? 'есть' : 'нет')
    }
    console.log('[getInitData] iOS: window.Telegram:', w?.Telegram ? 'найден' : 'не найден')
    if (w?.Telegram) {
      console.log('[getInitData] iOS: window.Telegram ключи:', Object.keys(w.Telegram))
      console.log('[getInitData] iOS: window.Telegram.WebApp:', w.Telegram.WebApp ? 'найден' : 'не найден')
      if (w.Telegram.WebApp) {
        console.log('[getInitData] iOS: window.Telegram.WebApp.initData:', w.Telegram.WebApp.initData ? 'есть' : 'нет')
      }
    }
    console.log('[getInitData] iOS: window.Max:', w?.Max ? 'найден' : 'не найден')
    if (w?.Max) {
      console.log('[getInitData] iOS: window.Max ключи:', Object.keys(w.Max))
      console.log('[getInitData] iOS: window.Max.WebApp:', w.Max.WebApp ? 'найден' : 'не найден')
      if (w.Max.WebApp) {
        console.log('[getInitData] iOS: window.Max.WebApp.initData:', w.Max.WebApp.initData ? 'есть' : 'нет')
      }
    }
    console.log('[getInitData] iOS: localStorage.getItem("initData_saved"):', localStorage.getItem('initData_saved') ? 'есть' : 'нет')
    console.log('[getInitData] iOS: sessionStorage.getItem("initData_from_postMessage"):', sessionStorage.getItem('initData_from_postMessage') ? 'есть' : 'нет')
    console.log('[getInitData] iOS: window.location.href:', window.location.href)
    console.log('[getInitData] iOS: window.location.search:', window.location.search)
    console.log('[getInitData] iOS: window.location.hash:', window.location.hash)
    console.log('[getInitData] iOS: User Agent:', navigator.userAgent)
  }
  
  console.log('[getInitData] ========================================')
  
  return null
}

/**
 * Пытается извлечь user_id из initData для логирования
 */
function extractUserIdFromInitData(initData: string): number | null {
  try {
    // Пытаемся распарсить как JSON
    if (initData.trim().startsWith('{')) {
      const data = JSON.parse(initData)
      return data.user?.user_id || data.user?.id || data.user_id || data.id || null
    }
    
    // Пытаемся распарсить как URL-encoded строку
    const params = new URLSearchParams(initData)
    const userStr = params.get('user')
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        return user.user_id || user.id || null
      } catch {
        // Если не JSON, пробуем найти user_id напрямую
        return params.get('user_id') ? parseInt(params.get('user_id')!) : null
      }
    }
    
    // Пробуем найти user_id напрямую в параметрах
    const userId = params.get('user_id')
    if (userId) {
      return parseInt(userId)
    }
    
    return null
  } catch (e) {
    console.warn('[autoLogin] Не удалось извлечь user_id из initData:', e)
    return null
  }
}

export async function autoLogin(waitForData: boolean = true): Promise<boolean> {
  const platformInfo = detectPlatform()
  console.log('[autoLogin] ========================================')
  console.log('[autoLogin] 🚀 Запуск autoLogin()')
  console.log('[autoLogin] Платформа:', platformInfo.platform, platformInfo.isIOS ? '(iOS)' : platformInfo.isAndroid ? '(Android)' : '')
  console.log('[autoLogin] ========================================')
  
  try {
    let initData: string | null = null
    
    // Сначала пробуем получить сразу
    initData = getInitData()
    
    if (platformInfo.isIOS) {
      console.log('[autoLogin] iOS: Проверка initData при запуске...')
      console.log('[autoLogin] iOS: initData найден сразу:', initData ? 'ДА' : 'НЕТ')
    }
    
    // Если не найден и нужно ждать, делаем повторные попытки
    if (!initData && waitForData) {
      console.log('[autoLogin] ⚠️ initData не найден сразу, ожидаем загрузки SDK...')
      if (platformInfo.isIOS) {
        console.log('[autoLogin] iOS: Ожидание загрузки SDK с увеличенным временем (до 60 секунд)...')
      }
      // Для iOS используем больше попыток (120 попыток = 60 секунд)
      // Для других платформ - 60 попыток = 30 секунд
      const maxAttempts = platformInfo.isIOS ? 120 : 60
      initData = await waitForInitData(maxAttempts, 500)
    }
    
    // Если initData все еще не найден, пробуем использовать сохраненные данные
    if (!initData) {
      console.log('[autoLogin] ⚠️ initData не найден после ожидания')
      console.log('[autoLogin] Пробуем использовать сохраненные данные...')
      
      // Сначала пробуем использовать сохраненный initData из localStorage
      try {
        const savedInitData = localStorage.getItem('initData_saved')
        if (savedInitData) {
          console.log('[autoLogin] ✅ Найден сохраненный initData в localStorage, используем его')
          initData = savedInitData
        }
      } catch (e) {
        console.warn('[autoLogin] Ошибка при чтении сохраненного initData:', e)
      }
      
      // Если все еще нет initData, пробуем использовать mock данные для dev режима
      if (!initData) {
        console.log('[autoLogin] Сохраненный initData не найден, пробуем mock данные для dev режима...')
        
        // Пробуем получить user_id из localStorage (если был сохранен ранее)
        const savedUserId = localStorage.getItem('dev_user_id')
        if (savedUserId) {
          console.log('[autoLogin] ✅ Найден сохраненный dev_user_id:', savedUserId)
          // Создаем mock initData с user_id в формате, который понимает бэкенд
          initData = `user_id=${savedUserId}&first_name=Dev&last_name=User`
          console.log('[autoLogin] Используем mock initData:', initData)
          // Сохраняем mock initData для последующих запусков
          try {
            localStorage.setItem('initData_saved', initData)
          } catch (e) {
            console.warn('[autoLogin] Не удалось сохранить mock initData:', e)
          }
        } else {
          console.log('[autoLogin] ❌ initData не найден и нет сохраненного dev_user_id')
          console.log('[autoLogin] Для тестирования:')
          console.log('[autoLogin] 1. Откройте мини-приложение через Max бота, или')
          console.log('[autoLogin] 2. В консоли выполните: localStorage.setItem("dev_user_id", "5107783")')
          console.log('[autoLogin]    Затем перезагрузите страницу')
          return false
        }
      }
    }
    
    if (!initData) {
      console.log('[autoLogin] ❌ initData не найден, авторизация невозможна')
      console.log('[autoLogin] Проверьте, что мини-приложение открыто через Max бота')
      if (platformInfo.isIOS) {
        console.log('[autoLogin] iOS: ⚠️ initData не найден, авторизация невозможна')
        console.log('[autoLogin] iOS: Проверьте, что SDK Max загружается правильно')
        console.log('[autoLogin] iOS: Проверьте, что initData приходит через postMessage или SDK')
        console.log('[autoLogin] iOS: Проверьте логи выше для диагностики проблемы')
      }
      return false
    }
    
    console.log('[autoLogin] ✅ initData найден, длина:', initData.length)
    console.log('[autoLogin] Первые 100 символов initData:', initData.substring(0, 100))
    if (platformInfo.isIOS) {
      console.log('[autoLogin] iOS: ✅ initData найден, готов к отправке на сервер')
    }

    // Пытаемся извлечь user_id для логирования
    const userId = extractUserIdFromInitData(initData)
    if (userId) {
      console.log(`[autoLogin] Найден user_id в initData: ${userId}`)
      if (platformInfo.isIOS) {
        console.log(`[autoLogin] iOS: user_id в initData: ${userId}`)
      }
    }

    console.log('[autoLogin] Найден initData, отправляем на сервер для авторизации...')
    console.log('[autoLogin] Backend найдет пользователя в БД (сохранен при bot_started) и вернет токен')
    if (platformInfo.isIOS) {
      console.log('[autoLogin] iOS: Отправка initData на сервер для авторизации...')
    }
    
    // Определяем API URL в зависимости от окружения
    const getApiUrl = (): string => {
      if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL
      }
      if (import.meta.env.DEV) {
        return 'http://localhost:8000'
      }
      return 'https://backend-devcore-max.cloudpub.ru'
    }
    
    const apiUrl = getApiUrl()
    const endpoint = `${apiUrl}/auth/webapp-init`
    console.log('[autoLogin] 📡 Отправляем запрос на:', endpoint)
    console.log('[autoLogin] Метод: POST')
    console.log('[autoLogin] Headers: Content-Type: application/json')
    
    const requestBody = JSON.stringify({ initData })
    console.log('[autoLogin] Body size:', requestBody.length, 'bytes')
    
    // Повторные попытки для временных ошибок сервера
    const MAX_RETRIES = 3
    let lastError: any = null
    
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        if (retry > 0) {
          console.log(`[autoLogin] Повторная попытка ${retry + 1}/${MAX_RETRIES} через 1 секунду...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody
        })
        
        console.log('[autoLogin] 📥 Получен ответ от сервера')
        console.log('[autoLogin] Status:', res.status, res.statusText)
        console.log('[autoLogin] Response URL:', res.url)
        if (platformInfo.isIOS) {
          console.log(`[autoLogin] iOS: Ответ от сервера: ${res.status} ${res.statusText}`)
        }

        if (!res.ok) {
          const errorText = await res.text().catch(() => 'Unknown error')
          console.error(`[autoLogin] Ошибка ответа сервера (попытка ${retry + 1}/${MAX_RETRIES}):`, res.status, errorText)
          if (platformInfo.isIOS) {
            console.error(`[autoLogin] iOS: ⚠️ Ошибка ответа сервера (попытка ${retry + 1}/${MAX_RETRIES}):`, res.status)
            console.error(`[autoLogin] iOS: Текст ошибки:`, errorText.substring(0, 200))
          }
          
          // Проверяем, является ли ошибка временной (502, 503, 504, 429)
          const isTemporaryError = res.status === 502 || res.status === 503 || res.status === 504 || res.status === 429
          
          if (isTemporaryError && retry < MAX_RETRIES - 1) {
            // Временная ошибка - пробуем еще раз
            console.log('[autoLogin] Временная ошибка сервера, повторяем попытку...')
            lastError = { status: res.status, errorText }
            continue
          } else {
            // Постоянная ошибка или все попытки исчерпаны
            if (res.status === 502) {
              console.error('[autoLogin] ❌ 502 Bad Gateway - сервер недоступен или перегружен')
              console.error('[autoLogin] Возможные причины:')
              console.error('[autoLogin] 1. Бэкенд не запущен или упал')
              console.error('[autoLogin] 2. Nginx не может подключиться к бэкенду')
              console.error('[autoLogin] 3. Бэкенд перегружен или не отвечает')
              console.error('[autoLogin] 4. Проблемы с сетью между nginx и бэкендом')
            }
            return false
          }
        }
        
        // Успешный ответ - обрабатываем токен
        const data = await res.json().catch(() => null)
        const token = data?.access_token
        if (!token) {
          console.error('[autoLogin] ❌ Токен не получен в ответе')
          console.error('[autoLogin] Ответ сервера:', data)
          return false
        }
        
        console.log('[autoLogin] ✅ Токен получен от сервера, длина:', token.length)
        console.log('[autoLogin] Первые 50 символов токена:', token.substring(0, 50) + '...')
        if (platformInfo.isIOS) {
          console.log('[autoLogin] iOS: ✅ Токен получен от сервера, готов к сохранению')
        }
        
        // Сохраняем токен в localStorage
        try {
          localStorage.setItem('token', token)
          console.log('[autoLogin] 🔐 Токен сохранен в localStorage')
          if (platformInfo.isIOS) {
            console.log('[autoLogin] iOS: 🔐 Токен сохранен в localStorage')
          }
          
          // Проверяем, что токен действительно сохранен
          const savedToken = localStorage.getItem('token')
          if (!savedToken || savedToken !== token) {
            console.error('[autoLogin] ❌ ОШИБКА: Токен не сохранен правильно в localStorage!')
            console.error('[autoLogin] Ожидаемый токен:', token.substring(0, 50))
            console.error('[autoLogin] Сохраненный токен:', savedToken ? savedToken.substring(0, 50) : 'null')
            if (platformInfo.isIOS) {
              console.error('[autoLogin] iOS: ❌ ОШИБКА: Токен не сохранен правильно в localStorage!')
              console.error('[autoLogin] iOS: Проверьте, что localStorage доступен на iOS')
            }
            return false
          }
          
          console.log('[autoLogin] ✅ Токен успешно сохранен и проверен в localStorage')
          console.log('[autoLogin] Пользователь найден в БД (был сохранен при bot_started)')
          if (platformInfo.isIOS) {
            console.log('[autoLogin] iOS: ✅ Токен успешно сохранен и проверен в localStorage')
            console.log('[autoLogin] iOS: Авторизация успешна на iOS')
          }
          
          // Небольшая задержка для гарантии сохранения токена перед возвратом
          await new Promise(resolve => setTimeout(resolve, 100))
          console.log('[autoLogin] Задержка завершена, токен гарантированно сохранен')
          if (platformInfo.isIOS) {
            console.log('[autoLogin] iOS: Задержка завершена, токен гарантированно сохранен')
          }
          
        } catch (e) {
          console.error('[autoLogin] ❌ Ошибка при сохранении токена в localStorage:', e)
          return false
        }
        
        // Получаем данные пользователя из БД (не критично для авторизации)
        // Временно пропускаем на iOS из-за ошибки с created_at (будет исправлено в backend)
        // После исправления backend можно убрать эту проверку
        if (!platformInfo.isIOS) {
          try {
            console.log('[autoLogin] Запрашиваем данные пользователя из БД...')
            const userRes = await fetch(`${apiUrl}/auth/me`, {
              method: 'GET',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            })
            
            if (userRes.ok) {
              const userData = await userRes.json().catch(() => null)
              if (userData) {
                // Сохраняем данные пользователя в localStorage
                localStorage.setItem('user', JSON.stringify(userData))
                console.log('[autoLogin] ✅ Данные пользователя получены и сохранены:', userData)
                console.log(`[autoLogin] Пользователь: ${userData.username} (ID: ${userData.id}, UUID: ${userData.uuid})`)
              }
            } else {
              console.warn('[autoLogin] ⚠️ Не удалось получить данные пользователя:', userRes.status)
              // Не критично, токен уже сохранен
            }
          } catch (e) {
            console.warn('[autoLogin] ⚠️ Ошибка при получении данных пользователя:', e)
            // Не критично, токен уже сохранен, продолжаем работу
          }
        } else {
          console.log('[autoLogin] iOS: Пропускаем запрос данных пользователя (endpoint /auth/me будет исправлен в backend)')
          console.log('[autoLogin] iOS: Токен сохранен, авторизация успешна')
        }
        
        // Финальная проверка токена перед возвратом
        const finalTokenCheck = localStorage.getItem('token')
        if (!finalTokenCheck) {
          console.error('[autoLogin] ❌ КРИТИЧЕСКАЯ ОШИБКА: Токен исчез из localStorage!')
          return false
        }
        
        console.log('[autoLogin] ✅✅✅ Авторизация успешно завершена! Токен сохранен и проверен.')
        return true
        
      } catch (e) {
        console.error(`[autoLogin] Ошибка при запросе (попытка ${retry + 1}/${MAX_RETRIES}):`, e)
        lastError = e
        
        // Если это не последняя попытка и ошибка сети, пробуем еще раз
        if (retry < MAX_RETRIES - 1) {
          console.log('[autoLogin] Ошибка сети, повторяем попытку...')
          continue
        } else {
          console.error('[autoLogin] ❌ Все попытки исчерпаны, авторизация не удалась')
          return false
        }
      }
    }
    
    // Если дошли сюда, все попытки исчерпаны
    console.error('[autoLogin] ❌ Все попытки авторизации исчерпаны')
    return false
  } catch (e) {
    console.error('[autoLogin] ❌ Исключение:', e)
    return false
  }
}
