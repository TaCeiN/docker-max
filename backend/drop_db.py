#!/usr/bin/env python3
"""Полный сброс базы данных - удаляет все файлы БД"""
import os
import sqlite3
import time
import glob

db_path = os.path.join(os.path.dirname(__file__), "data.sqlite3")

print("=" * 60)
print("ПОЛНЫЙ СБРОС БАЗЫ ДАННЫХ")
print("=" * 60)

# Находим все возможные файлы БД
all_db_files = []
if os.path.exists(db_path):
    all_db_files.append(db_path)

# Ищем через glob
for pattern in ["*.sqlite3", "*.sqlite", "*.db"]:
    for f in glob.glob(os.path.join(os.path.dirname(__file__), pattern)):
        if os.path.isfile(f) and f not in all_db_files:
            all_db_files.append(f)

if not all_db_files:
    print("✓ Файлы БД не найдены (уже удалены)")
    print("=" * 60)
    exit(0)

print(f"Найдено файлов БД: {len(all_db_files)}")
for db_file in all_db_files:
    print(f"  - {os.path.basename(db_file)}")

for db_file in all_db_files:
    if not os.path.exists(db_file):
        continue
    
    print(f"\nОбработка: {os.path.basename(db_file)}")
    
    # Закрываем соединения
    try:
        conn = sqlite3.connect(db_file, timeout=1.0)
        conn.execute("PRAGMA journal_mode=DELETE")
        conn.execute("PRAGMA wal_checkpoint(FULL)")
        conn.close()
        print("  ✓ Соединения закрыты")
    except:
        pass
    
    time.sleep(0.3)
    
    # Удаляем файл
    max_attempts = 5
    for attempt in range(max_attempts):
        try:
            if os.path.exists(db_file):
                os.remove(db_file)
                print(f"  ✓ Файл удален")
                break
        except PermissionError:
            if attempt < max_attempts - 1:
                print(f"  ⚠ Попытка {attempt + 1}/{max_attempts}: файл заблокирован...")
                time.sleep(1)
            else:
                print(f"  ❌ ОШИБКА: файл заблокирован!")
                print("     Остановите все серверы (backend и webhook_server)")
                exit(1)
        except Exception as e:
            print(f"  ❌ ОШИБКА: {e}")
            exit(1)

# Финальная проверка
time.sleep(0.2)
if os.path.exists(db_path):
    print(f"\n❌ ОШИБКА: Файл {os.path.basename(db_path)} все еще существует!")
    exit(1)

print("\n" + "=" * 60)
print("✅ БАЗА ДАННЫХ ПОЛНОСТЬЮ УДАЛЕНА")
print("=" * 60)
print("При следующем запуске сервера база будет создана заново")
print("с пустыми таблицами.")

