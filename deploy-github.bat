@echo off
REM Скрипт для деплоя фронтенда на GitHub Pages через Docker (вариант 1)
REM Убедитесь, что файл .env существует и содержит все необходимые переменные

echo ==========================================
echo 🚀 Деплой на GitHub Pages (вариант 1)
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

if "%GITHUB_TOKEN%"=="" (
    echo ❌ Error: GITHUB_TOKEN is not set in .env (required for GitHub Pages deployment)
    pause
    exit /b 1
)

echo ✅ Environment variables loaded
echo    BACKEND_DOMAIN: %BACKEND_DOMAIN%
echo    WEBHOOK_DOMAIN: %WEBHOOK_DOMAIN%
echo    BACKEND_URL: %BACKEND_URL%
echo    WEBHOOK_URL: %WEBHOOK_URL%
echo    LETSENCRYPT_EMAIL: %LETSENCRYPT_EMAIL%
echo    GITHUB_REPO: %GITHUB_REPO%
echo.

echo 🔧 Starting Nginx reverse proxy and Let's Encrypt...
docker compose -f docker-compose.github.yml up -d nginx-proxy letsencrypt

echo ⏳ Waiting for Nginx proxy to be ready...
timeout /t 5 /nobreak >nul

echo 🔨 Building and starting backend and webhook containers...
docker compose -f docker-compose.github.yml up --build -d backend webhook

echo ⏳ Waiting for backend to be ready...
timeout /t 5 /nobreak >nul

echo 🚀 Starting frontend deployment to GitHub Pages...
docker compose -f docker-compose.github.yml up --build frontend-deploy

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==========================================
    echo ✅ Deployment completed successfully!
    echo ==========================================
    echo.
    echo 📊 Services status:
    docker compose -f docker-compose.github.yml ps
    echo.
    echo 🌐 Backend: %BACKEND_URL%
    echo 🔔 Webhook: %WEBHOOK_URL%
    echo 📱 Frontend: https://github.com/%GITHUB_REPO%
    echo.
    echo 🔒 SSL сертификаты будут автоматически получены и обновлены через Let's Encrypt
    echo    Первый запуск может занять несколько минут для получения сертификатов
    echo.
    echo 📝 View logs:
    echo    docker compose -f docker-compose.github.yml logs -f
    echo.
    echo 📝 Check SSL certificate status:
    echo    docker compose -f docker-compose.github.yml logs letsencrypt
) else (
    echo.
    echo ==========================================
    echo ❌ Deployment failed!
    echo ==========================================
    echo.
    echo 📝 Check logs:
    echo    docker compose -f docker-compose.github.yml logs
)

pause

