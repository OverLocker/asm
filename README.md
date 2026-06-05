<img width="2552" height="1361" alt="image" src="https://github.com/user-attachments/assets/4607ae7a-b0ea-46bd-b62c-30ded31561c2" />


<img width="1005" height="1117" alt="image" src="https://github.com/user-attachments/assets/b33c55fd-1d04-484a-981e-d1789bacd5af" />

<img width="2551" height="1359" alt="image" src="https://github.com/user-attachments/assets/002d6a65-02dd-4e35-bd44-d77e508abe97" />


<img width="2551" height="1359" alt="image" src="https://github.com/user-attachments/assets/805cef4f-e2a5-422c-acd0-04be3d0be7f9" />




# ASM — Absolute Session Manager

Десктопный менеджер SSH-сессий для Linux. Electron + React.

![Electron](https://img.shields.io/badge/Electron-29-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Platform](https://img.shields.io/badge/Platform-Linux-FCC624?logo=linux)

---

## Возможности

### SSH
- Читает хосты из `~/.ssh/config` напрямую — никакой отдельной базы, всё уже там
- Поддержка `Include`, алиасов, `ProxyJump`, `IdentityFile`
- Аутентификация: SSH-ключ, ssh-agent (`SSH_AUTH_SOCK`), пароль (хранится зашифрованно, AES-256)
- X11 Forwarding одной кнопкой
- Добавление/редактирование/удаление хостов прямо в GUI — записывается в `~/.ssh/config`
- История подключений на стартовом экране

### Терминал
- Встроенный xterm-терминал с поддержкой 256 цветов и truecolor
- Сплит-экран: делить терминал по горизонтали и вертикали
- В сплит-экране отправка команды сразу во все вкладки
- Локальный терминал по кнопке `+` (без SSH)
- Поиск по выводу терминала (Ctrl+F)
- Масштаб шрифта Ctrl+колесо для каждой вкладки независимо
- Переключение вкладок: Ctrl+Tab, Ctrl+1–9, Ctrl+W
- Фоновое изображение терминала с настройкой прозрачности

### SFTP
- Полноценный файловый менеджер SFTP в отдельной вкладке
- **SFTP Commander** — двухпанельный режим, как Midnight Commander, но для файлов между хостами
- Копирование файлов между разными хостами (piped copy, без сохранения на диск)
- Drag & drop файлов из SFTP на рабочий стол
- Встроенный текстовый редактор (CodeMirror) с подсветкой синтаксиса: JS, Python, YAML, JSON, HTML, CSS, XML
- Рекурсивная загрузка и скачивание папок
- Прогресс-бар для операций
- Переименование, создание папок, удаление
- Мини-SFTP панель в терминальной вкладке (опционально)

### Туннели
- SSH-туннели трёх типов: **Local forward**, **Remote forward**, **SOCKS5 proxy**
- Правила автозапуска туннелей при подключении к хосту
- Счётчик трафика для каждого туннеля
- Активные туннели в статусбаре

### Браузер
- Встроенный веб-браузер (webview) в отдельной вкладке
- Удобно для IPMI, Grafana, Kibana и других веб-интерфейсов серверов
- Прямой запуск из SFTP-вкладки или SFTP Commander
- Проброшенные туннели открываются сразу из локального браузер по клику

### Другие типы сессий
Помимо SSH — поддержка запуска через внешние клиенты:
- **VNC** — через `vncviewer`, `tigervnc-viewer`, `Remmina`
- **RDP** — через `xfreerdp`, `rdesktop`, `Remmina`
- **IPMI** — через браузер или `ipmitool`
- **Telnet**, **Mosh**, **Custom** — любая команда

### Организация
- Группы хостов с вложенностью (дерево)
- Цветовая маркировка хостов и вкладок
- Избранные хосты
- Заметки для каждого хоста
- Поиск по хостам с подсветкой
- Компактный режим отображения

### Тема и интерфейс
9 тем терминала: Catppuccin Mocha, Tokyo Night, Dracula, Gruvbox Dark, Solarized Dark, Nord, One Dark, Light (Paper), MC Friendly

6 тем интерфейса: Light, Dark, macOS, Dark Blue, Rosé Pine, System (следует системной)

Настройки: шрифт, размер, межстрочный интервал, стиль курсора, scrollback, масштаб UI

### Импорт / Экспорт
- Экспорт хостов, групп, заметок, цветов в JSON
- Импорт с предпросмотром и выбором что применять
- Сохраняет состояние окна между запусками

---

## Требования

- **Linux** (тестировалось на Ubuntu 22.04+, Debian 12+)
- **Node.js** 18+ и npm
- **Python 3** (нужен для сборки `node-pty`)
- `build-essential`, `libsecret-1-dev` (для нативных модулей)

---

## Установка

### Из исходников

```bash
# 1. Зависимости для сборки нативных модулей
sudo apt install build-essential libsecret-1-dev

# 2. Клонировать репозиторий
git clone https://github.com/<username>/asm.git
cd asm

# 3. Установить npm-зависимости
npm install

# 4. Запустить в режиме разработки
npm run dev
```

### Сборка AppImage

```bash
npm run build
# Готовый AppImage появится в dist/
```

---

## Разработка

```bash
npm run dev
```

Запускает Vite dev-сервер на `localhost:5173` и Electron в режиме `NODE_ENV=development`. DevTools открываются через меню Dev → Toggle DevTools.

Структура проекта:
```
src/
├── main/
│   ├── index.js      # Electron main process: IPC, SSH, PTY, SFTP, туннели
│   └── preload.js    # Context bridge — API для renderer
└── renderer/
    ├── App.jsx        # Корневой компонент
    ├── termSettings.js # Темы и настройки терминала
    ├── styles/
    │   └── global.css
    └── components/
        ├── Sidebar.jsx         # Панель хостов и групп
        ├── TerminalPane.jsx    # SSH/локальный терминал (xterm)
        ├── SplitPane.jsx       # Сплит-экран для терминалов
        ├── SftpPane.jsx        # SFTP файловый менеджер
        ├── SftpCommander.jsx   # Двухпанельный SFTP
        ├── SftpPanel.jsx       # Одна панель SFTP
        ├── TunnelPane.jsx      # Управление туннелями
        ├── BrowserPane.jsx     # Встроенный браузер
        ├── EditorPane.jsx      # Текстовый редактор (CodeMirror)
        ├── TabBar.jsx          # Панель вкладок
        ├── SettingsModal.jsx   # Настройки
        ├── AddHostModal.jsx    # Добавить/редактировать хост
        ├── TunnelRulesModal.jsx # Правила автотуннелей
        ├── WelcomePane.jsx     # Стартовый экран
        └── ActiveTunnels.jsx   # Список активных туннелей
```

### Пользовательские данные

Хранится в `~/.config/ASM/` (Linux):

| Файл | Содержимое |
|------|-----------|
| `settings.json` | Настройки терминала и интерфейса |
| `groups.json` | Группы хостов |
| `notes.json` | Заметки |
| `favorites.json` | Избранные |
| `history.json` | История подключений |
| `sessions.json` | VNC/RDP/Telnet сессии |
| `tunnel-rules.json` | Правила автотуннелей |
| `host-settings.json` | Цвета и настройки хостов |
| `passwords.json` | Пароли (AES-256, привязаны к машине) |
| `window-state.json` | Размер и позиция окна |

SSH-хосты хранятся в `~/.ssh/config` — стандартный файл, никакой миграции не нужно.

---

## Стек

| | |
|---|---|
| **Оболочка** | Electron 29 |
| **UI** | React 18, Vite 5 |
| **Терминал** | xterm.js 5 + FitAddon, SearchAddon, WebLinksAddon |
| **SSH** | ssh2 1.15 |
| **PTY** | node-pty |
| **Редактор** | CodeMirror 6 |
| **Файловый watcher** | chokidar |

---

## Лицензия

MIT
