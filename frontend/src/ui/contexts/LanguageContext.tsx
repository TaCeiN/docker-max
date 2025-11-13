import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../../api/client'

type Language = 'ru' | 'en'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => Promise<void>
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

// Заглушки для переводов (будут заменены на реальные)
const translations: Record<Language, Record<string, string>> = {
  ru: {},
  en: {}
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Загружаем язык из localStorage или используем русский по умолчанию
    const saved = localStorage.getItem('language') as Language
    return saved && (saved === 'ru' || saved === 'en') ? saved : 'ru'
  })
  const [translationsData, setTranslationsData] = useState<Record<string, string>>({})

  // Загружаем настройки из backend при монтировании
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await api<{ language: Language }>('/api/settings')
        if (settings.language && (settings.language === 'ru' || settings.language === 'en')) {
          setLanguageState(settings.language)
          localStorage.setItem('language', settings.language)
        }
      } catch (error) {
        console.error('Failed to load language settings:', error)
        // Используем язык из localStorage
      }
    }
    loadSettings()
  }, [])

  // Загружаем переводы для текущего языка
  useEffect(() => {
    import(`../locales/${language}.ts`).then((module) => {
      setTranslationsData(module.default || {})
    }).catch((error) => {
      console.error(`Failed to load translations for ${language}:`, error)
      setTranslationsData({})
    })
  }, [language])

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('language', lang)
    
    // Синхронизируем с backend
    try {
      await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ language: lang })
      })
    } catch (error) {
      console.error('Failed to save language to backend:', error)
    }
  }

  const t = (key: string): string => {
    return translationsData[key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

