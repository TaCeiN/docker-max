#!/bin/sh
set -e

echo "🚀 Starting deployment to GitHub Pages..."

# Проверяем наличие необходимых переменных
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: GITHUB_TOKEN is not set"
    exit 1
fi

if [ -z "$GITHUB_REPO" ]; then
    echo "❌ Error: GITHUB_REPO is not set"
    exit 1
fi

# Настраиваем git
git config --global user.name "${GITHUB_USER:-GitHub Actions}"
git config --global user.email "${GITHUB_EMAIL:-noreply@github.com}"

# Билдим фронтенд
echo "📦 Building frontend..."
npm run build

# Клонируем репозиторий GitHub Pages
echo "📥 Cloning GitHub Pages repository..."
REPO_URL="https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git"
TEMP_DIR="/tmp/gh-pages"

rm -rf $TEMP_DIR
git clone $REPO_URL $TEMP_DIR

# Копируем собранные файлы
echo "📋 Copying built files..."
cd $TEMP_DIR

# Удаляем все файлы кроме .git
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} + 2>/dev/null || true

# Копируем все файлы из dist
cp -r /app/dist/* .

# Коммитим и пушим изменения
echo "💾 Committing changes..."
git add -A

# Проверяем, есть ли изменения для коммита
if git diff --staged --quiet; then
    echo "ℹ️  No changes to commit. The repository is already up to date."
else
    git commit -m "Deploy frontend: $(date +'%Y-%m-%d %H:%M:%S')"
    echo "📤 Pushing changes to GitHub..."
    git push origin main
    if [ $? -eq 0 ]; then
        echo "✅ Changes pushed successfully!"
    else
        echo "❌ Failed to push changes. Check your GITHUB_TOKEN permissions."
        exit 1
    fi
fi

echo "✅ Deployment completed successfully!"
echo "🌐 Your site will be available at: https://$(echo $GITHUB_REPO | cut -d'/' -f1).github.io"

