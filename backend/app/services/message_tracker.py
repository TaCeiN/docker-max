"""
Сервис для отслеживания отправленных сообщений и их прочтения.
"""
import logging
import threading
from typing import Dict, Optional
from datetime import datetime, timedelta

from .bot_service import delete_message
from ..core.config import settings

logger = logging.getLogger(__name__)

# Хранилище отправленных сообщений: message_id -> {user_id, sent_at, ...}
_sent_messages: Dict[str, Dict] = {}
_lock = threading.Lock()


def track_message(message_id: str, user_id: str, text: str) -> None:
    """
    Сохраняет информацию об отправленном сообщении для отслеживания.
    Автоматически планирует удаление через заданное время после отправки,
    так как API Max Bot не поддерживает отслеживание прочтения через webhook.
    
    Args:
        message_id: ID сообщения
        user_id: UUID пользователя
        text: Текст сообщения
    """
    if not message_id:
        logger.warning(f"Попытка отследить сообщение без message_id для пользователя {user_id}")
        return
    
    message_id_str = str(message_id)
    delete_delay = settings.notification_delete_after_read_seconds
    
    logger.info(f"🔍 track_message вызван: message_id={message_id_str}, user_id={user_id}, delay={delete_delay} сек")
    
    with _lock:
        _sent_messages[message_id_str] = {
            "user_id": user_id,
            "text": text,
            "sent_at": datetime.now(),
            "read_at": None,
            "delete_scheduled": False
        }
        logger.info(f"✅ Отслеживаем сообщение {message_id_str} для пользователя {user_id}. Всего отслеживаемых: {len(_sent_messages)}")
    
    # Планируем автоматическое удаление через заданное время после отправки
    # (так как API не поддерживает отслеживание прочтения через webhook)
    def auto_delete_after_delay():
        import time
        logger.info(f"⏳ Автоматическое удаление запланировано для сообщения {message_id_str}. Ожидание {delete_delay} секунд...")
        time.sleep(delete_delay)
        logger.info(f"⏰ Время ожидания истекло, начинаем автоматическое удаление сообщения {message_id_str}")
        
        with _lock:
            if message_id_str not in _sent_messages:
                logger.debug(f"Сообщение {message_id_str} уже удалено, пропускаем")
                return
            
            message_info = _sent_messages[message_id_str]
            # Если сообщение уже было отмечено как прочитанное, не удаляем автоматически
            # (удаление уже запланировано через mark_message_as_read)
            if message_info.get("read_at") is not None:
                logger.debug(f"Сообщение {message_id_str} уже отмечено как прочитанное, пропускаем автоматическое удаление")
                return
            
            user_id_for_delete = message_info.get("user_id")
            logger.info(f"🗑️ Начинаем автоматическое удаление сообщения {message_id_str} для пользователя {user_id_for_delete}")
            
            success = delete_message(message_id_str, user_id_for_delete)
            if success:
                logger.info(f"✅ Сообщение {message_id_str} успешно удалено автоматически")
                del _sent_messages[message_id_str]
            else:
                logger.error(f"❌ Не удалось автоматически удалить сообщение {message_id_str}")
    
    thread = threading.Thread(target=auto_delete_after_delay, daemon=True, name=f"auto_delete_{message_id_str}")
    thread.start()
    logger.info(f"🧵 Поток автоматического удаления запущен: {thread.name}")


def mark_message_as_read(message_id: str) -> Optional[Dict]:
    """
    Отмечает сообщение как прочитанное и планирует его удаление.
    
    Args:
        message_id: ID сообщения
        
    Returns:
        Информация о сообщении, если оно найдено, None в противном случае
    """
    message_id_str = str(message_id)
    with _lock:
        if message_id_str not in _sent_messages:
            logger.warning(f"⚠️ Сообщение {message_id_str} не найдено в отслеживаемых. Доступные ID: {list(_sent_messages.keys())[:10]}")
            return None
        
        message_info = _sent_messages[message_id_str]
        
        # Если уже отмечено как прочитанное, не обрабатываем повторно
        if message_info.get("read_at") is not None:
            logger.debug(f"Сообщение {message_id_str} уже было прочитано ранее")
            return message_info
        
        # Отмечаем как прочитанное
        message_info["read_at"] = datetime.now()
        message_info["delete_scheduled"] = True
        
        user_id = message_info["user_id"]
        delete_delay = settings.notification_delete_after_read_seconds
        
        logger.info(f"📖 Сообщение {message_id_str} прочитано пользователем {user_id}. Удаление через {delete_delay} секунд")
        
        # Планируем удаление через заданное время
        def delete_after_delay():
            import time
            logger.info(f"⏳ Поток удаления запущен для сообщения {message_id_str}. Ожидание {delete_delay} секунд...")
            time.sleep(delete_delay)
            logger.info(f"⏰ Время ожидания истекло, начинаем удаление сообщения {message_id_str}")
            
            # Проверяем, что сообщение все еще в отслеживаемых (не было удалено вручную)
            with _lock:
                if message_id_str not in _sent_messages:
                    logger.warning(f"⚠️ Сообщение {message_id_str} уже удалено из отслеживаемых, пропускаем удаление")
                    return
                
                message_info = _sent_messages[message_id_str]
                user_id_for_delete = message_info.get("user_id")
                logger.info(f"🗑️ Начинаем удаление сообщения {message_id_str} для пользователя {user_id_for_delete}")
                
                success = delete_message(message_id_str, user_id_for_delete)
                if success:
                    logger.info(f"✅ Сообщение {message_id_str} успешно удалено после прочтения")
                    # Удаляем из отслеживаемых
                    del _sent_messages[message_id_str]
                else:
                    logger.error(f"❌ Не удалось удалить сообщение {message_id_str} после прочтения")
                    # Оставляем в отслеживаемых для возможной повторной попытки
        
        # Запускаем удаление в отдельном потоке
        thread = threading.Thread(target=delete_after_delay, daemon=True, name=f"delete_msg_{message_id_str}")
        thread.start()
        logger.info(f"🧵 Поток удаления запущен: {thread.name}")
        
        return message_info


def get_message_info(message_id: str) -> Optional[Dict]:
    """
    Получает информацию о сообщении.
    
    Args:
        message_id: ID сообщения
        
    Returns:
        Информация о сообщении или None
    """
    with _lock:
        return _sent_messages.get(message_id)


def remove_message(message_id: str) -> None:
    """
    Удаляет сообщение из отслеживаемых (например, если оно было удалено вручную).
    
    Args:
        message_id: ID сообщения
    """
    with _lock:
        if message_id in _sent_messages:
            del _sent_messages[message_id]
            logger.debug(f"Сообщение {message_id} удалено из отслеживаемых")

