#!/bin/bash
# Скрипт для сборки фронтенда для ручного деплоя через Docker (вариант 2)
# Убедитесь, что файл .env существует и содержит все необходимые переменные

set -e

echo "=========================================="
echo "🔨 Сборка для ручного деплоя (вариант 2)"
echo "=========================================="
echo ""

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file based on env.example"
    echo ""
    echo "Example:"
    echo "  cp env.example .env"
    echo "  # Then edit .env and fill in all required values"
    exit 1
fi

echo "📋 Loading environment variables from .env..."
# Загружаем переменные из .env (игнорируем комментарии и пустые строки)
export $(grep -v '^#' .env | grep -v '^$' | xargs)

# Проверяем обязательные переменные
if [ -z "$MAX_BOT_TOKEN" ]; then
    echo "❌ Error: MAX_BOT_TOKEN is not set in .env"
    exit 1
fi

if [ -z "$BACKEND_DOMAIN" ]; then
    echo "❌ Error: BACKEND_DOMAIN is not set in .env"
    exit 1
fi

if [ -z "$WEBHOOK_DOMAIN" ]; then
    echo "❌ Error: WEBHOOK_DOMAIN is not set in .env"
    exit 1
fi

if [ -z "$BACKEND_URL" ]; then
    echo "❌ Error: BACKEND_URL is not set in .env"
    exit 1
fi

if [ -z "$WEBHOOK_URL" ]; then
    echo "❌ Error: WEBHOOK_URL is not set in .env"
    exit 1
fi

if [ -z "$SECRET_KEY" ]; then
    echo "❌ Error: SECRET_KEY is not set in .env"
    exit 1
fi

if [ -z "$LETSENCRYPT_EMAIL" ]; then
    echo "❌ Error: LETSENCRYPT_EMAIL is not set in .env (required for SSL certificates)"
    exit 1
fi

echo "✅ Environment variables loaded"
echo "   BACKEND_DOMAIN: ${BACKEND_DOMAIN}"
echo "   WEBHOOK_DOMAIN: ${WEBHOOK_DOMAIN}"
echo "   BACKEND_URL: ${BACKEND_URL}"
echo "   WEBHOOK_URL: ${WEBHOOK_URL}"
echo "   LETSENCRYPT_EMAIL: ${LETSENCRYPT_EMAIL}"
echo ""

echo "🔨 Building frontend..."
docker compose -f docker-compose.manual.yml up --build frontend-build

echo "⏳ Waiting for build to complete..."
sleep 2

echo "🔧 Starting Nginx reverse proxy and Let's Encrypt..."
docker compose -f docker-compose.manual.yml up -d nginx-proxy letsencrypt

echo "⏳ Waiting for Nginx proxy to be ready..."
sleep 5

echo "🚀 Starting backend and webhook services..."
docker compose -f docker-compose.manual.yml up -d backend webhook

echo "⏳ Waiting for services to be ready..."
sleep 5

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ Build and deployment completed!"
    echo "=========================================="
    echo ""
    echo "📊 Services status:"
    docker compose -f docker-compose.manual.yml ps
    echo ""
    echo "🌐 Backend: ${BACKEND_URL}"
    echo "🔔 Webhook: ${WEBHOOK_URL}"
    echo ""
    echo "🔒 SSL сертификаты будут автоматически получены и обновлены через Let's Encrypt"
    echo "   Первый запуск может занять несколько минут для получения сертификатов"
    echo ""
    echo "📦 Frontend build files are in Docker volume 'frontend-build'"
    echo ""
    echo "📝 To copy frontend files from volume:"
    echo "   docker run --rm -v unitask_frontend-build:/source -v \$(pwd)/frontend-dist:/dest alpine sh -c 'cp -r /source/* /dest/'"
    echo ""
    echo "   Or use docker cp:"
    echo "   CONTAINER_ID=\$(docker create -v unitask_frontend-build:/source alpine)"
    echo "   docker cp \$CONTAINER_ID:/source ./frontend-dist"
    echo "   docker rm \$CONTAINER_ID"
    echo ""
    echo "📝 View logs:"
    echo "   docker compose -f docker-compose.manual.yml logs -f"
    echo ""
    echo "📝 Check SSL certificate status:"
    echo "   docker compose -f docker-compose.manual.yml logs letsencrypt"
else
    echo ""
    echo "=========================================="
    echo "❌ Build or deployment failed!"
    echo "=========================================="
    echo ""
    echo "📝 Check logs:"
    echo "   docker compose -f docker-compose.manual.yml logs"
    exit 1
fi

