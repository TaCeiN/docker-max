import { useState } from 'react'
import { createTag } from '../../api/client'

export type Tag = { id: number; name: string }

export default function TagSelector({
  available,
  selectedIds,
  onChange,
}: {
  available: Tag[]
  selectedIds: number[]
  onChange: (ids: number[]) => void
}) {
  const [input, setInput] = useState('')

  const selected = available.filter(t => selectedIds.includes(t.id))
  const notSelected = available.filter(t => !selectedIds.includes(t.id))

  async function addTagByName(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    const existing = available.find(t => t.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      if (!selectedIds.includes(existing.id)) onChange([...selectedIds, existing.id])
      setInput('')
      return
    }
    try {
      const created = await createTag(trimmed)
      onChange([...selectedIds, created.id])
      setInput('')
    } catch (e) {
      // fallback: just clear
      setInput('')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {selected.map(tag => (
          <span key={tag.id} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            #{tag.name}
            <button
              className="btn"
              style={{ padding: '0 6px', fontSize: 12 }}
              onClick={() => onChange(selectedIds.filter(id => id !== tag.id))}
              aria-label={`Remove ${tag.name}`}
            >×</button>
          </span>
        ))}
      </div>
      <input
        type="text"
        placeholder="Добавить тег (Enter)"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTagByName(input) } }}
        list="tag-suggestions"
      />
      <datalist id="tag-suggestions">
        {notSelected.map(t => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>
    </div>
  )
}


