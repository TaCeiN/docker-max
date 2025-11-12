import { createContext, useContext, useState, ReactNode } from 'react'

interface NotesContextType {
  searchQuery: string
  setSearchQuery: (query: string) => void
  handleCreateNote: () => void
  setHandleCreateNote: (handler: () => void) => void
  isNoteEditorOpen: boolean
  setIsNoteEditorOpen: (isOpen: boolean) => void
  handleSaveNote: () => Promise<void>
  setHandleSaveNote: (handler: () => Promise<void>) => void
  closeNoteEditor: (forceShowAllNotes?: boolean) => Promise<void> | void
  setCloseNoteEditor: (handler: (forceShowAllNotes?: boolean) => Promise<void> | void) => void
}

const NotesContext = createContext<NotesContextType | undefined>(undefined)

export function NotesProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [handleCreateNote, setHandleCreateNote] = useState<() => void>(() => () => {})
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false)
  const [handleSaveNote, setHandleSaveNote] = useState<() => Promise<void>>(() => async () => {})
  const [closeNoteEditor, setCloseNoteEditor] = useState<(forceShowAllNotes?: boolean) => Promise<void> | void>(() => () => {})

  return (
    <NotesContext.Provider value={{ 
      searchQuery, 
      setSearchQuery, 
      handleCreateNote, 
      setHandleCreateNote,
      isNoteEditorOpen,
      setIsNoteEditorOpen,
      handleSaveNote,
      setHandleSaveNote,
      closeNoteEditor,
      setCloseNoteEditor
    }}>
      {children}
    </NotesContext.Provider>
  )
}

export function useNotesContext() {
  const context = useContext(NotesContext)
  if (context === undefined) {
    throw new Error('useNotesContext must be used within a NotesProvider')
  }
  return context
}

