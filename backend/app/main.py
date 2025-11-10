from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import logging

from .routers import health, auth
from .routers import crud, webhook
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

    return app


app = create_app()


