// Темы терминала — только цветовые схемы (фон задаётся отдельно)
export const TERM_THEMES = {
  'Catppuccin Mocha': {
    foreground:   '#cdd6f4',
    cursor:       '#f5e0dc',
    selectionBackground: '#585b7066',
    black:        '#45475a', red:     '#f38ba8', green:   '#a6e3a1', yellow:  '#f9e2af',
    blue:         '#89b4fa', magenta: '#f5c2e7', cyan:    '#94e2d5', white:   '#bac2de',
    brightBlack:  '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1', brightYellow: '#f9e2af',
    brightBlue:   '#89b4fa', brightMagenta: '#f5c2e7', brightCyan: '#94e2d5', brightWhite: '#a6adc8',
  },
  'Tokyo Night': {
    foreground:   '#c0caf5',
    cursor:       '#c0caf5',
    selectionBackground: '#28344a',
    black:        '#15161e', red:     '#f7768e', green:   '#9ece6a', yellow:  '#e0af68',
    blue:         '#7aa2f7', magenta: '#bb9af7', cyan:    '#7dcfff', white:   '#a9b1d6',
    brightBlack:  '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a', brightYellow: '#e0af68',
    brightBlue:   '#7aa2f7', brightMagenta: '#bb9af7', brightCyan: '#7dcfff', brightWhite: '#c0caf5',
  },
  'Dracula': {
    foreground:   '#f8f8f2',
    cursor:       '#f8f8f2',
    selectionBackground: '#44475a',
    black:        '#21222c', red:     '#ff5555', green:   '#50fa7b', yellow:  '#f1fa8c',
    blue:         '#bd93f9', magenta: '#ff79c6', cyan:    '#8be9fd', white:   '#f8f8f2',
    brightBlack:  '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5',
    brightBlue:   '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff',
  },
  'Gruvbox Dark': {
    foreground:   '#ebdbb2',
    cursor:       '#ebdbb2',
    selectionBackground: '#504945',
    black:        '#282828', red:     '#cc241d', green:   '#98971a', yellow:  '#d79921',
    blue:         '#458588', magenta: '#b16286', cyan:    '#689d6a', white:   '#a89984',
    brightBlack:  '#928374', brightRed: '#fb4934', brightGreen: '#b8bb26', brightYellow: '#fabd2f',
    brightBlue:   '#83a598', brightMagenta: '#d3869b', brightCyan: '#8ec07c', brightWhite: '#ebdbb2',
  },
  'Solarized Dark': {
    foreground:   '#839496',
    cursor:       '#839496',
    selectionBackground: '#073642',
    black:        '#073642', red:     '#dc322f', green:   '#859900', yellow:  '#b58900',
    blue:         '#268bd2', magenta: '#d33682', cyan:    '#2aa198', white:   '#eee8d5',
    brightBlack:  '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83',
    brightBlue:   '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
  },
  'Nord': {
    foreground:   '#d8dee9',
    cursor:       '#d8dee9',
    selectionBackground: '#434c5e',
    black:        '#3b4252', red:     '#bf616a', green:   '#a3be8c', yellow:  '#ebcb8b',
    blue:         '#81a1c1', magenta: '#b48ead', cyan:    '#88c0d0', white:   '#e5e9f0',
    brightBlack:  '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c', brightYellow: '#ebcb8b',
    brightBlue:   '#81a1c1', brightMagenta: '#b48ead', brightCyan: '#8fbcbb', brightWhite: '#eceff4',
  },
  'One Dark': {
    foreground:   '#abb2bf',
    cursor:       '#528bff',
    selectionBackground: '#3e4451',
    black:        '#282c34', red:     '#e06c75', green:   '#98c379', yellow:  '#e5c07b',
    blue:         '#61afef', magenta: '#c678dd', cyan:    '#56b6c2', white:   '#abb2bf',
    brightBlack:  '#5c6370', brightRed: '#e06c75', brightGreen: '#98c379', brightYellow: '#e5c07b',
    brightBlue:   '#61afef', brightMagenta: '#c678dd', brightCyan: '#56b6c2', brightWhite: '#ffffff',
  },
  'Light (Paper)': {
    foreground:   '#1c1c1c',
    cursor:       '#1c1c1c',
    selectionBackground: '#c8d3e8',
    black:        '#000000', red:     '#c0392b', green:   '#27ae60', yellow:  '#f39c12',
    blue:         '#2980b9', magenta: '#8e44ad', cyan:    '#16a085', white:   '#bdc3c7',
    brightBlack:  '#7f8c8d', brightRed: '#e74c3c', brightGreen: '#2ecc71', brightYellow: '#f1c40f',
    brightBlue:   '#3498db', brightMagenta: '#9b59b6', brightCyan: '#1abc9c', brightWhite: '#ecf0f1',
  },
  'MC Friendly': {
    foreground:   '#c0c0c0',
    cursor:       '#ffffff',
    selectionBackground: '#0000aa',
    black:        '#000000', red:     '#aa0000', green:   '#00aa00', yellow:  '#aaaa00',
    blue:         '#0000aa', magenta: '#aa00aa', cyan:    '#00aaaa', white:   '#aaaaaa',
    brightBlack:  '#555555', brightRed: '#ff5555', brightGreen: '#55ff55', brightYellow: '#ffff55',
    brightBlue:   '#5555ff', brightMagenta: '#ff55ff', brightCyan: '#55ffff', brightWhite: '#ffffff',
  },
}

export const PRESET_BACKGROUNDS = [
  { label: 'Почти чёрный',   value: '#0d0f14' },
  { label: 'Тёмно-серый',    value: '#1e1e2e' },
  { label: 'Угольный',       value: '#282828' },
  { label: 'Ночной синий',   value: '#1a1b26' },
  { label: 'Тёмный Nord',    value: '#2e3440' },
  { label: 'Белый',          value: '#fafafa' },
  { label: 'Paper',          value: '#f5f0e8' },
]

export const FONT_OPTIONS = [
  'JetBrains Mono',
  'Fira Code',
  'Cascadia Code',
  'Source Code Pro',
  'Inconsolata',
  'Hack',
  'Menlo',
  'Consolas',
  'monospace',
]

export const DEFAULT_SETTINGS = {
  // Цвета
  themeName:       'Catppuccin Mocha',
  background:      '#1e1e2e',
  opacity:         1.0,          // прозрачность цветового фона, 0.2–1.0

  // Фоновая картинка
  bgImage:         '',           // абсолютный путь к файлу (или '')
  bgImageOpacity:  0.15,         // 0.05–1.0

  // Шрифт
  fontSize:        13,           // 10–20
  fontFamily:      'JetBrains Mono',
  lineHeight:      1.4,          // 1.0–2.0

  // Курсор
  cursorStyle:     'bar',        // bar | block | underline
  cursorBlink:     true,

  // Прочее
  scrollback:      10000,

  // Масштаб UI (применяется к #root через CSS zoom)
  uiScale:         1.0,          // 0.7–1.5

  // Внешний терминал
  externalTerminal: 'konsole -e',  // команда запуска

  // Тема интерфейса
  uiTheme:         'Light',       // Light | Dark | macOS | Dark Blue | Rosé Pine | System

  // Таймауты подключения
  connectionTimeout: 15,         // секунды ожидания SSH коннекта до показа кнопки реконнекта

  // Сплит терминала
  splitBorderSize:     2,        // толщина разделителя между панелями (px), 1–8
  showReconnectButton: false,    // показывать кнопку "Подключиться заново" при обрыве
  miniSftp:        false,        // включить мини-SFTP панель
  historyLimit:    5,            // сколько последних хостов показывать на главном экране

  // Встроенный браузер
  browserZoom:     1.0,          // 0.5–2.0
  browserNewTab:   true,         // true = новая вкладка, false = переиспользовать текущую
  browserHomePage: '',           // пустой = URL из туннеля
}

// Собирает объект theme для xterm
export function buildXtermTheme(settings) {
  const palette = TERM_THEMES[settings.themeName] || TERM_THEMES['Catppuccin Mocha']
  const bg = hexToRgba(settings.background, settings.opacity)
  return { ...palette, background: bg }
}

// hex → rgba с учётом alpha (если 1 — возвращаем hex, xterm стабильнее)
function hexToRgba(hex, alpha) {
  if (alpha >= 1) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}

// ─── UI Темы ──────────────────────────────────────────────────────────────────

export const UI_THEMES = {
  'Light': {
    '--bg0': '#f5f6f8',
    '--bg1': '#ffffff',
    '--bg2': '#f0f1f4',
    '--bg3': '#e4e6ec',
    '--bg4': '#d8dae3',
    '--accent':  '#2563eb',
    '--accent2': '#7c3aed',
    '--green':   '#16a34a',
    '--amber':   '#d97706',
    '--red':     '#dc2626',
    '--text0': '#111827',
    '--text1': '#374151',
    '--text2': '#6b7280',
    '--text3': '#9ca3af',
    '--border':  'rgba(0,0,0,0.07)',
    '--border2': 'rgba(0,0,0,0.12)',
  },
  'Dark': {
    '--bg0': '#0d0f14',
    '--bg1': '#13161e',
    '--bg2': '#1a1d27',
    '--bg3': '#22263a',
    '--bg4': '#2d3148',
    '--accent':  '#4f9eff',
    '--accent2': '#7c6af7',
    '--green':   '#3dd68c',
    '--amber':   '#f0a844',
    '--red':     '#ff5f5f',
    '--text0': '#e8eaf0',
    '--text1': '#9ba3c0',
    '--text2': '#5a6180',
    '--text3': '#3a4060',
    '--border':  'rgba(255,255,255,0.06)',
    '--border2': 'rgba(255,255,255,0.11)',
  },
  'macOS': {
    '--bg0': '#ececec',
    '--bg1': '#f8f8f8',
    '--bg2': '#e8e8e8',
    '--bg3': '#dcdcdc',
    '--bg4': '#cfcfcf',
    '--accent':  '#007aff',
    '--accent2': '#5856d6',
    '--green':   '#34c759',
    '--amber':   '#ff9500',
    '--red':     '#ff3b30',
    '--text0': '#1c1c1e',
    '--text1': '#3a3a3c',
    '--text2': '#8e8e93',
    '--text3': '#aeaeb2',
    '--border':  'rgba(0,0,0,0.08)',
    '--border2': 'rgba(0,0,0,0.14)',
  },
  'Dark Blue': {
    '--bg0': '#0a0e1a',
    '--bg1': '#0f1525',
    '--bg2': '#151c30',
    '--bg3': '#1c2540',
    '--bg4': '#243050',
    '--accent':  '#58a6ff',
    '--accent2': '#bc8cff',
    '--green':   '#3fb950',
    '--amber':   '#d29922',
    '--red':     '#f85149',
    '--text0': '#c9d1d9',
    '--text1': '#8b949e',
    '--text2': '#484f58',
    '--text3': '#30363d',
    '--border':  'rgba(255,255,255,0.05)',
    '--border2': 'rgba(255,255,255,0.09)',
  },
  'Rosé Pine': {
    '--bg0': '#191724',
    '--bg1': '#1f1d2e',
    '--bg2': '#26233a',
    '--bg3': '#2e2a42',
    '--bg4': '#393552',
    '--accent':  '#c4a7e7',
    '--accent2': '#ebbcba',
    '--green':   '#9ccfd8',
    '--amber':   '#f6c177',
    '--red':     '#eb6f92',
    '--text0': '#e0def4',
    '--text1': '#908caa',
    '--text2': '#6e6a86',
    '--text3': '#524f67',
    '--border':  'rgba(255,255,255,0.05)',
    '--border2': 'rgba(255,255,255,0.09)',
  },
}

// Определить тему автоматически по системным настройкам
export function detectSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light'
}

// Применить тему к документу
export function applyUITheme(themeName) {
  const theme = themeName === 'System' ? UI_THEMES[detectSystemTheme()] : UI_THEMES[themeName]
  if (!theme) return
  const root = document.documentElement
  Object.entries(theme).forEach(([k, v]) => root.style.setProperty(k, v))
}
