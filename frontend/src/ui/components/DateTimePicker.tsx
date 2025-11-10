import { useState, useEffect } from 'react'

export default function DateTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const getDatePart = (v: string) => v ? v.split('T')[0] : ''
  const getTimePart = (v: string) => {
    if (!v) return ''
    const parts = v.split('T')
    if (parts.length > 1) {
      return parts[1].slice(0, 5)
    }
    return ''
  }

  const [date, setDate] = useState(getDatePart(value))
  const [time, setTime] = useState(getTimePart(value))

  useEffect(() => {
    setDate(getDatePart(value))
    setTime(getTimePart(value))
  }, [value])

  const handleDateChange = (d: string) => {
    setDate(d)
    if (d && time) {
      onChange(`${d}T${time}:00`)
    } else if (d) {
      onChange(`${d}T00:00:00`)
    } else {
      onChange('')
    }
  }

  const handleTimeChange = (t: string) => {
    setTime(t)
    if (date && t) {
      onChange(`${date}T${t}:00`)
    } else if (date) {
      onChange(`${date}T00:00:00`)
    } else {
      onChange('')
    }
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
      <div style={{ flex: 1 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 4 }}>Дата</label>
        <input
          type="date"
          value={date}
          onChange={e => handleDateChange(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', fontSize: 14, background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 3 }}
        />
      </div>
      <div style={{ flex: 1 }}>
        <label style={{ display: 'block', fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 4 }}>Время (24ч)</label>
        <input
          type="time"
          value={time}
          onChange={e => handleTimeChange(e.target.value)}
          step="60"
          style={{ width: '100%', padding: '8px 10px', fontSize: 14, background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 3 }}
        />
      </div>
    </div>
  )
}
