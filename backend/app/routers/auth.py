from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any, Dict
import json
from urllib.parse import parse_qsl

from ..db import get_db
from ..models.user import User
from ..schemas import UserCreate, UserOut, Token, LoginRequest
from ..security import create_access_token
from ..deps import get_current_user


router = APIRouter(prefix="/auth", tags=["auth"]) 


@router.post("/register", response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    try:
        # Проверяем, существует ли пользователь с таким username
        existing_username = db.query(User).filter(User.username == payload.username).first()
        if existing_username is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пользователь с таким именем уже зарегистрирован")
        
        # Проверяем, существует ли пользователь с таким uuid
        existing_uuid = db.query(User).filter(User.uuid == payload.uuid).first()
        if existing_uuid is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пользователь с таким UUID уже зарегистрирован")

        user = User(username=payload.username, uuid=payload.uuid)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in register: {e}")
        print(traceback.format_exc())
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Внутренняя ошибка сервера: {str(e)}")


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.username == payload.username).first()
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверные учетные данные")
        
        # Проверяем UUID
        if user.uuid != payload.uuid:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверные учетные данные")

        token = create_access_token(str(user.id))
        return Token(access_token=token)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in login: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Внутренняя ошибка сервера: {str(e)}")


# ---- WebApp initData auth (авто-логин из мини-приложения) ----
class WebAppInit(BaseModel):
    initData: str


def _parse_init_data(raw: str) -> Dict[str, Any]:
    """Пытаемся распарсить initData из WebApp.
    Поддерживаем 2 формата: JSON и URL-encoded (key=value&...).
    ВАЖНО: проверка подписи должна быть добавлена по документации Max WebApps.
    """
    raw = (raw or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="initData is empty")

    # Попытка распарсить JSON
    if raw.startswith("{"):
        try:
            return json.loads(raw)
        except Exception:
            raise HTTPException(status_code=400, detail="Malformed JSON in initData")

    # Попытка распарсить URL-encoded строку
    try:
        pairs = dict(parse_qsl(raw, keep_blank_values=True))
        # В некоторых реализациях user может быть закодирован как JSON-строка
        if "user" in pairs:
            try:
                pairs["user"] = json.loads(pairs["user"]) if isinstance(pairs["user"], str) else pairs["user"]
            except Exception:
                # оставляем как есть, если не JSON
                pass
        return pairs
    except Exception:
        raise HTTPException(status_code=400, detail="Unsupported initData format")


@router.post("/webapp-init", response_model=Token)
def auth_webapp(body: WebAppInit, db: Session = Depends(get_db)):
    import logging
    logger = logging.getLogger(__name__)
    
    data = _parse_init_data(body.initData)
    logger.info(f"Parsed initData: {data}")

    # TODO: ПРОВЕРКА ПОДПИСИ initData (HMAC и срок годности) согласно Max WebApps.
    # Сейчас проверка отключена для дев-окружения. НЕ ОСТАВЛЯЙТЕ ТАК В PROD!

    # Извлекаем пользователя из initData
    user = None
    if isinstance(data, dict):
        # Пытаемся получить user из разных мест
        user = data.get("user")
        
        # Если user - строка, пытаемся распарсить как JSON
        if isinstance(user, str):
            try:
                user = json.loads(user)
            except Exception:
                pass
        
        # Если user не найден, проверяем другие варианты
        if not user or not isinstance(user, dict):
            user = data.get("init_data", {}).get("user") if isinstance(data.get("init_data"), dict) else None
        
        # Если user все еще не найден, проверяем верхний уровень
        if not user or not isinstance(user, dict):
            candidate = {k: data.get(k) for k in ("user_id", "id", "first_name", "last_name", "username", "name") if k in data}
            user = candidate if candidate else None
    
    if not user or not isinstance(user, dict):
        logger.error(f"No user found in initData. Data keys: {list(data.keys()) if isinstance(data, dict) else 'not a dict'}")
        raise HTTPException(status_code=400, detail="No user in initData")

    user_id = user.get("user_id") or user.get("id")
    if not user_id:
        logger.error(f"No user_id found in user object. User keys: {list(user.keys())}")
        raise HTTPException(status_code=400, detail="No user id in initData.user")

    # Формируем имя пользователя: first_name + last_name или username или fallback
    first_name = user.get("first_name") or user.get("name") or ""
    last_name = user.get("last_name") or ""
    username_from_user = user.get("username")
    
    # Собираем полное имя
    if first_name and last_name:
        full_name = f"{first_name} {last_name}".strip()
    elif first_name:
        full_name = first_name
    elif username_from_user:
        full_name = username_from_user
    else:
        full_name = f"user_{user_id}"
    
    # Используем username из Max, если есть, иначе используем полное имя
    # Для уникальности добавляем префикс max_ если нет username
    if username_from_user:
        username = username_from_user
    else:
        username = f"max_{user_id}_{full_name}".strip()
    
    uuid = str(user_id)
    
    logger.info(f"Extracted user: id={user_id}, username={username}, name={full_name}")

    # Сначала проверяем, есть ли пользователь в БД (сохранен при bot_started)
    existing = db.query(User).filter(User.uuid == uuid).first()
    
    if existing:
        # Пользователь уже есть в БД (был сохранен при bot_started через вебхук)
        logger.info(f"✅ Пользователь найден в БД (сохранен при bot_started): id={existing.id}, username={existing.username}, uuid={existing.uuid}")
        logger.info(f"   Автоматический вход в аккаунт для пользователя из вебхука")
        
        # Обновляем username, если он изменился
        updated = False
        if username_from_user and existing.username != username_from_user:
            existing.username = username_from_user
            updated = True
        elif not username_from_user and existing.username != username:
            existing.username = username
            updated = True
        
        if updated:
            db.add(existing)
            db.commit()
            db.refresh(existing)
            logger.info(f"Обновлен username: {existing.username}")
        
        # Возвращаем токен для существующего пользователя
        token = create_access_token(str(existing.id))
        return Token(access_token=token)

    # если юзера нет в БД — создаем (fallback, если вебхук не пришел)
    # дополнительно проверим уникальность username
    if db.query(User).filter(User.username == username).first() is not None:
        # если конфликт — добавим суффикс
        username = f"{username}_{user_id}"
        logger.info(f"Username conflict, using: {username}")

    new_user = User(username=username, uuid=uuid)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    logger.info(f"Created new user: id={new_user.id}, username={new_user.username}, uuid={new_user.uuid}")

    token = create_access_token(str(new_user.id))
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    """
    Получает данные текущего авторизованного пользователя.
    Используется для получения информации о пользователе после авторизации.
    """
    return user

