# Деплой через Docker

Этот документ описывает, как задеплоить проект используя Docker с двумя вариантами деплоя фронтенда.

## Автоматическая настройка Nginx и SSL

Проект использует **автоматическую настройку** через Docker:
- ✅ **Nginx Reverse Proxy** - автоматически настраивается для backend и webhook
- ✅ **SSL сертификаты** - автоматически получаются через Let's Encrypt
- ✅ **Автообновление SSL** - сертификаты обновляются автоматически
- ✅ **Firewall** - можно настроить автоматически через скрипт

**Важно:** Вам не нужно вручную настраивать Nginx или SSL - всё настраивается автоматически при запуске Docker контейнеров!

## Два варианта деплоя

### Вариант 1: GitHub Pages деплой
- Автоматическая сборка фронтенда
- Автоматический деплой на GitHub Pages
- Запуск Backend и Webhook серверов с автоматическим Nginx и SSL
- Автоматическая подписка на webhooks

### Вариант 2: Ручной деплой
- Автоматическая сборка фронтенда
- Сохранение собранных файлов в Docker volume
- Запуск Backend и Webhook серверов с автоматическим Nginx и SSL
- Автоматическая подписка на webhooks
- Ручной деплой фронтенда (пользователь копирует файлы из volume)

## Подготовка

### 1. Создание GitHub Personal Access Token (только для варианта 1)

Для деплоя на GitHub Pages нужен GitHub Personal Access Token (PAT), а не SSH ключ.

1. Перейдите на GitHub: https://github.com/settings/tokens
2. Нажмите "Generate new token" → "Generate new token (classic)"
3. Назовите токен (например, "GitHub Pages Deploy")
4. Выберите срок действия (рекомендуется: "No expiration" или "90 days")
5. Выберите права доступа:
   - ✅ `repo` (полный доступ к репозиториям)
   - Или минимум: `public_repo` (если репозиторий публичный)
6. Нажмите "Generate token"
7. **Скопируйте токен сразу** (он больше не будет показан!)

### 2. Генерация SECRET_KEY для JWT

JWT ключ должен быть случайной строкой минимум 32 символа. Варианты генерации:

#### Python:
```python
import secrets
print(secrets.token_urlsafe(32))
```

#### OpenSSL:
```bash
openssl rand -hex 32
```

#### PowerShell (Windows):
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

#### Linux/Mac:
```bash
openssl rand -base64 32
```

**Важно:** Используйте уникальный SECRET_KEY для каждого окружения (dev/prod)!

### 3. Настройка переменных окружения

Создайте файл `.env` в корне проекта на основе `env.example`:

```bash
# Windows
copy env.example .env

# Linux/Mac
cp env.example .env
```

Или создайте файл `.env` вручную и скопируйте содержимое из `env.example`, затем заполните все переменные реальными значениями.

Заполните все обязательные переменные в `.env`:

#### Обязательные переменные (оба варианта):
- `MAX_BOT_TOKEN` - токен бота (получите от MasterBot: https://tt.me/MasterBot)
- `BACKEND_DOMAIN` - домен для backend API (например: backend-devcore-max.cloudpub.ru)
- `WEBHOOK_DOMAIN` - домен для webhook сервера (например: webhook-devcore-max.cloudpub.ru)
- `BACKEND_URL` - полный URL backend API (например: https://backend-devcore-max.cloudpub.ru)
- `WEBHOOK_URL` - полный URL webhook сервера (например: https://webhook-devcore-max.cloudpub.ru)
- `SECRET_KEY` - секретный ключ для JWT (сгенерируйте как описано выше)
- `LETSENCRYPT_EMAIL` - email для Let's Encrypt (для получения SSL сертификатов)

#### Только для варианта 1 (GitHub Pages):
- `GITHUB_TOKEN` - токен для деплоя на GitHub Pages
- `GITHUB_REPO` - репозиторий GitHub Pages (например: tacein/tacein.github.io)
- `GITHUB_USER` - пользователь GitHub для коммитов
- `GITHUB_EMAIL` - email для коммитов

### 4. Настройка DNS записей

**Важно:** Перед запуском убедитесь, что DNS записи для ваших доменов настроены:

1. В панели управления вашим доменом добавьте **A-записи**:
   - `backend-devcore-max.cloudpub.ru` → IP вашего VPS
   - `webhook-devcore-max.cloudpub.ru` → IP вашего VPS

2. Дождитесь распространения DNS (обычно несколько минут, может занять до 24 часов)

3. Проверьте, что домены резолвятся:
   ```bash
   nslookup backend-devcore-max.cloudpub.ru
   nslookup webhook-devcore-max.cloudpub.ru
   ```

**Без настроенных DNS записей SSL сертификаты не будут получены!**

### 5. Настройка Firewall (опционально, автоматически)

Для автоматической настройки firewall запустите скрипт:

**Linux/Mac:**
```bash
chmod +x setup-firewall.sh
sudo ./setup-firewall.sh
```

**Windows (требует прав администратора):**
```bash
setup-firewall.bat
```

Скрипт автоматически:
- Определит тип firewall (UFW, firewalld, или iptables)
- Откроет порты 80 (HTTP) и 443 (HTTPS)
- Настроит правила firewall

**Или вручную:**

**UFW (Ubuntu/Debian):**
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH (если еще не открыт)
```

**firewalld (CentOS/RHEL):**
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 6. Добавьте .env в .gitignore

Убедитесь, что `.env` добавлен в `.gitignore`:

```bash
echo ".env" >> .gitignore
```

## Деплой

### Вариант 1: Деплой на GitHub Pages

**Windows:**
```bash
deploy-github.bat
```

**Linux/Mac:**
```bash
chmod +x deploy-github.sh
./deploy-github.sh
```

Что происходит:
1. Запускаются **nginx-proxy** и **letsencrypt** контейнеры (автоматическая настройка Nginx и SSL)
2. Запускаются **backend** и **webhook** контейнеры
3. Собирается фронтенд с адресами из переменных окружения
4. Фронтенд автоматически деплоится на GitHub Pages
5. Webhook сервер автоматически подписывается на webhooks
6. **SSL сертификаты автоматически получаются** через Let's Encrypt (может занять несколько минут)

### Вариант 2: Ручной деплой

**Windows:**
```bash
deploy-manual.bat
```

**Linux/Mac:**
```bash
chmod +x deploy-manual.sh
./deploy-manual.sh
```

Что происходит:
1. Собирается фронтенд с адресами из переменных окружения
2. Собранные файлы сохраняются в Docker volume `frontend-build`
3. Запускаются **nginx-proxy** и **letsencrypt** контейнеры (автоматическая настройка Nginx и SSL)
4. Запускаются **backend** и **webhook** контейнеры
5. Webhook сервер автоматически подписывается на webhooks
6. **SSL сертификаты автоматически получаются** через Let's Encrypt (может занять несколько минут)

#### Копирование файлов из volume

После сборки скопируйте файлы из volume для ручного деплоя:

**Linux/Mac:**
```bash
docker run --rm -v unitask_frontend-build:/source -v $(pwd)/frontend-dist:/dest alpine sh -c 'cp -r /source/* /dest/'
```

**Windows:**
```bash
docker run --rm -v unitask_frontend-build:/source -v %cd%\frontend-dist:/dest alpine sh -c "cp -r /source/* /dest/"
```

Или используйте `docker cp`:
```bash
# Создаем временный контейнер
CONTAINER_ID=$(docker create -v unitask_frontend-build:/source alpine)

# Копируем файлы
docker cp $CONTAINER_ID:/source ./frontend-dist

# Удаляем контейнер
docker rm $CONTAINER_ID
```

## Проверка деплоя

### Проверка сервисов

После деплоя проверьте статус контейнеров:

```bash
# Вариант 1
docker compose -f docker-compose.github.yml ps

# Вариант 2
docker compose -f docker-compose.manual.yml ps
```

### Просмотр логов

```bash
# Вариант 1
docker compose -f docker-compose.github.yml logs -f

# Вариант 2
docker compose -f docker-compose.manual.yml logs -f
```

### Проверка endpoints

После деплоя сервисы доступны через HTTPS:

- **Backend**: `https://your-backend-domain/health` (например: https://backend-devcore-max.cloudpub.ru/health)
- **Webhook**: `https://your-webhook-domain/health` (например: https://webhook-devcore-max.cloudpub.ru/health)
- **Frontend** (вариант 1): `https://username.github.io`

**Примечание:** Первый запуск может занять несколько минут для получения SSL сертификатов. До получения сертификатов доступ может быть только по HTTP.

### Проверка SSL сертификатов

Проверьте статус получения SSL сертификатов:

```bash
# Вариант 1
docker compose -f docker-compose.github.yml logs letsencrypt

# Вариант 2
docker compose -f docker-compose.manual.yml logs letsencrypt
```

Или проверьте через браузер:
- Откройте `https://your-backend-domain` в браузере
- Проверьте, что сертификат валиден (замок в адресной строке)

**Важно:** Если SSL сертификаты не получены, убедитесь, что:
1. DNS записи настроены и домены резолвятся на IP вашего VPS
2. Порты 80 и 443 открыты в firewall
3. В `.env` указан правильный `LETSENCRYPT_EMAIL`
4. Домены доступны из интернета (не только локально)

## Архитектура

### Nginx Reverse Proxy и SSL

Проект использует автоматическую настройку через Docker контейнеры:

1. **nginx-proxy** - автоматически настраивает reverse proxy для всех контейнеров с переменной `VIRTUAL_HOST`
2. **letsencrypt** - автоматически получает и обновляет SSL сертификаты через Let's Encrypt
3. **Автоматическая маршрутизация** - запросы к доменам автоматически проксируются на соответствующие контейнеры
4. **Автоматическое обновление SSL** - сертификаты обновляются автоматически до истечения срока действия

**Как это работает:**
- Контейнеры `backend` и `webhook` имеют переменные окружения `VIRTUAL_HOST` и `LETSENCRYPT_HOST`
- `nginx-proxy` автоматически создает конфигурацию Nginx для этих доменов
- `letsencrypt` автоматически получает SSL сертификаты для доменов
- Все запросы к доменам проксируются на соответствующие контейнеры через HTTPS

**Порты:**
- Порт 80 (HTTP) - используется для редиректа на HTTPS и для получения SSL сертификатов
- Порт 443 (HTTPS) - основной порт для доступа к сервисам
- Backend и Webhook контейнеры не пробрасывают порты наружу, доступ только через nginx-proxy

### База данных

Backend и webhook server используют один общий файл SQLite через общий volume:
- Файл БД: `data.sqlite3` в volume `backend-data`
- Оба контейнера монтируют этот volume
- SQLite поддерживает concurrent access с `check_same_thread=False`

### Автоматическая подписка на webhooks

При старте webhook контейнера автоматически выполняется:
1. Проверка наличия MAX_BOT_TOKEN
2. Проверка текущих подписок
3. Удаление старой подписки на WEBHOOK_URL (если существует)
4. Создание новой подписки на WEBHOOK_URL
5. Запуск webhook сервера

## Устранение проблем

### Ошибка: "MAX_BOT_TOKEN is not set"
- Убедитесь, что переменная `MAX_BOT_TOKEN` установлена в `.env`
- Проверьте, что файл `.env` находится в корне проекта

### Ошибка: "SECRET_KEY is not set"
- Убедитесь, что переменная `SECRET_KEY` установлена в `.env`
- Сгенерируйте новый ключ как описано выше

### Ошибка: "GITHUB_TOKEN is not set" (вариант 1)
- Убедитесь, что переменная `GITHUB_TOKEN` установлена в `.env`
- Проверьте, что токен имеет права `repo` или `public_repo`

### Ошибка: "Permission denied" или "Authentication failed"
- Проверьте, что токен правильный и не истек
- Убедитесь, что у токена есть права `repo` или `public_repo`

### Ошибка: "Repository not found"
- Проверьте, что репозиторий `GITHUB_REPO` существует
- Проверьте, что токен имеет доступ к репозиторию
- Убедитесь, что `GITHUB_REPO` указан правильно (формат: `username/repo`)

### Ошибка: "Webhook subscription failed"
- Проверьте, что `WEBHOOK_URL` доступен из интернета
- Убедитесь, что `WEBHOOK_URL` указывает на правильный адрес
- Проверьте, что webhook сервер запущен и доступен

### Ошибка: "Database locked"
- Убедитесь, что оба контейнера (backend и webhook) используют один volume
- Проверьте, что SQLite файл не заблокирован другим процессом
- Перезапустите контейнеры

### Ошибка: SSL сертификаты не получены
- Убедитесь, что DNS записи настроены и домены резолвятся на IP вашего VPS
- Проверьте, что порты 80 и 443 открыты в firewall
- Убедитесь, что в `.env` указан правильный `LETSENCRYPT_EMAIL`
- Проверьте логи letsencrypt контейнера: `docker compose -f docker-compose.github.yml logs letsencrypt`
- Убедитесь, что домены доступны из интернета (не только локально)
- Дождитесь распространения DNS записей (может занять до 24 часов)

### Ошибка: "502 Bad Gateway" или "Connection refused"
- Проверьте, что backend и webhook контейнеры запущены: `docker compose -f docker-compose.github.yml ps`
- Проверьте логи контейнеров: `docker compose -f docker-compose.github.yml logs backend webhook`
- Убедитесь, что контейнеры находятся в одной Docker сети (`unitask-network`)
- Проверьте, что nginx-proxy контейнер запущен: `docker compose -f docker-compose.github.yml ps nginx-proxy`

## Безопасность

⚠️ **Важно:**
- Никогда не коммитьте `.env` в git
- Не показывайте токены в логах или консоли
- Используйте токены с минимальными необходимыми правами
- Регулярно обновляйте токены (рекомендуется каждые 90 дней)
- Используйте уникальный SECRET_KEY для каждого окружения

## Остановка сервисов

### Остановка всех сервисов

```bash
# Вариант 1
docker compose -f docker-compose.github.yml down

# Вариант 2
docker compose -f docker-compose.manual.yml down
```

### Остановка с удалением volumes

```bash
# Вариант 1
docker compose -f docker-compose.github.yml down -v

# Вариант 2
docker compose -f docker-compose.manual.yml down -v
```

**Внимание:** Удаление volumes приведет к удалению базы данных и собранных файлов фронтенда!
