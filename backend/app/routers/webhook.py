from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session
import logging

from ..db import get_db
from ..models.user import User

router = APIRouter(tags=["webhook"])
logger = logging.getLogger(__name__)


def _upsert_user_from_update(db: Session, u: dict) -> None:
    if not isinstance(u, dict):
        return
    user_id = u.get("user_id") or u.get("id")
    if not user_id:
        return

    uuid = str(user_id)
    raw_username = u.get("username") or u.get("first_name") or "user"
    username = u.get("username") or f"max_{user_id}_{raw_username}"

    existing = db.query(User).filter(User.uuid == uuid).first()
    if existing:
        if u.get("username") and existing.username != u.get("username"):
            existing.username = u.get("username")
            db.add(existing)
            db.commit()
        return

    if db.query(User).filter(User.username == username).first() is not None:
        username = f"{username}_{user_id}"

    new_user = User(username=username, uuid=uuid)
    db.add(new_user)
    db.commit()


@router.post("/webhook")
async def webhook(request: Request, db: Session = Depends(get_db)):
    """
    Принимает вебхуки Max Bot API.
    Быстро отвечает 200 OK. Логика: извлекаем пользователя и делаем upsert.
    ВАЖНО: Для продакшена подписывайте на корневой путь: https://webhook-devcore-max.cloudpub.ru/
    Этот эндпоинт оставлен для совместимости, но основной вебхук-сервер слушает на корневом пути.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    try:
        # update_type может быть: bot_started, message_callback, message_created, ...
        user = payload.get("user") or (payload.get("callback") or {}).get("user")
        if user:
            _upsert_user_from_update(db, user)
    except Exception as e:
        logger.exception("webhook processing error: %s", e)
        # не фейлим доставку, возвращаем 200

    return {"ok": True}
