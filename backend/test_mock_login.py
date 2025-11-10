#!/usr/bin/env python3
"""
Скрипт для тестирования авторизации с мок-данными.
Позволяет проверить работу /auth/webapp-init без реального Max бота.
"""
import requests
import json
import sys

# Настройки
API_URL = "http://localhost:8000"  # Измените на ваш URL
ENDPOINT = f"{API_URL}/auth/webapp-init"

# Примеры мок-данных
MOCK_DATA_EXAMPLES = {
    "example1": {
        "name": "Базовый пользователь (URL-encoded)",
        "initData": "user_id=5107783&first_name=Иван&last_name=Иванов&username=ivan_ivanov"
    },
    "example2": {
        "name": "Пользователь без username",
        "initData": "user_id=5107783&first_name=Иван&last_name=Иванов"
    },
    "example3": {
        "name": "Минимальные данные (только user_id)",
        "initData": "user_id=5107783"
    },
    "example4": {
        "name": "JSON формат",
        "initData": json.dumps({
            "user": {
                "user_id": 5107783,
                "first_name": "Иван",
                "last_name": "Иванов",
                "username": "ivan_ivanov"
            }
        })
    },
    "example5": {
        "name": "JSON с данными на верхнем уровне",
        "initData": json.dumps({
            "user_id": 5107783,
            "first_name": "Иван",
            "last_name": "Иванов",
            "username": "ivan_ivanov"
        })
    }
}


def test_login(init_data: str, example_name: str = "Custom"):
    """Тестирует авторизацию с указанным initData"""
    print("=" * 60)
    print(f"Тест: {example_name}")
    print("=" * 60)
    print(f"Endpoint: {ENDPOINT}")
    print(f"initData: {init_data[:100]}..." if len(init_data) > 100 else f"initData: {init_data}")
    print()
    
    try:
        response = requests.post(
            ENDPOINT,
            json={"initData": init_data},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        print()
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            if token:
                print("✅ УСПЕХ! Токен получен")
                print(f"Token (первые 50 символов): {token[:50]}...")
                print()
                print("Теперь можно использовать этот токен для запросов:")
                print(f"Authorization: Bearer {token}")
            else:
                print("❌ ОШИБКА: Токен не найден в ответе")
                print(f"Response: {data}")
        else:
            print(f"❌ ОШИБКА: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error: {error_data}")
            except:
                print(f"Error (text): {response.text}")
        
        print()
        return response.status_code == 200
        
    except requests.exceptions.ConnectionError:
        print("❌ ОШИБКА: Не удалось подключиться к серверу")
        print(f"Убедитесь, что backend запущен на {API_URL}")
        print()
        return False
    except Exception as e:
        print(f"❌ ОШИБКА: {e}")
        print()
        return False


def main():
    """Главная функция"""
    print("=" * 60)
    print("ТЕСТИРОВАНИЕ АВТОРИЗАЦИИ С МОК-ДАННЫМИ")
    print("=" * 60)
    print()
    
    # Если передан аргумент командной строки - используем его как initData
    if len(sys.argv) > 1:
        custom_init_data = sys.argv[1]
        test_login(custom_init_data, "Custom (from command line)")
        return
    
    # Иначе показываем меню
    print("Доступные примеры:")
    print()
    for key, example in MOCK_DATA_EXAMPLES.items():
        print(f"  {key}: {example['name']}")
    print()
    print("Использование:")
    print(f"  python {sys.argv[0]} <example_key>  # Запустить конкретный пример")
    print(f"  python {sys.argv[0]} <initData>     # Использовать свой initData")
    print()
    
    # Запускаем все примеры
    print("Запускаем все примеры...")
    print()
    
    results = []
    for key, example in MOCK_DATA_EXAMPLES.items():
        success = test_login(example['initData'], example['name'])
        results.append((key, success))
    
    # Итоги
    print("=" * 60)
    print("ИТОГИ")
    print("=" * 60)
    for key, success in results:
        status = "✅ УСПЕХ" if success else "❌ ОШИБКА"
        print(f"  {key}: {status}")
    print()


if __name__ == "__main__":
    main()

