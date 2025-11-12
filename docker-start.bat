@echo off
REM Скрипт для быстрого запуска Docker контейнеров (Windows)

echo 🚀 Запуск Docker контейнеров...

REM Проверка наличия Docker
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker не установлен. Установите Docker и попробуйте снова.
    exit /b 1
)

REM Запуск контейнеров
echo 📦 Сборка и запуск контейнеров...
docker compose up -d --build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Контейнеры успешно запущены!
    echo.
    echo 📍 Доступные сервисы:
    echo    - Фронтенд: http://localhost
    echo    - Бэкенд:   http://localhost:8000
    echo    - Health:   http://localhost:8000/health
    echo.
    echo 📋 Полезные команды:
    echo    - Просмотр логов: docker compose logs -f
    echo    - Остановка:     docker compose down
    echo    - Перезапуск:    docker compose restart
) else (
    echo ❌ Ошибка при запуске контейнеров
    exit /b 1
)

