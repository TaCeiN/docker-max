@echo off
REM Скрипт для автоматического открытия портов в firewall (Windows)
REM Требует прав администратора

echo ==========================================
echo 🔥 Настройка firewall (Windows)
echo ==========================================
echo.

REM Проверяем права администратора
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Этот скрипт требует прав администратора
    echo Запустите от имени администратора
    pause
    exit /b 1
)

echo ✅ Права администратора подтверждены
echo.

echo 🔓 Открываем порты 80 (HTTP) и 443 (HTTPS)...
netsh advfirewall firewall add rule name="Docker HTTP" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="Docker HTTPS" dir=in action=allow protocol=TCP localport=443

if %ERRORLEVEL% EQU 0 (
    echo ✅ Порты открыты успешно
    echo.
    echo 📊 Проверка правил firewall:
    netsh advfirewall firewall show rule name="Docker HTTP"
    netsh advfirewall firewall show rule name="Docker HTTPS"
) else (
    echo ❌ Ошибка при открытии портов
    pause
    exit /b 1
)

echo.
echo ==========================================
echo ✅ Firewall настроен успешно!
echo ==========================================
echo.
echo Порты 80 (HTTP) и 443 (HTTPS) открыты для входящих соединений
pause

