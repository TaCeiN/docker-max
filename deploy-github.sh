#!/bin/bash
# Скрипт для деплоя фронтенда на GitHub Pages через Docker (вариант 1)
# Убедитесь, что файл .env существует и содержит все необходимые переменные

set -e

echo "=========================================="
echo "🚀 Деплой на GitHub Pages (вариант 1)"
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

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: GITHUB_TOKEN is not set in .env (required for GitHub Pages deployment)"
    exit 1
fi

echo "✅ Environment variables loaded"
echo "   BACKEND_DOMAIN: ${BACKEND_DOMAIN}"
echo "   WEBHOOK_DOMAIN: ${WEBHOOK_DOMAIN}"
echo "   BACKEND_URL: ${BACKEND_URL}"
echo "   WEBHOOK_URL: ${WEBHOOK_URL}"
echo "   LETSENCRYPT_EMAIL: ${LETSENCRYPT_EMAIL}"
echo "   GITHUB_REPO: ${GITHUB_REPO:-tacein/tacein.github.io}"
echo ""

echo "🔧 Starting Nginx reverse proxy and Let's Encrypt..."
docker compose -f docker-compose.github.yml up -d nginx-proxy letsencrypt

echo "⏳ Waiting for Nginx proxy to be ready..."
sleep 5

echo "🔨 Building and starting backend and webhook containers..."
docker compose -f docker-compose.github.yml up --build -d backend webhook

echo "⏳ Waiting for backend to be ready..."
sleep 5

echo "🚀 Starting frontend deployment to GitHub Pages..."
docker compose -f docker-compose.github.yml up --build frontend-deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ Deployment completed successfully!"
    echo "=========================================="
    echo ""
    echo "📊 Services status:"
    docker compose -f docker-compose.github.yml ps
    echo ""
    echo "🌐 Backend: ${BACKEND_URL}"
    echo "🔔 Webhook: ${WEBHOOK_URL}"
    echo "📱 Frontend: https://$(echo ${GITHUB_REPO:-tacein/tacein.github.io} | cut -d'/' -f1).github.io"
    echo ""
    echo "🔒 SSL сертификаты будут автоматически получены и обновлены через Let's Encrypt"
    echo "   Первый запуск может занять несколько минут для получения сертификатов"
    echo ""
    echo "📝 View logs:"
    echo "   docker compose -f docker-compose.github.yml logs -f"
    echo ""
    echo "📝 Check SSL certificate status:"
    echo "   docker compose -f docker-compose.github.yml logs letsencrypt"
else
    echo ""
    echo "=========================================="
    echo "❌ Deployment failed!"
    echo "=========================================="
    echo ""
    echo "📝 Check logs:"
    echo "   docker compose -f docker-compose.github.yml logs"
    exit 1
fi

