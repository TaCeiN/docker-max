from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import logging

from .routers import health, auth
from .routers import crud, webhook, settings
from .db import engine, Base

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        logger.info(f"{request.method} {request.url.path} - Headers: {dict(request.headers)}")
        response = await call_next(request)
        logger.info(f"{request.method} {request.url.path} - Status: {response.status_code}")
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    
    # Выполняем миграцию user_settings если нужно
    try:
        import sqlite3
        import json
        from pathlib import Path
        from .core.config import settings
        
        # Определяем путь к базе данных
        db_url = settings.database_url
        if db_url.startswith("sqlite:///./"):
            db_path = Path(db_url.replace("sqlite:///./", ""))
        elif db_url.startswith("sqlite:///"):
            db_path = Path(db_url.replace("sqlite:///", ""))
        else:
            db_path = None
        
        if db_path and db_path.exists():
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Проверяем структуру таблицы
            cursor.execute("PRAGMA table_info(user_settings)")
            columns = {col[1]: col for col in cursor.fetchall()}
            
            has_old_column = 'notification_time_minutes' in columns
            has_new_column = 'notification_times_minutes' in columns
            
            if not has_new_column:
                if has_old_column:
                    # Миграция: переименование и преобразование
                    logger.info("Выполняю миграцию user_settings: notification_time_minutes -> notification_times_minutes")
                    cursor.execute("SELECT id, notification_time_minutes FROM user_settings")
                    records = cursor.fetchall()
                    
                    # Создаем новую таблицу
                    cursor.execute("""
                        CREATE TABLE user_settings_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER NOT NULL UNIQUE,
                            language VARCHAR(2) NOT NULL DEFAULT 'ru',
                            theme VARCHAR(10) NOT NULL DEFAULT 'dark',
                            notification_times_minutes TEXT NOT NULL DEFAULT '[30]',
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                    """)
                    
                    # Копируем данные
                    for record_id, old_value in records:
                        new_value = json.dumps([old_value] if old_value is not None else [30])
                        cursor.execute("""
                            SELECT user_id, language, theme, created_at, updated_at 
                            FROM user_settings WHERE id = ?
                        """, (record_id,))
                        other_fields = cursor.fetchone()
                        if other_fields:
                            cursor.execute("""
                                INSERT INTO user_settings_new 
                                (id, user_id, language, theme, notification_times_minutes, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            """, (record_id, other_fields[0], other_fields[1], other_fields[2], 
                                  new_value, other_fields[3], other_fields[4]))
                    
                    cursor.execute("DROP TABLE user_settings")
                    cursor.execute("ALTER TABLE user_settings_new RENAME TO user_settings")
                    cursor.execute("CREATE INDEX IF NOT EXISTS ix_user_settings_user_id ON user_settings(user_id)")
                    conn.commit()
                    logger.info(f"Миграция завершена. Преобразовано записей: {len(records)}")
                else:
                    # Просто добавляем новое поле
                    logger.info("Добавляю поле notification_times_minutes в user_settings")
                    cursor.execute("""
                        ALTER TABLE user_settings 
                        ADD COLUMN notification_times_minutes TEXT NOT NULL DEFAULT '[30]'
                    """)
                    cursor.execute("""
                        UPDATE user_settings 
                        SET notification_times_minutes = '[30]' 
                        WHERE notification_times_minutes IS NULL
                    """)
                    conn.commit()
                    logger.info("Поле notification_times_minutes добавлено")
            
            conn.close()
    except Exception as e:
        logger.warning(f"Не удалось выполнить миграцию user_settings: {e}")
    
    # Запускаем планировщик уведомлений о дедлайнах
    from .services.notification_service import start_scheduler, stop_scheduler
    start_scheduler()
    logger.info("Планировщик уведомлений о дедлайнах запущен")
    
    try:
        yield
    finally:
        # Shutdown
        stop_scheduler()
        logger.info("Планировщик уведомлений о дедлайнах остановлен")


def create_app() -> FastAPI:
    app = FastAPI(title="UniTask Tracker", version="0.1.0", lifespan=lifespan)

    # Добавляем логирование запросов
    app.add_middleware(LoggingMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Разрешаем запросы с любых адресов и портов
        allow_credentials=False,  # Отключаем credentials для совместимости с allow_origins=["*"]
        allow_methods=["*"],  # Разрешаем все HTTP методы (включая OPTIONS)
        allow_headers=["*"],  # Разрешаем все заголовки
        expose_headers=["*"],  # Разрешаем доступ ко всем заголовкам ответа
    )

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(crud.router)
    app.include_router(webhook.router)
    app.include_router(settings.router)

    return app


app = create_app()


