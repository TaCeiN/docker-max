import { useNotesContext } from '../contexts/NotesContext'

export default function NotesSearchBar() {
  const { searchQuery, setSearchQuery, handleCreateNote } = useNotesContext()

  return (
    <div className="notes-search-bar" style={{ 
      position: 'fixed',
      bottom: '80px',
      left: '16px',
      right: '16px',
      display: 'flex', 
      alignItems: 'center', 
      padding: '12px 16px', 
      gap: '12px',
      background: 'var(--bg)',
      borderRadius: '16px',
      border: '1px solid var(--border)',
      zIndex: 99,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    }}>
      <input
        type="text"
        placeholder="🔍 Поиск"
        className="notes-search-input-full"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        style={{ 
          flex: 1, 
          background: 'transparent',
          border: 'none',
          color: 'var(--fg)', 
          fontSize: '16px',
          outline: 'none'
        }}
      />
      <span 
        className="notes-search-icon" 
        onClick={handleCreateNote}
        style={{ 
          cursor: 'pointer', 
          fontSize: '20px', 
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Создать новую заметку"
      >
        📄
      </span>
    </div>
  )
}

