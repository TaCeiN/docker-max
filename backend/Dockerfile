FROM python:3.11-slim

WORKDIR /app

# Копируем файлы зависимостей
COPY requirements.txt .

# Устанавливаем зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код приложения
COPY . .

# Переменные окружения (будут переопределены через environment в docker-compose)
ENV DATABASE_URL=sqlite:///./data/data.sqlite3
ENV SECRET_KEY=dev-secret-key-change-in-production
ENV ACCESS_TOKEN_EXPIRE_MINUTES=180
ENV MAX_BOT_TOKEN=""

# Создаем директорию для БД
RUN mkdir -p /app/data

# Открываем порт
EXPOSE 8000

# Запускаем приложение
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

