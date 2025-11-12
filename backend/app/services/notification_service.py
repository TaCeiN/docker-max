"""
Сервис для отправки уведомлений о дедлайнах через планировщик задач.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models.todo import Deadline, DeadlineNotification, Note
from ..models.user import User
from .bot_service import send_message_to_user
from .message_tracker import track_message

logger = logging.getLogger(__name__)

# Градация уведомлений в минутах
NOTIFICATION_GRADATIONS = [
    (14 * 24 * 60, "14d", "14 дней"),
    (7 * 24 * 60, "7d", "7 дней"),
    (3 * 24 * 60, "3d", "3 дня"),
    (1 * 24 * 60, "1d", "1 день"),
    (12 * 60, "12h", "12 часов"),
    (6 * 60, "6h", "6 часов"),
    (3 * 60, "3h", "3 часа"),
    (1 * 60, "1h", "1 час"),
    (30, "30m", "30 минут"),
]

scheduler: Optional[BackgroundScheduler] = None


def get_time_until_deadline(deadline_at: datetime) -> timedelta:
    """Вычисляет время до дедлайна."""
    from datetime import timezone
    # Если у deadline_at есть timezone, используем его, иначе считаем, что это UTC
    if deadline_at.tzinfo is None:
        deadline_at = deadline_at.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    return deadline_at - now


def format_time_remaining(minutes: int) -> str:
    """Форматирует оставшееся время в читаемый формат."""
    if minutes >= 24 * 60:
        days = minutes // (24 * 60)
        return f"{days} {'день' if days == 1 else 'дня' if 2 <= days <= 4 else 'дней'}"
    elif minutes >= 60:
        hours = minutes // 60
        return f"{hours} {'час' if hours == 1 else 'часа' if 2 <= hours <= 4 else 'часов'}"
    else:
        return f"{minutes} {'минута' if minutes == 1 else 'минуты' if 2 <= minutes <= 4 else 'минут'}"


def check_and_send_notifications():
    """Проверяет дедлайны и отправляет уведомления при необходимости."""
    from datetime import timezone
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        one_minute_ago = now - timedelta(minutes=1)
        
        # Сначала проверяем дедлайны, которые только что истекли (в последнюю минуту)
        expired_deadlines = db.query(Deadline).filter(
            Deadline.notification_enabled == True,
            Deadline.deadline_at <= now,
            Deadline.deadline_at >= one_minute_ago
        ).all()
        
        logger.info(f"Проверка {len(expired_deadlines)} истекших дедлайнов для уведомления об окончании")
        
        # Отправляем уведомления об окончании дедлайнов
        for deadline in expired_deadlines:
            try:
                # Проверяем, не было ли уже отправлено уведомление об окончании
                existing_notification = db.query(DeadlineNotification).filter(
                    DeadlineNotification.deadline_id == deadline.id,
                    DeadlineNotification.notification_type == "expired"
                ).first()
                
                if existing_notification:
                    continue  # Уведомление уже отправлено
                
                # Получаем заметку и пользователя
                note = db.query(Note).filter(Note.id == deadline.note_id).first()
                if not note:
                    continue
                
                # Проверяем, что заметка является todo
                try:
                    import json
                    parsed = json.loads(note.content or "{}")
                    if parsed.get("type") != "todo" or not isinstance(parsed.get("items"), list):
                        continue
                except:
                    continue
                
                user = db.query(User).filter(User.id == deadline.user_id).first()
                if not user:
                    continue
                
                # Отправляем уведомление об окончании дедлайна
                message = f'Дедлайн "{note.title}" истек'
                
                from ..core.config import settings
                result = send_message_to_user(user.uuid, message, image_url=settings.notification_image_url)
                if result:
                    message_id = result.get("message_id")
                    # Отслеживаем сообщение для последующего удаления после прочтения
                    if message_id:
                        track_message(message_id, user.uuid, message)
                    
                    # Сохраняем запись об отправленном уведомлении
                    notification = DeadlineNotification(
                        deadline_id=deadline.id,
                        notification_type="expired"
                    )
                    db.add(notification)
                    db.commit()
                    logger.info(f"Уведомление об окончании дедлайна отправлено для дедлайна {deadline.id}: {message}")
                else:
                    logger.error(f"Не удалось отправить уведомление об окончании для дедлайна {deadline.id}")
                    
            except Exception as e:
                logger.exception(f"Ошибка при обработке истекшего дедлайна {deadline.id}: {e}")
                db.rollback()
                continue
        
        # Находим все активные дедлайны с включенными уведомлениями (еще не истекшие)
        deadlines = db.query(Deadline).filter(
            Deadline.notification_enabled == True,
            Deadline.deadline_at > now
        ).all()
        
        logger.info(f"Проверка {len(deadlines)} активных дедлайнов с уведомлениями")
        
        for deadline in deadlines:
            try:
                # Получаем заметку и пользователя
                note = db.query(Note).filter(Note.id == deadline.note_id).first()
                if not note:
                    continue
                
                # Проверяем, что заметка является todo
                try:
                    import json
                    parsed = json.loads(note.content or "{}")
                    if parsed.get("type") != "todo" or not isinstance(parsed.get("items"), list):
                        continue
                except:
                    continue
                
                user = db.query(User).filter(User.id == deadline.user_id).first()
                if not user:
                    continue
                
                # Вычисляем оставшееся время в минутах
                time_until = get_time_until_deadline(deadline.deadline_at)
                minutes_remaining = int(time_until.total_seconds() / 60)
                
                # Пропускаем, если дедлайн уже прошел
                if minutes_remaining < 0:
                    continue
                
                # Получаем все уже отправленные уведомления для этого дедлайна
                sent_notifications = {
                    notif.notification_type 
                    for notif in db.query(DeadlineNotification).filter(
                        DeadlineNotification.deadline_id == deadline.id
                    ).all()
                }
                
                # Проверяем каждую градацию (от больших к меньшим)
                # Отправляем уведомление для первой подходящей градации, которая еще не была отправлена
                for minutes_threshold, notification_type, time_text in NOTIFICATION_GRADATIONS:
                    # Пропускаем, если уведомление этого типа уже было отправлено
                    if notification_type in sent_notifications:
                        continue
                    
                    # Проверяем, что время до дедлайна точно соответствует градации
                    # Так как проверка идет каждую минуту, проверяем точное время с небольшим допуском
                    # Уведомление отправляется, когда осталось точно нужное количество времени
                    # Допуск ±1 минута для учета точности проверки
                    lower_bound = minutes_threshold - 1
                    upper_bound = minutes_threshold + 1
                    
                    if lower_bound <= minutes_remaining <= upper_bound:
                        # Отправляем уведомление
                        message = f'До окончания дедлайна "{note.title}" осталось {time_text}'
                        
                        from ..core.config import settings
                        result = send_message_to_user(user.uuid, message, image_url=settings.notification_image_url)
                        if result:
                            message_id = result.get("message_id")
                            # Отслеживаем сообщение для последующего удаления после прочтения
                            if message_id:
                                track_message(message_id, user.uuid, message)
                            
                            # Сохраняем запись об отправленном уведомлении
                            notification = DeadlineNotification(
                                deadline_id=deadline.id,
                                notification_type=notification_type
                            )
                            db.add(notification)
                            db.commit()
                            logger.info(f"Уведомление отправлено для дедлайна {deadline.id}: {message}")
                            # Прерываем цикл после отправки первого подходящего уведомления
                            break
                        else:
                            logger.error(f"Не удалось отправить уведомление для дедлайна {deadline.id}")
                            # Не прерываем цикл, чтобы попробовать отправить другое уведомление при следующей проверке
                        
            except Exception as e:
                logger.exception(f"Ошибка при обработке дедлайна {deadline.id}: {e}")
                db.rollback()
                continue
                
    except Exception as e:
        logger.exception(f"Ошибка при проверке уведомлений: {e}")
    finally:
        db.close()


def start_scheduler():
    """Запускает планировщик уведомлений."""
    global scheduler
    
    if scheduler is not None and scheduler.running:
        logger.warning("Планировщик уже запущен")
        return
    
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        check_and_send_notifications,
        trigger=IntervalTrigger(minutes=1),
        id='deadline_notifications',
        name='Проверка и отправка уведомлений о дедлайнах',
        replace_existing=True
    )
    scheduler.start()
    logger.info("Планировщик уведомлений о дедлайнах запущен (проверка каждую минуту)")


def stop_scheduler():
    """Останавливает планировщик уведомлений."""
    global scheduler
    
    if scheduler is not None and scheduler.running:
        scheduler.shutdown()
        logger.info("Планировщик уведомлений остановлен")
    scheduler = None

