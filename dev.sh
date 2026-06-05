#!/usr/bin/env bash



# Убиваем старые зависшие процессы
pkill -f "vite --port" 2>/dev/null
pkill -f "electron \." 2>/dev/null
fuser -k 5173/tcp 2>/dev/null
fuser -k 5174/tcp 2>/dev/null
fuser -k 5175/tcp 2>/dev/null
sleep 0.5

npm run build

# Запускаем и привязываем к текущей группе процессов
# При Ctrl+C или закрытии терминала — убиваем всё дерево
trap 'kill 0' EXIT INT TERM

npx vite --port 5173 &
VITE_PID=$!

# Ждём порт — используем bash /dev/tcp вместо nc (nc не везде установлен или виснет)
echo "Waiting for Vite..."
WAITED=0
until (echo >/dev/tcp/localhost/5173) 2>/dev/null; do
  sleep 0.2
  WAITED=$((WAITED + 1))
  if [ $WAITED -ge 75 ]; then   # 15 секунд таймаут
    echo "ERROR: Vite не стартовал за 15с, выходим"
    kill $VITE_PID 2>/dev/null
    exit 1
  fi
done
echo "Vite ready, starting Electron..."

NODE_ENV=development npx electron . &
ELECTRON_PID=$!

# Ждём завершения Electron
wait $ELECTRON_PID
echo "Electron exited, stopping Vite..."
kill $VITE_PID 2>/dev/null
