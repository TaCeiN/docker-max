#!/bin/bash
# Скрипт для автоматического открытия портов в firewall
# Работает с UFW (Ubuntu/Debian) и firewalld (CentOS/RHEL)

set -e

echo "=========================================="
echo "🔥 Настройка firewall"
echo "=========================================="
echo ""

# Проверяем наличие UFW
if command -v ufw &> /dev/null; then
    echo "✅ Обнаружен UFW (Ubuntu/Debian firewall)"
    
    # Проверяем, включен ли firewall
    if ufw status | grep -q "Status: active"; then
        echo "✅ UFW уже активен"
    else
        echo "⚠️ UFW не активен, включаем..."
        # Разрешаем SSH перед включением (чтобы не заблокировать себя)
        ufw allow 22/tcp
        ufw --force enable
    fi
    
    # Открываем порты для HTTP и HTTPS
    echo "🔓 Открываем порты 80 (HTTP) и 443 (HTTPS)..."
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    echo "✅ Порты открыты"
    echo ""
    echo "📊 Текущий статус firewall:"
    ufw status
    
# Проверяем наличие firewalld
elif command -v firewall-cmd &> /dev/null; then
    echo "✅ Обнаружен firewalld (CentOS/RHEL firewall)"
    
    # Проверяем, запущен ли firewalld
    if systemctl is-active --quiet firewalld; then
        echo "✅ firewalld активен"
    else
        echo "⚠️ firewalld не запущен, запускаем..."
        systemctl start firewalld
        systemctl enable firewalld
    fi
    
    # Открываем порты для HTTP и HTTPS
    echo "🔓 Открываем порты 80 (HTTP) и 443 (HTTPS)..."
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
    
    echo "✅ Порты открыты"
    echo ""
    echo "📊 Текущий статус firewall:"
    firewall-cmd --list-all
    
# Если firewall не найден
else
    echo "⚠️ Не обнаружен UFW или firewalld"
    echo "⚠️ Убедитесь, что порты 80 и 443 открыты в вашем firewall"
    echo ""
    echo "Для UFW (Ubuntu/Debian):"
    echo "  sudo ufw allow 80/tcp"
    echo "  sudo ufw allow 443/tcp"
    echo ""
    echo "Для firewalld (CentOS/RHEL):"
    echo "  sudo firewall-cmd --permanent --add-service=http"
    echo "  sudo firewall-cmd --permanent --add-service=https"
    echo "  sudo firewall-cmd --reload"
    echo ""
    echo "Для iptables:"
    echo "  sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT"
    echo "  sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Firewall настроен успешно!"
echo "=========================================="
echo ""
echo "Порты 80 (HTTP) и 443 (HTTPS) открыты для входящих соединений"

