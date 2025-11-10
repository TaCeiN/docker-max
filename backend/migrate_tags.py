"""
Скрипт для миграции структуры тегов.
Удаляет старые таблицы и создает новые с правильной структурой.
"""
import os
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data.sqlite3"

def migrate_tags():
    """Мигрирует структуру тегов в базе данных"""
    if not DB_PATH.exists():
        print("База данных не найдена. Создайте её через обычный запуск приложения.")
        return
    
    print("Начинаю миграцию структуры тегов...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Удаляем старые промежуточные таблицы
        print("Удаляю старые промежуточные таблицы...")
        cursor.execute("DROP TABLE IF EXISTS task_tag")
        cursor.execute("DROP TABLE IF EXISTS note_tag")
        
        # Удаляем старую таблицу тегов
        print("Удаляю старую таблицу тегов...")
        cursor.execute("DROP TABLE IF EXISTS tags")
        
        # Создаем новую таблицу тегов
        print("Создаю новую таблицу тегов...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(64) NOT NULL UNIQUE,
                color VARCHAR(7)
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_tags_name ON tags(name)")
        
        # Создаем новые промежуточные таблицы с CASCADE
        print("Создаю новые промежуточные таблицы...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS task_tag (
                task_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (task_id, tag_id),
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS note_tag (
                note_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (note_id, tag_id),
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )
        """)
        
        conn.commit()
        print("OK: Миграция завершена успешно!")
        
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Ошибка при миграции: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_tags()

