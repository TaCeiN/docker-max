import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUserSettings, updateUserSettings, UserSettings } from '../../api/client'
import { faqData, privacyPolicy, termsOfService, type FAQItem } from '../../utils/faq'

export default function Settings() {
  const queryClient = useQueryClient()
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const language = 'ru' // Фиксированный русский язык

  const { data: settings, isLoading } = useQuery({
    queryKey: ['userSettings'],
    queryFn: getUserSettings
  })

  const updateSettings = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] })
    }
  })

  const [newNotificationTime, setNewNotificationTime] = useState<string>('')

  const handleAddNotificationTime = () => {
    const minutes = parseInt(newNotificationTime)
    if (isNaN(minutes) || minutes < 0) {
      alert('Введите корректное число минут (неотрицательное)')
      return
    }
    const currentTimes = settings?.notification_times_minutes || []
    if (currentTimes.length >= 10) {
      alert('Максимум 10 времен уведомлений')
      return
    }
    if (currentTimes.includes(minutes)) {
      alert('Это время уже добавлено')
      return
    }
    const newTimes = [...currentTimes, minutes].sort((a, b) => b - a) // Сортируем по убыванию
    updateSettings.mutate({ notification_times_minutes: newTimes })
    setNewNotificationTime('')
  }

  const handleRemoveNotificationTime = (minutes: number) => {
    const currentTimes = settings?.notification_times_minutes || []
    const newTimes = currentTimes.filter(t => t !== minutes)
    updateSettings.mutate({ notification_times_minutes: newTimes })
  }

  const formatTime = (minutes: number): string => {
    if (minutes >= 24 * 60) {
      const days = Math.floor(minutes / (24 * 60))
      const remainingMinutes = minutes % (24 * 60)
      const hours = Math.floor(remainingMinutes / 60)
      const mins = remainingMinutes % 60
      
      let result = `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`
      if (hours > 0) {
        result += ` ${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`
      }
      if (mins > 0) {
        result += ` ${mins} ${mins === 1 ? 'минута' : mins < 5 ? 'минуты' : 'минут'}`
      }
      return result
    } else if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      
      let result = `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`
      if (mins > 0) {
        result += ` ${mins} ${mins === 1 ? 'минута' : mins < 5 ? 'минуты' : 'минут'}`
      }
      return result
    } else {
      return `${minutes} ${minutes === 1 ? 'минута' : minutes < 5 ? 'минуты' : 'минут'}`
    }
  }

  if (isLoading) {
    return (
      <main className="screen">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Загрузка...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="screen">
      <div className="settings-container">
        <h1 className="settings-title">Настройки</h1>

        {/* Уведомления */}
        <div className="settings-section">
          <h2 className="settings-section-title">Уведомления</h2>
          <p className="settings-description" style={{ marginBottom: '16px' }}>
            Добавьте времена (в минутах), за которые вы хотите получать уведомления о дедлайнах (максимум 10)
          </p>
          
          {/* Добавление нового времени */}
          <div className="notification-time-add" style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
            <input
              type="number"
              min="0"
              placeholder="Минуты до дедлайна"
              value={newNotificationTime}
              onChange={(e) => setNewNotificationTime(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddNotificationTime()
                }
              }}
              className="settings-input"
              style={{ flex: '1 1 auto', minWidth: '120px', maxWidth: '200px' }}
            />
            <button
              className="settings-option"
              onClick={handleAddNotificationTime}
              disabled={(settings?.notification_times_minutes?.length || 0) >= 10}
              style={{ flex: '0 0 auto', minWidth: '100px' }}
            >
              Добавить
            </button>
          </div>
          
          {/* Список выбранных времен */}
          {settings?.notification_times_minutes && settings.notification_times_minutes.length > 0 && (
            <div className="notification-times-list">
              {settings.notification_times_minutes.map((minutes) => (
                <div key={minutes} className="notification-time-item">
                  <span>{formatTime(minutes)}</span>
                  <button
                    className="notification-time-remove"
                    onClick={() => handleRemoveNotificationTime(minutes)}
                    title="Удалить"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FAQ */}
        <div className="settings-section">
          <h2 className="settings-section-title">Часто задаваемые вопросы</h2>
          <div className="faq-list">
            {faqData[language].map((item: FAQItem, index: number) => (
              <div key={index} className="faq-item">
                <button
                  className="faq-question"
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                >
                  {item.question}
                  <span className="faq-toggle">{expandedFaq === index ? '−' : '+'}</span>
                </button>
                {expandedFaq === index && (
                  <div className="faq-answer">{item.answer}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Политика конфиденциальности */}
        <div className="settings-section">
          <button
            className="settings-link-button"
            onClick={() => setShowPrivacy(true)}
          >
            Политика конфиденциальности
          </button>
        </div>

        {/* Пользовательское соглашение */}
        <div className="settings-section">
          <button
            className="settings-link-button"
            onClick={() => setShowTerms(true)}
          >
            Пользовательское соглашение
          </button>
        </div>

        {/* О приложении */}
        <div className="settings-section">
          <h2 className="settings-section-title">О приложении</h2>
          <div className="settings-about">
            <p className="settings-about-text">Приложение для управления заметками и задачами с поддержкой дедлайнов и уведомлений.</p>
            <p className="settings-about-version">
              Версия: 1.0.0
            </p>
          </div>
        </div>
      </div>

      {/* Модальное окно политики конфиденциальности */}
      {showPrivacy && (
        <div className="modal-overlay" onClick={() => setShowPrivacy(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Политика конфиденциальности</h2>
              <button className="modal-close" onClick={() => setShowPrivacy(false)}>×</button>
            </div>
            <div className="modal-body">
              <pre className="modal-text">{privacyPolicy[language]}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно пользовательского соглашения */}
      {showTerms && (
        <div className="modal-overlay" onClick={() => setShowTerms(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Пользовательское соглашение</h2>
              <button className="modal-close" onClick={() => setShowTerms(false)}>×</button>
            </div>
            <div className="modal-body">
              <pre className="modal-text">{termsOfService[language]}</pre>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
