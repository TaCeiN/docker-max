from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import logging

from ..db import get_db
from ..deps import get_current_user
from ..models.user import User
from ..models.user_settings import UserSettings
from ..schemas import UserSettingsOut, UserSettingsUpdate

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings", response_model=UserSettingsOut)
def get_user_settings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Получить настройки пользователя"""
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    
    if not settings:
        # Создаем настройки по умолчанию, если их нет
        settings = UserSettings(
            user_id=user.id,
            language="ru",
            theme="dark",
            notification_times_minutes=[30]  # По умолчанию одно уведомление за 30 минут
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    # Убеждаемся, что notification_times_minutes это список
    if not isinstance(settings.notification_times_minutes, list):
        settings.notification_times_minutes = [30]
        db.commit()
        db.refresh(settings)
    
    return settings


@router.put("/settings", response_model=UserSettingsOut)
def update_user_settings(
    payload: UserSettingsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Обновить настройки пользователя"""
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    
    if not settings:
        # Создаем настройки, если их нет
        settings = UserSettings(
            user_id=user.id,
            language=payload.language or "ru",
            theme=payload.theme or "dark",
            notification_times_minutes=payload.notification_times_minutes or [30]
        )
        db.add(settings)
    else:
        # Обновляем существующие настройки
        if payload.language is not None:
            if payload.language not in ["ru", "en"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Language must be 'ru' or 'en'"
                )
            settings.language = payload.language
        
        if payload.theme is not None:
            if payload.theme not in ["light", "dark"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Theme must be 'light' or 'dark'"
                )
            settings.theme = payload.theme
        
        if payload.notification_times_minutes is not None:
            # Проверяем, что это список и содержит не более 10 элементов
            if not isinstance(payload.notification_times_minutes, list):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="notification_times_minutes must be a list"
                )
            if len(payload.notification_times_minutes) > 10:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Maximum 10 notification times allowed"
                )
            # Проверяем, что все значения неотрицательные
            if any(time < 0 for time in payload.notification_times_minutes):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="All notification times must be non-negative"
                )
            # Сортируем и убираем дубликаты
            unique_times = sorted(list(set(payload.notification_times_minutes)))
            old_times = settings.notification_times_minutes or []
            # Нормализуем старые времена (если это не список, преобразуем)
            if not isinstance(old_times, list):
                old_times = [30]  # Значение по умолчанию
            old_times_sorted = sorted(old_times)
            settings.notification_times_minutes = unique_times
            
            # Если времена уведомлений изменились, удаляем все существующие уведомления для дедлайнов пользователя
            # чтобы они пересчитались с новыми временами
            if old_times_sorted != unique_times:
                from ..models.todo import Deadline, DeadlineNotification
                # Находим все дедлайны пользователя
                user_deadlines = db.query(Deadline).filter(Deadline.user_id == user.id).all()
                deadline_ids = [d.id for d in user_deadlines]
                
                if deadline_ids:
                    # Удаляем все уведомления для этих дедлайнов (кроме expired)
                    db.query(DeadlineNotification).filter(
                        DeadlineNotification.deadline_id.in_(deadline_ids),
                        DeadlineNotification.notification_type != "expired"
                    ).delete(synchronize_session=False)
                    logger.info(f"Удалены существующие уведомления для {len(deadline_ids)} дедлайнов пользователя {user.id} после обновления времен уведомлений")
    
    db.commit()
    db.refresh(settings)
    
    return settings

