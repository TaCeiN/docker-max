import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type Deadline } from '../../api/client'

interface CalendarPopupProps {
  open: boolean
  onClose: () => void
}

type CalendarDay = {
  date: Date
  day: number
  isCurrentMonth: boolean
  hasNotification: boolean
  deadlines: Deadline[]
}

export default function CalendarPopup({ open, onClose }: CalendarPopupProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  // Загружаем все дедлайны
  const { data: deadlines } = useQuery<Deadline[]>({
    queryKey: ['deadlines'],
    queryFn: () => api<Deadline[]>('/api/deadlines'),
    enabled: open
  })

  // Создаем карту дедлайнов по датам
  const deadlinesByDate = useMemo(() => {
    const map = new Map<string, Deadline[]>()
    if (deadlines) {
      deadlines.forEach(deadline => {
        const date = new Date(deadline.deadline_at)
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
        if (!map.has(dateKey)) {
          map.set(dateKey, [])
        }
        map.get(dateKey)!.push(deadline)
      })
    }
    return map
  }, [deadlines])

  // Генерируем календарную сетку
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const firstDayOfWeek = firstDay.getDay()
    const daysInMonth = lastDay.getDate()
    
    // Начинаем с понедельника (0 = воскресенье, 1 = понедельник)
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
    
    const days: CalendarDay[] = []
    
    // Дни предыдущего месяца
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    for (let i = startOffset - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i)
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      const dayDeadlines = deadlinesByDate.get(dateKey) || []
      days.push({
        date,
        day: prevMonthLastDay - i,
        isCurrentMonth: false,
        hasNotification: dayDeadlines.length > 0,
        deadlines: dayDeadlines
      })
    }
    
    // Дни текущего месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      const dayDeadlines = deadlinesByDate.get(dateKey) || []
      days.push({
        date,
        day,
        isCurrentMonth: true,
        hasNotification: dayDeadlines.length > 0,
        deadlines: dayDeadlines
      })
    }
    
    // Дни следующего месяца (до 42 дней всего)
    const totalDays = days.length
    const remainingDays = 42 - totalDays
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day)
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      const dayDeadlines = deadlinesByDate.get(dateKey) || []
      days.push({
        date,
        day,
        isCurrentMonth: false,
        hasNotification: dayDeadlines.length > 0,
        deadlines: dayDeadlines
      })
    }
    
    return days
  }, [currentDate, deadlinesByDate])

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ]

  const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  // Закрытие по клику вне календаря обрабатывается через backdrop

  // Блокируем скролл при открытом календаре
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <>
      {/* Backdrop с размытием */}
      <div className="calendar-popup__backdrop" onClick={onClose} />
      
      {/* Календарь */}
      <div className="calendar-popup calendar-popup--open">
        <div>
          <div className="calendar-popup__light" />
          
          {/* Кнопка закрытия */}
          <button
            className="calendar-popup__close"
            onClick={onClose}
            aria-label="Закрыть календарь"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {/* Заголовок */}
          <div className="calendar-popup__header">
            <h2 className="calendar-popup__title">Календарь уведомлений</h2>
          </div>

          {/* Месяц и год */}
          <div className="calendar-popup__month-year">
            {monthNames[currentDate.getMonth()]}, {currentDate.getFullYear()}
          </div>

          {/* Навигация по месяцам */}
          <div className="calendar-popup__navigation">
            <button
              className="calendar-popup__nav-button"
              onClick={handlePrevMonth}
              aria-label="Предыдущий месяц"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="calendar-popup__nav-button"
              onClick={handleNextMonth}
              aria-label="Следующий месяц"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Дни недели */}
          <div className="calendar-popup__weekdays">
            {dayNames.map(day => (
              <div key={day} className="calendar-popup__weekday">
                {day}
              </div>
            ))}
          </div>

          {/* Календарная сетка */}
          <div className="calendar-popup__grid">
            {calendarDays.map((calendarDay, index) => (
              <div
                key={index}
                className={`calendar-popup__day ${
                  !calendarDay.isCurrentMonth ? 'calendar-popup__day--other-month' : ''
                } ${calendarDay.hasNotification ? 'calendar-popup__day--has-notification' : ''}`}
              >
              <span className="calendar-popup__day-number">{calendarDay.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

