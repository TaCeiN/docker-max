"""Миграция: добавление поля is_favorite в таблицу notes"""
import os
import sqlite3

db_path = os.path.join(os.path.dirname(__file__), "data.sqlite3")

if not os.path.exists(db_path):
    print("INFO: База данных не найдена. Поле будет создано при следующем запуске сервера.")
    exit(0)

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Проверяем, существует ли уже поле is_favorite
    cursor.execute("PRAGMA table_info(notes)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'is_favorite' in columns:
        print("INFO: Поле is_favorite уже существует в таблице notes.")
    else:
        # Добавляем поле is_favorite
        cursor.execute("ALTER TABLE notes ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT 0")
        # Создаем индекс для быстрого поиска
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_notes_is_favorite ON notes(is_favorite)")
        conn.commit()
        print("OK: Поле is_favorite успешно добавлено в таблицу notes!")
        print("   Индекс для is_favorite создан.")
    
    conn.close()
except Exception as e:
    print(f"ERROR: Ошибка при миграции: {e}")
    exit(1)

