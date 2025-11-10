#!/usr/bin/env python3
"""
Скрипт для подписки бота на вебхуки Max Bot API.
Использование:
    python subscribe_webhook.py
Или с указанием токена:
    MAX_BOT_TOKEN=your_token python subscribe_webhook.py
"""
import os
import sys
import requests
import json
from app.core.config import settings

# URL для подписки на вебхуки
MAX_API_URL = "https://platform-api.max.ru"
# Для локальной разработки используйте ngrok или другой туннель
# Например: WEBHOOK_URL = "https://your-ngrok-url.ngrok.io/webhook"
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "https://webhook-devcore-max.cloudpub.ru/")

# Типы обновлений, на которые подписываемся
UPDATE_TYPES = [
    "message_created",
    "message_callback",
    "bot_started",
    "bot_stopped",
    "message_edited",
    "message_removed",
    "bot_added",
    "bot_removed",
    "user_added",
    "user_removed",
]


def subscribe_webhook():
    """Подписывает бота на вебхуки."""
    token = settings.max_bot_token
    if not token:
        print("ОШИБКА: Токен бота не установлен!")
        print("Установите переменную окружения MAX_BOT_TOKEN")
        print("Пример: export MAX_BOT_TOKEN=your_token_here")
        sys.exit(1)

    # Проверяем текущие подписки
    print(f"Проверяем текущие подписки...")
    response = requests.get(
        f"{MAX_API_URL}/subscriptions",
        params={"access_token": token}
    )
    
    if response.status_code == 200:
        subscriptions = response.json().get("subscriptions", [])
        print(f"Найдено подписок: {len(subscriptions)}")
        for sub in subscriptions:
            print(f"  - {sub.get('url')} (создана: {sub.get('time')})")
            # Если уже есть подписка на наш URL, удаляем её
            if sub.get("url") == WEBHOOK_URL:
                print(f"Удаляем существующую подписку на {WEBHOOK_URL}...")
                delete_response = requests.delete(
                    f"{MAX_API_URL}/subscriptions",
                    params={"access_token": token, "url": WEBHOOK_URL}
                )
                if delete_response.status_code == 200:
                    print("Старая подписка удалена")
                else:
                    print(f"Ошибка при удалении: {delete_response.status_code} - {delete_response.text}")
    else:
        print(f"Не удалось получить список подписок: {response.status_code} - {response.text}")

    # Создаём новую подписку
    print(f"\nПодписываемся на вебхуки...")
    print(f"URL: {WEBHOOK_URL}")
    print(f"Типы обновлений: {', '.join(UPDATE_TYPES)}")
    
    payload = {
        "url": WEBHOOK_URL,
        "update_types": UPDATE_TYPES,
    }
    
    response = requests.post(
        f"{MAX_API_URL}/subscriptions",
        params={"access_token": token},
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        result = response.json()
        if result.get("success"):
            print("✅ Успешно подписались на вебхуки!")
            return True
        else:
            print(f"❌ Ошибка: {result.get('message', 'Неизвестная ошибка')}")
            return False
    else:
        print(f"❌ Ошибка HTTP {response.status_code}: {response.text}")
        try:
            error_data = response.json()
            print(f"   Код ошибки: {error_data.get('code')}")
            print(f"   Сообщение: {error_data.get('message')}")
        except:
            pass
        return False


if __name__ == "__main__":
    success = subscribe_webhook()
    sys.exit(0 if success else 1)

