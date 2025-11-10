"""
Сервис для отправки сообщений пользователям через Max Bot API.
"""
import logging
import requests
from typing import Optional

from ..core.config import settings

logger = logging.getLogger(__name__)

MAX_BOT_API_URL = "https://platform-api.max.ru"


def send_message_to_user(user_uuid: str, text: str) -> bool:
    """
    Отправляет сообщение пользователю через Max Bot API.
    
    Args:
        user_uuid: UUID пользователя (user_id из Max Bot API)
        text: Текст сообщения
        
    Returns:
        True если сообщение отправлено успешно, False в противном случае
    """
    try:
        token = settings.max_bot_token
        if not token:
            logger.error("MAX_BOT_TOKEN не установлен в настройках")
            return False
        
        url = f"{MAX_BOT_API_URL}/messages"
        params = {
            "access_token": token,
            "user_id": user_uuid
        }
        
        payload = {
            "text": text
        }
        
        response = requests.post(url, params=params, json=payload, timeout=10)
        
        if response.status_code == 200:
            logger.info(f"Сообщение отправлено пользователю {user_uuid}: {text[:50]}...")
            return True
        else:
            logger.error(f"Ошибка при отправке сообщения пользователю {user_uuid}: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logger.exception(f"Исключение при отправке сообщения пользователю {user_uuid}: {e}")
        return False

