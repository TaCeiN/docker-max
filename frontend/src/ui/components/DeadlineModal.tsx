import { useState, useEffect } from 'react'
import Modal from './Modal'

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

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ padding: '20px', minWidth: '300px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: 'rgba(255, 255, 255, 0.9)' }}>
          {initialDeadline ? 'Изменить дедлайн' : 'Создать дедлайн'}
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ minWidth: '80px', color: 'rgba(255, 255, 255, 0.7)' }}>День:</label>
            <input
              type="number"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              placeholder="День"
              min="1"
              max="31"
              style={{
                flex: 1,
                padding: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ minWidth: '80px', color: 'rgba(255, 255, 255, 0.7)' }}>Месяц:</label>
            <input
              type="number"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              placeholder="Месяц"
              min="1"
              max="12"
              style={{
                flex: 1,
                padding: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ minWidth: '80px', color: 'rgba(255, 255, 255, 0.7)' }}>Год:</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Год"
              min={new Date().getFullYear()}
              style={{
                flex: 1,
                padding: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ minWidth: '80px', color: 'rgba(255, 255, 255, 0.7)' }}>Время:</label>
            <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
              <input
                type="number"
                value={hour}
                onChange={(e) => setHour(e.target.value.padStart(2, '0'))}
                placeholder="Час"
                min="0"
                max="23"
                style={{
                  flex: 1,
                  padding: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '14px'
                }}
              />
              <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>:</span>
              <input
                type="number"
                value={minute}
                onChange={(e) => setMinute(e.target.value.padStart(2, '0'))}
                placeholder="Мин"
                min="0"
                max="59"
                style={{
                  flex: 1,
                  padding: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
          
          {error && (
            <div style={{ color: '#ff6b6b', fontSize: '14px', marginTop: '-8px' }}>
              {error}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                color: 'rgba(255, 255, 255, 0.9)',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ✕ Отменить
            </button>
            <button
              onClick={handleConfirm}
              style={{
                padding: '8px 16px',
                background: '#4a90e2',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ✓ Подтвердить
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

