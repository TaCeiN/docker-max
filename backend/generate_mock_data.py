#!/usr/bin/env python3
"""
Генератор мок-данных для тестирования авторизации.
Создает готовые примеры initData в разных форматах.
"""
import json
from urllib.parse import urlencode, quote

# Примеры пользователей
USERS = [
    {
        "user_id": 5107783,
        "first_name": "Иван",
        "last_name": "Иванов",
        "username": "ivan_ivanov"
    },
    {
        "user_id": 123456,
        "first_name": "Мария",
        "last_name": "Петрова",
        "username": "maria_petrova"
    },
    {
        "user_id": 999999,
        "first_name": "Тест",
        "last_name": "Пользователь",
        "username": None
    }
]


def generate_url_encoded(user: dict) -> str:
    """Генерирует URL-encoded initData"""
    parts = [f"user_id={user['user_id']}"]
    if user.get('first_name'):
        parts.append(f"first_name={quote(user['first_name'])}")
    if user.get('last_name'):
        parts.append(f"last_name={quote(user['last_name'])}")
    if user.get('username'):
        parts.append(f"username={quote(user['username'])}")
    return "&".join(parts)


def generate_json_format(user: dict) -> str:
    """Генерирует JSON initData с объектом user"""
    return json.dumps({
        "user": {
            "user_id": user['user_id'],
            "first_name": user.get('first_name', ''),
            "last_name": user.get('last_name', ''),
            "username": user.get('username', '')
        }
    }, ensure_ascii=False)


def generate_json_flat(user: dict) -> str:
    """Генерирует JSON initData с данными на верхнем уровне"""
    data = {
        "user_id": user['user_id'],
        "first_name": user.get('first_name', ''),
        "last_name": user.get('last_name', ''),
    }
    if user.get('username'):
        data["username"] = user['username']
    return json.dumps(data, ensure_ascii=False)


def generate_url_params(user: dict) -> str:
    """Генерирует URL параметры для прямого использования в браузере"""
    params = {
        "user_id": str(user['user_id']),
    }
    if user.get('first_name'):
        params['first_name'] = user['first_name']
    if user.get('last_name'):
        params['last_name'] = user['last_name']
    if user.get('username'):
        params['username'] = user['username']
    return urlencode(params)


def generate_localstorage_js(user: dict) -> str:
    """Генерирует JavaScript код для localStorage"""
    return f"localStorage.setItem('dev_user_id', '{user['user_id']}'); location.reload();"


def generate_curl_command(user: dict, api_url: str = "http://localhost:8000") -> str:
    """Генерирует curl команду для тестирования"""
    init_data = generate_url_encoded(user)
    return f"""curl -X POST {api_url}/auth/webapp-init \\
  -H "Content-Type: application/json" \\
  -d '{{"initData": "{init_data}"}}'"""


def main():
    print("=" * 80)
    print("ГЕНЕРАТОР МОК-ДАННЫХ ДЛЯ ТЕСТИРОВАНИЯ АВТОРИЗАЦИИ")
    print("=" * 80)
    print()
    
    for i, user in enumerate(USERS, 1):
        print(f"{'=' * 80}")
        print(f"ПОЛЬЗОВАТЕЛЬ {i}: {user['first_name']} {user.get('last_name', '')} (ID: {user['user_id']})")
        print(f"{'=' * 80}")
        print()
        
        # URL-encoded формат
        print("1. URL-encoded формат (рекомендуется):")
        print("   " + generate_url_encoded(user))
        print()
        
        # JSON формат с user объектом
        print("2. JSON формат (с объектом user):")
        print("   " + generate_json_format(user))
        print()
        
        # JSON формат плоский
        print("3. JSON формат (плоский):")
        print("   " + generate_json_flat(user))
        print()
        
        # URL параметры
        print("4. URL параметры (для браузера):")
        print("   https://your-app.com/login?" + generate_url_params(user))
        print()
        
        # localStorage команда
        print("5. JavaScript для localStorage (dev-режим):")
        print("   " + generate_localstorage_js(user))
        print()
        
        # curl команда
        print("6. cURL команда для тестирования backend:")
        print("   " + generate_curl_command(user))
        print()
        
        print()
    
    print("=" * 80)
    print("ИНСТРУКЦИЯ ПО ИСПОЛЬЗОВАНИЮ")
    print("=" * 80)
    print()
    print("1. Для тестирования в браузере:")
    print("   - Откройте консоль (F12)")
    print("   - Выполните команду из пункта 5 (localStorage)")
    print("   - Или откройте URL из пункта 4")
    print()
    print("2. Для тестирования backend:")
    print("   - Скопируйте команду из пункта 6 (curl)")
    print("   - Или используйте скрипт: python test_mock_login.py")
    print()
    print("3. Для тестирования с собственными данными:")
    print("   - Измените значения в переменной USERS в этом файле")
    print("   - Запустите скрипт снова")
    print()


if __name__ == "__main__":
    main()

