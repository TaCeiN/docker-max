"""Миграция: изменение поля notification_time_minutes на notification_times_minutes (JSON)"""
import os
import sqlite3
import json
from pathlib import Path

# Определяем путь к базе данных
db_path = Path(__file__).parent / "data.sqlite3"

if not db_path.exists():
    print("INFO: База данных не найдена. Поле будет создано при следующем запуске сервера.")
    exit(0)

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Проверяем структуру таблицы
    cursor.execute("PRAGMA table_info(user_settings)")
    columns = {col[1]: col for col in cursor.fetchall()}
    
    has_old_column = 'notification_time_minutes' in columns
    has_new_column = 'notification_times_minutes' in columns
    
    if has_new_column:
        print("INFO: Поле notification_times_minutes уже существует в таблице user_settings.")
        conn.close()
        exit(0)
    
    if has_old_column:
        print("INFO: Найдено старое поле notification_time_minutes. Начинаю миграцию...")
        
        # Получаем все записи со старым полем
        cursor.execute("SELECT id, notification_time_minutes FROM user_settings")
        records = cursor.fetchall()
        
        # Создаем новую таблицу с правильной структурой
        print("INFO: Создаю новую таблицу с правильной структурой...")
        cursor.execute("""
            CREATE TABLE user_settings_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                language VARCHAR(2) NOT NULL DEFAULT 'ru',
                theme VARCHAR(10) NOT NULL DEFAULT 'dark',
                notification_times_minutes TEXT NOT NULL DEFAULT '[30]',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        
        # Копируем данные, преобразуя старое значение в JSON массив
        print("INFO: Копирую данные с преобразованием...")
        for record_id, old_value in records:
            # Преобразуем старое значение (Integer) в JSON массив
            if old_value is not None:
                new_value = json.dumps([old_value])
            else:
                new_value = json.dumps([30])  # Значение по умолчанию
            
            # Получаем остальные поля
            cursor.execute("""
                SELECT user_id, language, theme, created_at, updated_at 
                FROM user_settings 
                WHERE id = ?
            """, (record_id,))
            other_fields = cursor.fetchone()
            
            if other_fields:
                cursor.execute("""
                    INSERT INTO user_settings_new 
                    (id, user_id, language, theme, notification_times_minutes, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (record_id, other_fields[0], other_fields[1], other_fields[2], 
                      new_value, other_fields[3], other_fields[4]))
        
        # Удаляем старую таблицу
        print("INFO: Удаляю старую таблицу...")
        cursor.execute("DROP TABLE user_settings")
        
        # Переименовываем новую таблицу
        print("INFO: Переименовываю новую таблицу...")
        cursor.execute("ALTER TABLE user_settings_new RENAME TO user_settings")
        
        # Создаем индексы
        print("INFO: Создаю индексы...")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_user_settings_user_id ON user_settings(user_id)")
        
        conn.commit()
        print("OK: Миграция успешно завершена!")
        print(f"   Преобразовано записей: {len(records)}")
        
    else:
        # Если нет ни старого, ни нового поля, просто добавляем новое
        print("INFO: Добавляю новое поле notification_times_minutes...")
        cursor.execute("""
            ALTER TABLE user_settings 
            ADD COLUMN notification_times_minutes TEXT NOT NULL DEFAULT '[30]'
        """)
        
        # Обновляем существующие записи значением по умолчанию
        cursor.execute("""
            UPDATE user_settings 
            SET notification_times_minutes = '[30]' 
            WHERE notification_times_minutes IS NULL
        """)
        
        conn.commit()
        print("OK: Поле notification_times_minutes успешно добавлено!")
    
    conn.close()
    
except Exception as e:
    print(f"ERROR: Ошибка при миграции: {e}")
    import traceback
    traceback.print_exc()
    conn.rollback()
    conn.close()
    exit(1)

