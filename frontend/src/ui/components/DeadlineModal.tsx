import { useState, useEffect } from 'react'
interface DeadlineModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (deadlineAt: string) => void
  initialDeadline?: string | null
}

export default function DeadlineModal({ open, onClose, onConfirm, initialDeadline }: DeadlineModalProps) {
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [hour, setHour] = useState('00')
  const [minute, setMinute] = useState('00')
  const [error, setError] = useState('')

  // Инициализация полей при открытии модального окна
  useEffect(() => {
    if (open) {
      const now = new Date()
      if (initialDeadline) {
        // Если есть существующий дедлайн, используем его
        const deadlineDate = new Date(initialDeadline)
        setDay(deadlineDate.getDate().toString().padStart(2, '0'))
        setMonth((deadlineDate.getMonth() + 1).toString().padStart(2, '0'))
        setYear(deadlineDate.getFullYear().toString())
        setHour(deadlineDate.getHours().toString().padStart(2, '0'))
        setMinute(deadlineDate.getMinutes().toString().padStart(2, '0'))
      } else {
        // Иначе используем текущую дату
        setDay(now.getDate().toString().padStart(2, '0'))
        setMonth((now.getMonth() + 1).toString().padStart(2, '0'))
        setYear(now.getFullYear().toString())
        setHour('00')
        setMinute('00')
      }
      setError('')
    }
  }, [open, initialDeadline])

  const handleConfirm = () => {
    // Валидация
    if (!day || !month || !year) {
      setError('Заполните все поля даты')
      return
    }

    const dayNum = parseInt(day, 10)
    const monthNum = parseInt(month, 10)
    const yearNum = parseInt(year, 10)
    const hourNum = parseInt(hour, 10)
    const minuteNum = parseInt(minute, 10)

    if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum) || isNaN(hourNum) || isNaN(minuteNum)) {
      setError('Неверный формат данных')
      return
    }

    if (monthNum < 1 || monthNum > 12) {
      setError('Месяц должен быть от 1 до 12')
      return
    }

    if (dayNum < 1 || dayNum > 31) {
      setError('День должен быть от 1 до 31')
      return
    }

    // Проверяем правильность даты (например, 31 февраля не существует)
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate()
    if (dayNum > daysInMonth) {
      setError(`В ${monthNum} месяце ${yearNum} года только ${daysInMonth} ${daysInMonth === 1 ? 'день' : daysInMonth <= 4 ? 'дня' : 'дней'}`)
      return
    }

    if (hourNum < 0 || hourNum > 23) {
      setError('Часы должны быть от 0 до 23')
      return
    }

    if (minuteNum < 0 || minuteNum > 59) {
      setError('Минуты должны быть от 0 до 59')
      return
    }

    // Создаем дату в локальном времени, затем конвертируем в UTC
    const deadlineDate = new Date(yearNum, monthNum - 1, dayNum, hourNum, minuteNum)
    
    // Проверяем, что дата не в прошлом (с небольшим запасом в 1 минуту)
    const now = new Date()
    now.setSeconds(0, 0)  // Обнуляем секунды и миллисекунды для точного сравнения
    if (deadlineDate < now) {
      setError('Дата дедлайна не может быть в прошлом')
      return
    }

    // Форматируем дату в ISO строку (в UTC)
    const deadlineAt = deadlineDate.toISOString()
    
    onConfirm(deadlineAt)
    onClose()
  }

  if (!open) return null

  return (
    <div className="deadline-card" role="dialog" aria-modal="true" aria-labelledby="deadline-card-title">
      <div className="deadline-card__light" />
      <h2 id="deadline-card-title" className="deadline-card__title">
        Выставите дедлайн
      </h2>

      <div className="deadline-card__fields">
        <div className="deadline-card__segment">
          <input
            type="number"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            placeholder="ДД"
            min="1"
            max="31"
            className="deadline-card__input"
          />
          <span className="deadline-card__label">День</span>
        </div>
        <div className="deadline-card__segment">
          <input
            type="number"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="ММ"
            min="1"
            max="12"
            className="deadline-card__input"
          />
          <span className="deadline-card__label">Месяц</span>
        </div>
        <div className="deadline-card__segment">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="ГГГГ"
            min={new Date().getFullYear()}
            className="deadline-card__input deadline-card__input--year"
          />
          <span className="deadline-card__label">Год</span>
        </div>
        <div className="deadline-card__segment deadline-card__segment--time">
          <div className="deadline-card__time-inputs">
            <input
              type="number"
              value={hour}
              onChange={(e) => setHour(e.target.value.padStart(2, '0'))}
              placeholder="ЧЧ"
              min="0"
              max="23"
              className="deadline-card__input deadline-card__input--compact"
            />
            <span className="deadline-card__time-colon">:</span>
            <input
              type="number"
              value={minute}
              onChange={(e) => setMinute(e.target.value.padStart(2, '0'))}
              placeholder="ММ"
              min="0"
              max="59"
              className="deadline-card__input deadline-card__input--compact"
            />
          </div>
          <span className="deadline-card__label">Время</span>
        </div>
      </div>

      {error && (
        <div className="deadline-card__error">
          {error}
        </div>
      )}

      <div className="deadline-card__actions">
        <button
          type="button"
          onClick={handleConfirm}
          className="deadline-card__action deadline-card__action--confirm"
          aria-label="Подтвердить дедлайн"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12L10 17L19 8" stroke="#050507" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="deadline-card__action deadline-card__action--cancel"
          aria-label="Отменить создание дедлайна"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6L18 18M18 6L6 18" stroke="#050507" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

