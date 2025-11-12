#!/usr/bin/env python3
"""
Отдельный сервер для приема вебхуков от Max Bot API.
Запускается на отдельном порту для удобного логирования.

Использование:
    python webhook_server.py
Или с указанием порта:
    WEBHOOK_PORT=9000 python webhook_server.py
"""
import os
import sys
import json
import logging
import requests
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import uvicorn

# Импорты для работы с БД
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.db import SessionLocal
from app.models.user import User
from app.core.config import settings

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# URL для подписки на вебхуки
MAX_API_URL = "https://platform-api.max.ru"
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "https://webhook-devcore-max.cloudpub.ru/")

# Типы обновлений, на которые подписываемся
# ВАЖНО: message_read не поддерживается API Max Bot для подписки, но оставляем обработку на случай, если событие придет
UPDATE_TYPES = [
    "message_created",
    "message_callback",
    "bot_started",
    "bot_stopped",
    "message_edited",
    "message_removed",
    # "message_read",  # Не поддерживается API для подписки, но обрабатываем если придет
    "bot_added",
    "bot_removed",
    "user_added",
    "user_removed",
]


def subscribe_webhook():
    """Подписывает бота на вебхуки."""
    token = settings.max_bot_token
    if not token:
        logger.error("❌ ОШИБКА: Токен бота не установлен!")
        logger.error("Установите переменную окружения MAX_BOT_TOKEN")
        return False

    try:
        # Проверяем текущие подписки
        logger.info(f"🔍 Проверяем текущие подписки...")
        response = requests.get(
            f"{MAX_API_URL}/subscriptions",
            params={"access_token": token},
            timeout=10
        )
        
        if response.status_code == 200:
            subscriptions = response.json().get("subscriptions", [])
            logger.info(f"📋 Найдено подписок: {len(subscriptions)}")
            for sub in subscriptions:
                logger.info(f"   - {sub.get('url')} (создана: {sub.get('time')})")
                # Если уже есть подписка на наш URL, удаляем её
                if sub.get("url") == WEBHOOK_URL:
                    logger.info(f"🗑️ Удаляем существующую подписку на {WEBHOOK_URL}...")
                    delete_response = requests.delete(
                        f"{MAX_API_URL}/subscriptions",
                        params={"access_token": token, "url": WEBHOOK_URL},
                        timeout=10
                    )
                    if delete_response.status_code == 200:
                        logger.info("✅ Старая подписка удалена")
                    else:
                        logger.warning(f"⚠️ Ошибка при удалении: {delete_response.status_code} - {delete_response.text}")
        else:
            logger.warning(f"⚠️ Не удалось получить список подписок: {response.status_code} - {response.text}")

        # Создаём новую подписку
        logger.info(f"📝 Подписываемся на вебхуки...")
        logger.info(f"🔗 URL: {WEBHOOK_URL}")
        logger.info(f"📌 Типы обновлений: {', '.join(UPDATE_TYPES)}")
        
        payload = {
            "url": WEBHOOK_URL,
            "update_types": UPDATE_TYPES,
        }
        
        response = requests.post(
            f"{MAX_API_URL}/subscriptions",
            params={"access_token": token},
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                logger.info("✅ Успешно подписались на вебхуки!")
                return True
            else:
                logger.error(f"❌ Ошибка: {result.get('message', 'Неизвестная ошибка')}")
                return False
        else:
            logger.error(f"❌ Ошибка HTTP {response.status_code}: {response.text}")
            try:
                error_data = response.json()
                logger.error(f"   Код ошибки: {error_data.get('code')}")
                logger.error(f"   Сообщение: {error_data.get('message')}")
            except:
                pass
            return False
    except Exception as e:
        logger.exception(f"❌ Ошибка при подписке на вебхуки: {e}")
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: автоматическая подписка на webhooks
    logger.info("🚀 Запуск webhook сервера...")
    if WEBHOOK_URL:
        logger.info(f"🔗 Webhook URL: {WEBHOOK_URL}")
        subscribe_webhook()
    else:
        logger.warning("⚠️ WEBHOOK_URL не установлен, пропускаем подписку")
    
    yield
    
    # Shutdown (если нужно что-то делать при остановке)
    logger.info("🛑 Остановка webhook сервера...")


app = FastAPI(title="Max Bot Webhook Server", lifespan=lifespan)


def _upsert_user_from_webhook(user_data: dict) -> None:
    """
    Сохраняет или обновляет пользователя в БД из данных вебхука.
    """
    if not isinstance(user_data, dict):
        return
    
    user_id = user_data.get("user_id") or user_data.get("id")
    if not user_id:
        logger.warning("⚠️ Нет user_id в данных пользователя")
        return
    
    db = SessionLocal()
    try:
        uuid = str(user_id)
        
        # Формируем username
        first_name = user_data.get("first_name") or user_data.get("name") or ""
        last_name = user_data.get("last_name") or ""
        username_from_data = user_data.get("username")
        
        if first_name and last_name:
            full_name = f"{first_name} {last_name}".strip()
        elif first_name:
            full_name = first_name
        elif username_from_data:
            full_name = username_from_data
        else:
            full_name = f"user_{user_id}"
        
        # Используем username из Max, если есть, иначе формируем
        if username_from_data:
            username = username_from_data
        else:
            username = f"max_{user_id}_{full_name}".strip()
        
        # Проверяем существующего пользователя
        existing = db.query(User).filter(User.uuid == uuid).first()
        
        if existing:
            # Обновляем username, если изменился
            updated = False
            if username_from_data and existing.username != username_from_data:
                existing.username = username_from_data
                updated = True
            elif not username_from_data and existing.username != username:
                existing.username = username
                updated = True
            
            if updated:
                db.add(existing)
                db.commit()
                db.refresh(existing)
                logger.info(f"✅ Обновлен пользователь в БД: id={existing.id}, username={existing.username}")
            else:
                logger.info(f"ℹ️ Пользователь уже существует: id={existing.id}, username={existing.username}")
        else:
            # Проверяем уникальность username
            if db.query(User).filter(User.username == username).first() is not None:
                username = f"{username}_{user_id}"
                logger.info(f"⚠️ Конфликт username, используем: {username}")
            
            # Создаем нового пользователя
            new_user = User(username=username, uuid=uuid)
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            logger.info(f"✅ Создан новый пользователь в БД: id={new_user.id}, username={new_user.username}, uuid={new_user.uuid}")
            
    except Exception as e:
        logger.exception(f"❌ Ошибка при сохранении пользователя в БД: {e}")
        db.rollback()
    finally:
        db.close()


@app.get("/")
async def root_get(request: Request):
    """Проверка работоспособности сервера и обработка GET запросов."""
    logger.info(f"GET запрос на / от {request.client.host if request.client else 'unknown'}")
    return {"status": "ok", "service": "webhook_server", "webhook_ready": True}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.post("/")
async def webhook(request: Request):
    """
    Принимает вебхуки от Max Bot API на корневом пути.
    Логирует все входящие данные для отладки.
    """
    try:
        # Получаем заголовки
        headers = dict(request.headers)
        client_ip = request.client.host if request.client else "unknown"
        
        logger.info("")
        logger.info("=" * 80)
        logger.info("🔔 НОВЫЙ ВЕБХУК ПОЛУЧЕН")
        logger.info("=" * 80)
        logger.info(f"⏰ Время: {datetime.now().isoformat()}")
        logger.info(f"🌐 IP клиента: {client_ip}")
        logger.info(f"📡 Method: {request.method}")
        logger.info(f"🔗 URL: {request.url}")
        logger.info(f"📋 Headers:")
        for key, value in headers.items():
            logger.info(f"   {key}: {value}")
        
        # Получаем тело запроса
        try:
            body_bytes = await request.body()
            body_str = body_bytes.decode('utf-8')
            logger.info(f"📦 Raw body ({len(body_bytes)} bytes):")
            logger.info(f"   {body_str}")
            
            # Пытаемся распарсить как JSON
            payload = None
            try:
                payload = json.loads(body_str)
                logger.info(f"✅ Parsed JSON payload:")
                logger.info(json.dumps(payload, indent=4, ensure_ascii=False))
            except json.JSONDecodeError as e:
                logger.warning(f"⚠️ Body is not valid JSON: {e}")
                logger.warning(f"   Raw content: {body_str[:500]}")
        except Exception as e:
            logger.error(f"❌ Error reading body: {e}")
            payload = None
        
        # Извлекаем информацию о пользователе
        if payload:
            update_type = payload.get("update_type")
            logger.info(f"📌 Update type: {update_type}")
            
            # Извлекаем пользователя из разных типов обновлений
            user = None
            if update_type == "bot_started":
                user = payload.get("user")
                logger.info(f"🤖 Bot started by user: {json.dumps(user, indent=2, ensure_ascii=False) if user else 'None'}")
            elif update_type == "message_created":
                message = payload.get("message")
                if message:
                    user = message.get("sender")
                    logger.info(f"💬 Message from user: {json.dumps(user, indent=2, ensure_ascii=False) if user else 'None'}")
            elif update_type == "message_callback":
                callback = payload.get("callback")
                if callback:
                    user = callback.get("user")
                    logger.info(f"🔘 Callback from user: {json.dumps(user, indent=2, ensure_ascii=False) if user else 'None'}")
            if user:
                user_id = user.get("user_id") or user.get("id")
                first_name = user.get("first_name") or user.get("name")
                last_name = user.get("last_name")
                username = user.get("username")
                full_name = f"{first_name} {last_name}".strip() if first_name else username or "Unknown"
                logger.info(f"👤 User ID: {user_id}")
                logger.info(f"👤 Name: {full_name}")
                logger.info(f"👤 Username: {username or 'N/A'}")
                
                # Сохраняем пользователя в БД при bot_started
                if update_type == "bot_started":
                    logger.info("💾 Сохраняем пользователя в БД...")
                    _upsert_user_from_webhook(user)
        
        logger.info("=" * 80)
        logger.info("✅ Вебхук обработан успешно, отправляем 200 OK")
        logger.info("=" * 80)
        logger.info("")
        
        # Всегда возвращаем 200 OK, чтобы Max не повторял запрос
        return JSONResponse(
            status_code=200,
            content={"ok": True, "received": True}
        )
        
    except Exception as e:
        logger.exception(f"❌ ОШИБКА при обработке вебхука: {e}")
        # Все равно возвращаем 200, чтобы Max не повторял запрос
        return JSONResponse(
            status_code=200,
            content={"ok": True, "error": str(e)}
        )


# GET на корневой путь уже обрабатывается в root()


if __name__ == "__main__":
    port = int(os.getenv("WEBHOOK_PORT", "8080"))
    host = os.getenv("WEBHOOK_HOST", "0.0.0.0")
    
    logger.info(f"Запуск вебхук-сервера на {host}:{port}")
    logger.info(f"Webhook endpoint: http://{host}:{port}/")
    logger.info(f"Webhook URL для подписки: https://webhook-devcore-max.cloudpub.ru/")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )

