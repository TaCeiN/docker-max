@echo off
REM Скрипт для сборки фронтенда для ручного деплоя через Docker (вариант 2)
REM Убедитесь, что файл .env существует и содержит все необходимые переменные

echo ==========================================
echo 🔨 Сборка для ручного деплоя (вариант 2)
echo ==========================================
echo.

REM Проверяем наличие .env файла
if not exist .env (
    echo ❌ Error: .env file not found!
    echo Please create .env file based on env.example
    echo.
    echo Example:
    echo   copy env.example .env
    echo   REM Then edit .env and fill in all required values
    pause
    exit /b 1
)

echo 📋 Loading environment variables from .env...
REM Загружаем переменные из .env
for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
    set "%%a=%%b"
)

REM Проверяем обязательные переменные
if "%MAX_BOT_TOKEN%"=="" (
    echo ❌ Error: MAX_BOT_TOKEN is not set in .env
    pause
    exit /b 1
)

if "%BACKEND_DOMAIN%"=="" (
    echo ❌ Error: BACKEND_DOMAIN is not set in .env
    pause
    exit /b 1
)

if "%WEBHOOK_DOMAIN%"=="" (
    echo ❌ Error: WEBHOOK_DOMAIN is not set in .env
    pause
    exit /b 1
)

if "%BACKEND_URL%"=="" (
    echo ❌ Error: BACKEND_URL is not set in .env
    pause
    exit /b 1
)

if "%WEBHOOK_URL%"=="" (
    echo ❌ Error: WEBHOOK_URL is not set in .env
    pause
    exit /b 1
)

if "%SECRET_KEY%"=="" (
    echo ❌ Error: SECRET_KEY is not set in .env
    pause
    exit /b 1
)

if "%LETSENCRYPT_EMAIL%"=="" (
    echo ❌ Error: LETSENCRYPT_EMAIL is not set in .env (required for SSL certificates)
    pause
    exit /b 1
)

echo ✅ Environment variables loaded
echo    BACKEND_DOMAIN: %BACKEND_DOMAIN%
echo    WEBHOOK_DOMAIN: %WEBHOOK_DOMAIN%
echo    BACKEND_URL: %BACKEND_URL%
echo    WEBHOOK_URL: %WEBHOOK_URL%
echo    LETSENCRYPT_EMAIL: %LETSENCRYPT_EMAIL%
echo.

echo 🔨 Building frontend...
docker compose -f docker-compose.manual.yml up --build frontend-build

echo ⏳ Waiting for build to complete...
timeout /t 2 /nobreak >nul

echo 🔧 Starting Nginx reverse proxy and Let's Encrypt...
docker compose -f docker-compose.manual.yml up -d nginx-proxy letsencrypt

echo ⏳ Waiting for Nginx proxy to be ready...
timeout /t 5 /nobreak >nul

echo 🚀 Starting backend and webhook services...
docker compose -f docker-compose.manual.yml up -d backend webhook

echo ⏳ Waiting for services to be ready...
timeout /t 5 /nobreak >nul

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==========================================
    echo ✅ Build and deployment completed!
    echo ==========================================
    echo.
    echo 📊 Services status:
    docker compose -f docker-compose.manual.yml ps
    echo.
    echo 🌐 Backend: %BACKEND_URL%
    echo 🔔 Webhook: %WEBHOOK_URL%
    echo.
    echo 🔒 SSL сертификаты будут автоматически получены и обновлены через Let's Encrypt
    echo    Первый запуск может занять несколько минут для получения сертификатов
    echo.
    echo 📦 Frontend build files are in Docker volume 'frontend-build'
    echo.
    echo 📝 To copy frontend files from volume, use docker cp or run:
    echo    docker run --rm -v unitask_frontend-build:/source -v %cd%\frontend-dist:/dest alpine sh -c "cp -r /source/* /dest/"
    echo.
    echo 📝 View logs:
    echo    docker compose -f docker-compose.manual.yml logs -f
    echo.
    echo 📝 Check SSL certificate status:
    echo    docker compose -f docker-compose.manual.yml logs letsencrypt
) else (
    echo.
    echo ==========================================
    echo ❌ Build or deployment failed!
    echo ==========================================
    echo.
    echo 📝 Check logs:
    echo    docker compose -f docker-compose.manual.yml logs
)

pause

