#!/bin/bash

# Скрипт для быстрого запуска Docker контейнеров

echo "🚀 Запуск Docker контейнеров..."

# Проверка наличия Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker и попробуйте снова."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose не установлен. Установите Docker Compose и попробуйте снова."
    exit 1
fi

# Запуск контейнеров
echo "📦 Сборка и запуск контейнеров..."
docker compose up -d --build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Контейнеры успешно запущены!"
    echo ""
    echo "📍 Доступные сервисы:"
    echo "   - Фронтенд: http://localhost"
    echo "   - Бэкенд:   http://localhost:8000"
    echo "   - Health:   http://localhost:8000/health"
    echo ""
    echo "📋 Полезные команды:"
    echo "   - Просмотр логов: docker compose logs -f"
    echo "   - Остановка:     docker compose down"
    echo "   - Перезапуск:    docker compose restart"
else
    echo "❌ Ошибка при запуске контейнеров"
    exit 1
fi

