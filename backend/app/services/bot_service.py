"""
Сервис для отправки сообщений пользователям через Max Bot API.
"""
import logging
import requests
from typing import Optional, Dict, Any

from ..core.config import settings

logger = logging.getLogger(__name__)

MAX_BOT_API_URL = "https://platform-api.max.ru"


def send_message_to_user(user_uuid: str, text: str, image_url: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Отправляет сообщение пользователю через Max Bot API.
    
    Args:
        user_uuid: UUID пользователя (user_id из Max Bot API)
        text: Текст сообщения
        image_url: Опциональный URL изображения для прикрепления к сообщению
        
    Returns:
        Dict с message_id и другими данными, если сообщение отправлено успешно, None в противном случае
    """
    try:
        token = settings.max_bot_token
        if not token:
            logger.error("MAX_BOT_TOKEN не установлен в настройках")
            return None
        
        url = f"{MAX_BOT_API_URL}/messages"
        params = {
            "access_token": token,
            "user_id": user_uuid
        }
        
        payload = {
            "text": text
        }
        
        # Добавляем вложение с изображением, если указан URL
        if image_url:
            payload["attachments"] = [
                {
                    "type": "image",
                    "payload": {
                        "url": image_url
                    }
                }
            ]
            logger.info(f"📷 Прикрепляем изображение к сообщению: {image_url}")
        
        response = requests.post(url, params=params, json=payload, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            # Детальное логирование для отладки
            logger.info(f"📥 Полный ответ API при отправке сообщения: {result}")
            
            # Пробуем разные варианты извлечения message_id
            message_id = None
            if isinstance(result, dict):
                # Вариант 1: message.body.mid (основной путь для Max Bot API)
                if "message" in result:
                    message_obj = result.get("message")
                    if isinstance(message_obj, dict) and "body" in message_obj:
                        body = message_obj.get("body")
                        if isinstance(body, dict):
                            message_id = body.get("mid")
                
                # Вариант 2: прямо в корне
                if not message_id:
                    message_id = result.get("message_id")
                
                # Вариант 3: в объекте message (другие варианты)
                if not message_id and "message" in result:
                    message_obj = result.get("message")
                    if isinstance(message_obj, dict):
                        message_id = message_obj.get("message_id") or message_obj.get("id") or message_obj.get("mid")
                
                # Вариант 4: в объекте data
                if not message_id and "data" in result:
                    data_obj = result.get("data")
                    if isinstance(data_obj, dict):
                        message_id = data_obj.get("message_id") or data_obj.get("id")
                
                # Вариант 5: в result
                if not message_id and "result" in result:
                    result_obj = result.get("result")
                    if isinstance(result_obj, dict):
                        message_id = result_obj.get("message_id") or result_obj.get("id")
                
                # Вариант 6: просто id
                if not message_id:
                    message_id = result.get("id")
            
            if message_id:
                logger.info(f"✅ Сообщение отправлено пользователю {user_uuid}: {text[:50]}... (message_id: {message_id})")
            else:
                logger.warning(f"⚠️ Сообщение отправлено пользователю {user_uuid}, но message_id не найден в ответе. Пробуем найти по тексту...")
                # Пробуем найти сообщение по тексту
                import time
                time.sleep(1)  # Небольшая задержка, чтобы сообщение успело сохраниться
                found_message_id = find_message_by_text(user_uuid, text)
                if found_message_id:
                    message_id = found_message_id
                    logger.info(f"✅ message_id найден по тексту: {message_id}")
                else:
                    logger.error(f"❌ Не удалось найти message_id ни в ответе, ни по тексту сообщения")
            
            return {
                "message_id": str(message_id) if message_id else None,
                "user_id": user_uuid,
                "text": text,
                "result": result
            }
        else:
            logger.error(f"Ошибка при отправке сообщения пользователю {user_uuid}: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        logger.exception(f"Исключение при отправке сообщения пользователю {user_uuid}: {e}")
        return None


def get_messages_from_chat(user_uuid: str, limit: int = 50) -> Optional[list]:
    """
    Получает список последних сообщений из чата с пользователем.
    
    Args:
        user_uuid: UUID пользователя (user_id из Max Bot API)
        limit: Максимальное количество сообщений для получения
        
    Returns:
        Список сообщений или None в случае ошибки
    """
    try:
        token = settings.max_bot_token
        if not token:
            logger.error("MAX_BOT_TOKEN не установлен в настройках")
            return None
        
        url = f"{MAX_BOT_API_URL}/messages"
        params = {
            "access_token": token,
            "user_id": user_uuid,
            "limit": limit
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            messages = result.get("messages", []) or result.get("data", []) or []
            logger.debug(f"Получено {len(messages)} сообщений из чата с пользователем {user_uuid}")
            return messages
        else:
            logger.error(f"Ошибка при получении сообщений для пользователя {user_uuid}: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        logger.exception(f"Исключение при получении сообщений для пользователя {user_uuid}: {e}")
        return None


def find_message_by_text(user_uuid: str, text: str) -> Optional[str]:
    """
    Ищет сообщение в чате по тексту и возвращает его message_id.
    
    Args:
        user_uuid: UUID пользователя
        text: Текст сообщения для поиска
        
    Returns:
        message_id найденного сообщения или None
    """
    try:
        messages = get_messages_from_chat(user_uuid, limit=50)
        if not messages:
            return None
        
        # Ищем сообщение с нужным текстом
        for msg in messages:
            # Проверяем разные варианты структуры сообщения
            msg_text = None
            msg_id = None
            
            if isinstance(msg, dict):
                # Вариант 1: message.body.text
                if "body" in msg and isinstance(msg["body"], dict):
                    msg_text = msg["body"].get("text")
                    msg_id = msg["body"].get("mid")
                # Вариант 2: message.text
                elif "text" in msg:
                    msg_text = msg.get("text")
                    msg_id = msg.get("mid") or msg.get("message_id") or msg.get("id")
                # Вариант 3: body.text
                elif "body" in msg:
                    body = msg.get("body")
                    if isinstance(body, dict):
                        msg_text = body.get("text")
                        msg_id = body.get("mid")
            
            # Сравниваем тексты (учитываем, что текст может быть обрезан)
            if msg_text and (text in msg_text or msg_text in text):
                logger.info(f"✅ Найдено сообщение по тексту: message_id={msg_id}, text={msg_text[:50]}...")
                return str(msg_id) if msg_id else None
        
        logger.warning(f"⚠️ Сообщение с текстом '{text[:50]}...' не найдено в последних сообщениях")
        return None
        
    except Exception as e:
        logger.exception(f"Исключение при поиске сообщения по тексту для пользователя {user_uuid}: {e}")
        return None


def delete_message(message_id: str, user_uuid: str) -> bool:
    """
    Удаляет сообщение через Max Bot API.
    
    Args:
        message_id: ID сообщения для удаления
        user_uuid: UUID пользователя (user_id из Max Bot API)
        
    Returns:
        True если сообщение удалено успешно, False в противном случае
    """
    try:
        token = settings.max_bot_token
        if not token:
            logger.error("MAX_BOT_TOKEN не установлен в настройках")
            return False
        
        # Согласно swagger, DELETE /messages использует message_id в query параметрах
        url = f"{MAX_BOT_API_URL}/messages"
        params = {
            "access_token": token,
            "message_id": message_id
        }
        
        logger.info(f"🗑️ Пытаемся удалить сообщение {message_id} для пользователя {user_uuid}")
        logger.info(f"   URL: {url}")
        logger.info(f"   Params: {params}")
        logger.info(f"   Полный URL: {url}?access_token={token[:20]}...&message_id={message_id}")
        
        response = requests.delete(url, params=params, timeout=10)
        
        logger.info(f"   Статус ответа: {response.status_code}")
        logger.info(f"   Заголовки ответа: {dict(response.headers)}")
        logger.info(f"   Тело ответа (raw): {response.text}")
        
        if response.status_code == 200:
            try:
                result = response.json()
                logger.info(f"✅ Сообщение {message_id} успешно удалено для пользователя {user_uuid}")
                logger.info(f"   Ответ API (JSON): {result}")
            except:
                logger.info(f"✅ Сообщение {message_id} успешно удалено для пользователя {user_uuid} (ответ не JSON)")
            return True
        else:
            logger.error(f"❌ Ошибка при удалении сообщения {message_id} для пользователя {user_uuid}: {response.status_code} - {response.text}")
            try:
                error_data = response.json()
                logger.error(f"   Код ошибки: {error_data.get('code')}")
                logger.error(f"   Сообщение: {error_data.get('message')}")
                logger.error(f"   Полный ответ ошибки: {error_data}")
            except:
                logger.error(f"   Не удалось распарсить ответ как JSON")
            return False
            
    except Exception as e:
        logger.exception(f"❌ Исключение при удалении сообщения {message_id} для пользователя {user_uuid}: {e}")
        return False

