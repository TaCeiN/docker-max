#!/usr/bin/env python3
"""
Скрипт для проверки текущих подписок на вебхуки Max Bot API.
Показывает все активные подписки и их статус.

Использование:
    python check_webhooks.py
Или с указанием токена:
    MAX_BOT_TOKEN=your_token python check_webhooks.py
"""
import os
import sys
import requests
import json
from datetime import datetime
from app.core.config import settings

# URL для проверки подписок
MAX_API_URL = "https://platform-api.max.ru"


def check_webhooks():
    """Проверяет текущие подписки на вебхуки."""
    token = settings.max_bot_token
    if not token:
        print("❌ ОШИБКА: Токен бота не установлен!")
        print("Установите переменную окружения MAX_BOT_TOKEN")
        print("Пример: export MAX_BOT_TOKEN=your_token_here")
        sys.exit(1)

    print("=" * 80)
    print("🔍 ПРОВЕРКА ПОДПИСОК НА ВЕБХУКИ")
    print("=" * 80)
    print(f"Токен: {token[:20]}...{token[-10:]}")
    print(f"API URL: {MAX_API_URL}")
    print()

    # Получаем список подписок
    print("📡 Запрос к Max Bot API...")
    try:
        response = requests.get(
            f"{MAX_API_URL}/subscriptions",
            params={"access_token": token},
            timeout=10
        )
    except requests.exceptions.RequestException as e:
        print(f"❌ Ошибка при запросе к API: {e}")
        sys.exit(1)

    print(f"Статус ответа: {response.status_code}")
    print()

    if response.status_code == 200:
        try:
            data = response.json()
            subscriptions = data.get("subscriptions", [])
            
            if not subscriptions:
                print("⚠️  Подписок не найдено!")
                print()
                print("Для подписки на вебхуки используйте:")
                print("   python subscribe_webhook.py")
                return
            
            print(f"✅ Найдено подписок: {len(subscriptions)}")
            print()
            
            for idx, sub in enumerate(subscriptions, 1):
                print("-" * 80)
                print(f"📌 Подписка #{idx}")
                print("-" * 80)
                
                url = sub.get("url", "N/A")
                time = sub.get("time")
                update_types = sub.get("update_types", [])
                version = sub.get("version", "N/A")
                
                print(f"🔗 URL: {url}")
                
                if time:
                    # time в миллисекундах Unix timestamp
                    dt = datetime.fromtimestamp(time / 1000)
                    print(f"⏰ Создана: {dt.strftime('%Y-%m-%d %H:%M:%S')} ({time} ms)")
                
                print(f"📋 Типы обновлений ({len(update_types)}):")
                for ut in update_types:
                    print(f"   - {ut}")
                
                print(f"📦 Версия API: {version}")
                print()
            
            # Проверяем, есть ли подписка на нужный URL
            target_url = os.getenv("WEBHOOK_URL", "https://webhook-devcore-max.cloudpub.ru/")
            print("=" * 80)
            print("🎯 ПРОВЕРКА ЦЕЛЕВОГО URL")
            print("=" * 80)
            print(f"Ожидаемый URL: {target_url}")
            
            found = False
            for sub in subscriptions:
                if sub.get("url") == target_url:
                    found = True
                    print(f"✅ Подписка на целевой URL найдена!")
                    break
            
            if not found:
                print(f"❌ Подписка на целевой URL НЕ найдена!")
                print()
                print("Для подписки используйте:")
                print(f"   export WEBHOOK_URL=\"{target_url}\"")
                print("   python subscribe_webhook.py")
            
        except json.JSONDecodeError:
            print(f"❌ Ошибка: ответ не является валидным JSON")
            print(f"Ответ: {response.text[:500]}")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Ошибка при обработке ответа: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
            
    elif response.status_code == 401:
        print("❌ Ошибка авторизации!")
        print("Проверьте правильность токена бота.")
        try:
            error_data = response.json()
            print(f"   Код: {error_data.get('code')}")
            print(f"   Сообщение: {error_data.get('message')}")
        except:
            print(f"   Ответ: {response.text[:200]}")
        sys.exit(1)
    else:
        print(f"❌ Ошибка HTTP {response.status_code}")
        try:
            error_data = response.json()
            print(f"   Код ошибки: {error_data.get('code')}")
            print(f"   Сообщение: {error_data.get('message')}")
        except:
            print(f"   Ответ: {response.text[:500]}")
        sys.exit(1)
    
    print()
    print("=" * 80)
    print("✅ Проверка завершена")
    print("=" * 80)


if __name__ == "__main__":
    check_webhooks()

