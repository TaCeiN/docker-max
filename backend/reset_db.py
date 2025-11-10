"""Скрипт для полного сброса базы данных"""
import os
import sqlite3
import time
import sys
import glob

# Путь к БД
db_path = os.path.join(os.path.dirname(__file__), "data.sqlite3")

# Также ищем все возможные файлы БД
db_files = [
    db_path,
    os.path.join(os.path.dirname(__file__), "*.sqlite3"),
    os.path.join(os.path.dirname(__file__), "*.sqlite"),
    os.path.join(os.path.dirname(__file__), "*.db"),
]

print("=" * 60)
print("ПОЛНЫЙ СБРОС БАЗЫ ДАННЫХ")
print("=" * 60)

# Находим все файлы БД
found_files = []
for pattern in db_files:
    if os.path.exists(pattern):
        found_files.append(pattern)
    # Проверяем через glob
    for f in glob.glob(pattern):
        if os.path.isfile(f) and f not in found_files:
            found_files.append(f)

# Удаляем основной файл БД
if os.path.exists(db_path):
    found_files.append(db_path)

# Удаляем дубликаты
found_files = list(set(found_files))

if found_files:
    print(f"Найдено файлов БД: {len(found_files)}")
    for db_file in found_files:
        print(f"  - {db_file}")
    print()
    
    for db_file in found_files:
        if not os.path.exists(db_file):
            continue
            
        try:
            # Пытаемся закрыть все соединения через WAL checkpoint
            print(f"1. Закрываем соединения с {os.path.basename(db_file)}...")
            try:
                conn = sqlite3.connect(db_file, timeout=1.0)
                conn.execute("PRAGMA journal_mode=DELETE")
                conn.execute("PRAGMA wal_checkpoint(FULL)")
                conn.close()
                print("   ✓ Соединения закрыты")
            except Exception as e:
                print(f"   ⚠ Предупреждение: {e}")
            
            # Небольшая задержка
            time.sleep(0.5)
            
            # Пытаемся удалить файл несколько раз
            print(f"2. Удаляем {os.path.basename(db_file)}...")
            max_attempts = 5
            deleted = False
            for attempt in range(max_attempts):
                try:
                    if os.path.exists(db_file):
                        os.remove(db_file)
                        print(f"   ✓ Файл {os.path.basename(db_file)} успешно удален!")
                        deleted = True
                        break
                    else:
                        deleted = True
                        break
                except PermissionError:
                    if attempt < max_attempts - 1:
                        print(f"   ⚠ Попытка {attempt + 1}/{max_attempts}: Файл заблокирован, ждем...")
                        time.sleep(1)
                    else:
                        print(f"   ❌ ОШИБКА: Файл {os.path.basename(db_file)} заблокирован!")
                        print("   Убедитесь, что:")
                        print("   - Backend сервер остановлен (Ctrl+C)")
                        print("   - Webhook сервер остановлен (Ctrl+C)")
                        print("   - Все программы, использующие БД, закрыты")
                except Exception as e:
                    print(f"   ❌ ОШИБКА при удалении {os.path.basename(db_file)}: {e}")
            
            if not deleted:
                sys.exit(1)
                
        except Exception as e:
            print(f"❌ ОШИБКА при обработке {os.path.basename(db_file)}: {e}")
            sys.exit(1)
else:
    print("ℹ Файлы базы данных не найдены (уже удалены или не созданы)")

# Проверяем, что все файлы действительно удалены
time.sleep(0.2)
all_deleted = True
for db_file in found_files:
    if os.path.exists(db_file):
        print(f"❌ ОШИБКА: Файл {os.path.basename(db_file)} все еще существует!")
        all_deleted = False

# Проверяем основной файл
if os.path.exists(db_path):
    print(f"❌ ОШИБКА: Основной файл БД все еще существует!")
    all_deleted = False

if all_deleted:
    print("=" * 60)
    print("✅ БАЗА ДАННЫХ ПОЛНОСТЬЮ УДАЛЕНА")
    print("=" * 60)
    print("При следующем запуске сервера база будет создана заново")
    print("с пустыми таблицами.")
    print()
    print("⚠ ВАЖНО: Убедитесь, что оба сервера остановлены:")
    print("   - Backend сервер (app/main.py)")
    print("   - Webhook сервер (webhook_server.py)")
else:
    print("=" * 60)
    print("❌ НЕ ВСЕ ФАЙЛЫ БД УДАЛЕНЫ")
    print("=" * 60)
    print("Остановите все серверы и запустите скрипт снова.")
    sys.exit(1)
