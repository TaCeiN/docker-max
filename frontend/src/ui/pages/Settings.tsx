export default function Settings() {
  return (
    <div style={{ padding: 'clamp(16px, 4vw, 24px)' }}>
      <h1 style={{ 
        marginBottom: 'clamp(16px, 4vw, 24px)', 
        fontSize: 'clamp(22px, 6vw, 28px)', 
        fontWeight: 600 
      }}>
        ⚙️ Настройки
      </h1>
      
      <div style={{ 
        padding: 'clamp(16px, 4vw, 24px)', 
        background: 'var(--bg-secondary, var(--bg))', 
        borderRadius: '12px',
        border: '1px solid var(--border)'
      }}>
        <p style={{ 
          color: 'var(--fg-secondary)', 
          fontSize: 'clamp(14px, 4vw, 16px)',
          lineHeight: '1.6',
          margin: 0
        }}>
          Страница настроек находится в разработке. Здесь будут доступны различные параметры приложения.
        </p>
      </div>
    </div>
  )
}

