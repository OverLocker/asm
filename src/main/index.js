const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron')
const path = require('path')
const os = require('os')
const fs = require('fs')
const pty = require('node-pty')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ─── Window ────────────────────────────────────────────────────────────────

let mainWindow
let savedZoom = 1.0  // сохранённый zoom для восстановления после webview

// ─── Сохранение размера/позиции окна ─────────────────────────────────────────

const windowStateFile = path.join(app.getPath('userData'), 'window-state.json')

function loadWindowState() {
  try { return JSON.parse(fs.readFileSync(windowStateFile, 'utf8')) } catch { return null }
}

function saveWindowState(win) {
  if (win.isMaximized() || win.isMinimized()) return
  const b = win.getBounds()
  fs.writeFileSync(windowStateFile, JSON.stringify(b))
}

function createWindow() {
  const saved = loadWindowState()
  const opts = {
    width:    saved?.width  || 1280,
    height:   saved?.height || 800,
    x:        saved?.x,
    y:        saved?.y,
    minWidth:  900,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#f5f6f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,   // нужен для встроенного браузера
    },
  }
  // Убираем undefined чтобы Electron не ругался
  if (opts.x == null) { delete opts.x; delete opts.y }

  mainWindow = new BrowserWindow(opts)

  // Сохраняем при закрытии и при ресайзе (debounce через таймер)
  let saveTimer = null
  const scheduleSave = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveWindowState(mainWindow), 500)
  }
  mainWindow.on('resize', scheduleSave)
  mainWindow.on('move',   scheduleSave)
  mainWindow.on('close',  () => { clearTimeout(saveTimer); saveWindowState(mainWindow) })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

// ─── Меню ─────────────────────────────────────────────────────────────────────

let appSettings = {}  // Глобальные настройки приложения, включая X11-Forwarding

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Quit',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        {
          label: 'Краткий вывод',
          type: 'checkbox',
          checked: appSettings.compactMode || false,
          accelerator: 'CmdOrCtrl+Shift+C',
          click: (menuItem) => {
            appSettings.compactMode = menuItem.checked
            fs.writeFileSync(settingsFile, JSON.stringify(appSettings, null, 2))
            if (mainWindow) mainWindow.webContents.send('compact:toggled', appSettings.compactMode)
          },
        },
        { type: 'separator' },
        {
          label: 'Полный экран',
          type: 'checkbox',
          checked: false,
          accelerator: 'F11',
          click: (menuItem) => {
            if (mainWindow) {
              mainWindow.setFullScreen(menuItem.checked)
              mainWindow.webContents.send('fullscreen:toggled', menuItem.checked)
            }
          },
        },
      ],
    },
  ]
  if (isDev) {
    template.push({
      label: 'Dev',
      submenu: [
        { role: 'toggleDevTools', label: 'Toggle DevTools' },
        { role: 'reload' },
      ],
    })
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  // Загружаем глобальные настройки приложения
  const settingsFile = path.join(app.getPath('userData'), 'settings.json')
  try {
    appSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'))
  } catch {
    appSettings = { x11Forwarding: false }
  }
  
  buildMenu()
  createWindow()
})
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())

// ─── Чистка процессов при выходе ─────────────────────────────────────────────
// Убиваем все PTY, SFTP-соединения и туннели чтобы не оставлять зомби-процессы

app.on('before-quit', () => {
  // PTY сессии
  for (const [id, term] of ptySessions) {
    try { term.kill() } catch {}
  }
  ptySessions.clear()

  // SFTP соединения
  for (const [id, c] of sftpClients) {
    try { c.conn.end() } catch {}
  }
  sftpClients.clear()

  // Туннели
  for (const [id, t] of tunnels) {
    try { t.server?.close() } catch {}
    try { t.conn.end() } catch {}
  }
  tunnels.clear()
})
app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())

// ─── SSH Config Parser ──────────────────────────────────────────────────────

function parseSSHConfig(filePath) {
  const resolved = filePath.replace('~', os.homedir())
  if (!fs.existsSync(resolved)) return []

  const content = fs.readFileSync(resolved, 'utf8')
  const hosts = []
  let current = null

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const m = line.match(/^(\w+)\s+(.+)$/)
    if (!m) continue
    const [, key, value] = m

    if (key.toLowerCase() === 'include') {
      const glob = require('path')
      const includePath = value.trim().replace('~', os.homedir())
      try {
        const { globSync } = require('glob')
        const files = globSync(includePath)
        for (const f of files) {
          hosts.push(...parseSSHConfig(f))
        }
      } catch {
        if (fs.existsSync(includePath)) {
          hosts.push(...parseSSHConfig(includePath))
        }
      }
      continue
    }

    if (key.toLowerCase() === 'host') {
      if (current && current.host !== '*') hosts.push(current)
      const tokens = value.trim().split(/\s+/).filter(t => t !== '*')
      if (tokens.length === 0) { current = null; continue }
      const primaryHost = tokens[0]
      current = {
        host:         primaryHost,
        hostname:     primaryHost,
        aliases:      tokens.slice(1),
        user:         '',
        port:         22,
        identityFile: '',
        proxyJump:    '',
        tags:         [],
        _sourceFile:  resolved,  // ← из какого файла считан хост
      }
      continue
    }

    if (!current) continue

    switch (key.toLowerCase()) {
      case 'hostname':     current.hostname = value.trim(); break
      case 'user':         current.user = value.trim(); break
      case 'port':         current.port = parseInt(value) || 22; break
      case 'identityfile':
        // Сохраняем ИСХОДНУЮ строку (с ~ если было), расширяем только для проверки существования
        current.identityFile = value.trim()
        break
      case 'proxyjump':    current.proxyJump = value.trim(); break
    }
  }

  if (current && current.host !== '*') hosts.push(current)
  return hosts
}

ipcMain.handle('ssh:list-hosts', async () => {
  const configPath = path.join(os.homedir(), '.ssh', 'config')
  try {
    return parseSSHConfig(configPath)
  } catch (e) {
    return []
  }
})

ipcMain.handle('ssh:get-x11-forwarding', () => {
  return appSettings.x11Forwarding || false
})

ipcMain.handle('ssh:set-x11-forwarding', (event, value) => {
  appSettings.x11Forwarding = !!value
  fs.writeFileSync(settingsFile, JSON.stringify(appSettings, null, 2))
  return { ok: true }
})

ipcMain.handle('view:get-compact-mode', () => {
  return appSettings.compactMode || false
})

ipcMain.handle('view:set-fullscreen', (event, flag) => {
  if (mainWindow) mainWindow.setFullScreen(flag)
  return { ok: true }
})

// ─── File dialog для выбора SSH-ключа ────────────────────────────────────────
ipcMain.handle('dialog:openFile', async (event, opts = {}) => {
  const { dialog } = require('electron')
  const result = await dialog.showOpenDialog(mainWindow, {
    title:       opts.title || 'Выбрать файл',
    defaultPath: opts.defaultPath || path.join(os.homedir(), '.ssh'),
    properties:  ['openFile'],
    filters:     opts.filters || [{ name: 'SSH Keys', extensions: ['*'] }],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  // Заменяем домашний путь на ~ для краткости
  return result.filePaths[0].replace(os.homedir(), '~')
})

// ─── PTY / Terminal ─────────────────────────────────────────────────────────

const ptySessions = new Map()

ipcMain.handle('pty:spawn', async (event, { id, host, user, port, identityFile, proxyJump, isLocal }) => {
  // Локальный терминал — запускаем shell напрямую
  const shell = process.env.SHELL || '/bin/bash'
  const bin  = isLocal ? '/bin/bash' : 'ssh'
  const args = isLocal ? ['--login', '-i'] : []  // -i для интерактивного режима
  if (!isLocal) {
    if (port && port !== 22) args.push('-p', String(port))
    if (identityFile) args.push('-i', identityFile)
    if (proxyJump) args.push('-J', proxyJump)
    if (appSettings.x11Forwarding) args.push('-Y')
    // Передаём xterm на сервер чтобы F-keys работали везде (mc, vim, nano)
    // xterm без суффикса есть в terminfo на всех серверах
    args.push('-o', 'SetEnv=TERM=xterm-256color')
    if (user) args.push(`${user}@${host}`)
    else args.push(host)
  }

  // Полная ENV с поддержкой цветов для обоих случаев (локальный + SSH)
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    HOME: os.homedir(),
    USER: os.userInfo().username,
    SHELL: process.env.SHELL || '/bin/bash',
    LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
    LANG: process.env.LANG || 'en_US.UTF-8',
    LC_CTYPE: 'en_US.UTF-8',
    GREP_COLORS: 'mt=01;31:ms=01;31:mc=01;31:fn=35:ln=32:bn=32:se=36',
    CLICOLOR: '1',
    CLICOLOR_FORCE: '1',
    MC_SKIN: process.env.MC_SKIN || 'default',
  }

  // Для локального терминала — создаём временный rcfile с alias mc
  // Это позволяет mc всегда запускаться с правильным TERM независимо от настроек
  let spawnBin  = bin
  let spawnArgs = args
  if (isLocal) {
    const rcFile = path.join(os.tmpdir(), 'asm_bash_rc.sh')
    const rcContent = [
      '# SSHM auto-generated rc',
      '[ -f ~/.bashrc ] && source ~/.bashrc',
      '[ -f ~/.bash_profile ] && source ~/.bash_profile 2>/dev/null',
      "# mc alias: запускает с TERM=screen-256color для правильной псевдографики",
      "alias mc='TERM=screen-256color mc'",
      '',
    ].join('\n')
    try { fs.writeFileSync(rcFile, rcContent, 'utf8') } catch {}
    spawnArgs = ['--rcfile', rcFile]
  }

  const term = pty.spawn(spawnBin, spawnArgs, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: os.homedir(),
    env,
  })

  ptySessions.set(id, term)

  term.onData((data) => {
    mainWindow?.webContents.send(`pty:data:${id}`, data)
  })

  term.onExit(({ exitCode }) => {
    ptySessions.delete(id)
    mainWindow?.webContents.send(`pty:exit:${id}`, exitCode)
  })

  return { pid: term.pid }
})

ipcMain.on('pty:write', (event, { id, data }) => {
  ptySessions.get(id)?.write(data)
})

ipcMain.on('pty:resize', (event, { id, cols, rows }) => {
  ptySessions.get(id)?.resize(cols, rows)
})

ipcMain.on('pty:kill', (event, { id }) => {
  ptySessions.get(id)?.kill()
  ptySessions.delete(id)
})

// ─── External terminal ──────────────────────────────────────────────────────

ipcMain.handle('ssh:open-external', async (event, { host, user, port, identityFile, externalTerminal }) => {
  let cmd = `ssh `
  if (port && port !== 22) cmd += `-p ${port} `
  if (identityFile) cmd += `-i ${identityFile} `
  cmd += user ? `${user}@${host}` : host

  const preferred = externalTerminal ? (() => {
    const parts = externalTerminal.trim().split(/\s+/)
    return [parts[0], [...parts.slice(1), 'bash', '-c', `${cmd}; exec bash`]]
  })() : null

  const defaults = [
    ['gnome-terminal', ['--', 'bash', '-c', `${cmd}; exec bash`]],
    ['konsole', ['-e', 'bash', '-c', `${cmd}; exec bash`]],
    ['xterm', ['-e', 'bash', '-c', `${cmd}; exec bash`]],
    ['kitty', ['bash', '-c', `${cmd}; exec bash`]],
    ['alacritty', ['-e', 'bash', '-c', `${cmd}; exec bash`]],
    ['wezterm', ['start', 'bash', '-c', `${cmd}; exec bash`]],
    ['tilix', ['-e', 'bash', '-c', `${cmd}; exec bash`]],
  ]
  const terminals = preferred ? [preferred, ...defaults] : defaults

  const { spawn, execFileSync } = require('child_process')

  for (const [term, args] of terminals) {
    // Проверяем что терминал существует в PATH
    try { execFileSync('which', [term], { stdio: 'ignore' }) } catch { continue }

    try {
      const child = spawn(term, args, {
        detached: true,
        stdio: 'ignore',
        cwd: os.homedir(),
        env: { ...process.env },
      })
      child.unref()
      return { ok: true, terminal: term }
    } catch {}
  }
  return { ok: false, error: 'No terminal found' }
})

// ─── SFTP ───────────────────────────────────────────────────────────────────

const { Client } = require('ssh2')
const sftpClients = new Map()

ipcMain.handle('sftp:connect', async (event, { id, host, user, port, identityFile }) => {
  return new Promise((resolve) => {
    // Таймаут 15 секунд на установку туннеля
    const timer = setTimeout(() => resolve({ ok: false, error: 'Таймаут подключения' }), 15000)
    const done  = (result) => { clearTimeout(timer); resolve(result) }

    const conn = new Client()
    const cfg = { host, port: port || 22, username: user || process.env.USER, compress: true }

    if (identityFile && fs.existsSync(identityFile)) {
      cfg.privateKey = fs.readFileSync(identityFile)
    } else {
      // Try default keys
      for (const k of ['id_ed25519', 'id_rsa', 'id_ecdsa']) {
        const p = path.join(os.homedir(), '.ssh', k)
        if (fs.existsSync(p)) { cfg.privateKey = fs.readFileSync(p); break }
      }
    }
    if (!cfg.privateKey) cfg.agent = process.env.SSH_AUTH_SOCK

    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) { conn.end(); return resolve({ ok: false, error: err.message }) }
        sftpClients.set(id, { conn, sftp })
        resolve({ ok: true })
      })
    })
    conn.on('error', (e) => resolve({ ok: false, error: e.message }))
    conn.connect(cfg)
  })
})

ipcMain.handle('sftp:readdir', async (event, { id, dir }) => {
  const c = sftpClients.get(id)
  if (!c) return { ok: false, error: 'Not connected' }
  return new Promise((resolve) => {
    c.sftp.readdir(dir, (err, list) => {
      if (err) return resolve({ ok: false, error: err.message })
      const items = list.map((f) => ({
        name: f.filename,
        size: f.attrs.size,
        mtime: f.attrs.mtime * 1000,
        isDir: (f.attrs.mode & 0o170000) === 0o040000,
        mode: f.attrs.mode,
      }))
      resolve({ ok: true, items })
    })
  })
})

// Проверка существования локального файла/папки
ipcMain.handle('sftp:exists-local', (event, { localPath }) => {
  return fs.existsSync(localPath)
})

// Проверка существования файла/папки на сервере
ipcMain.handle('sftp:exists-remote', async (event, { id, remotePath }) => {
  const c = sftpClients.get(id)
  if (!c) return false
  return new Promise((resolve) => {
    c.sftp.stat(remotePath, (err) => resolve(!err))
  })
})

ipcMain.handle('sftp:download', async (event, { id, remotePath, localPath }) => {
  const c = sftpClients.get(id)
  if (!c) return { ok: false }
  return new Promise((resolve) => {
    c.sftp.fastGet(remotePath, localPath, {
      step: (transferred, chunk, total) => {
        event.sender.send('sftp:progress', { remotePath, transferred, total, type: 'download' })
      }
    }, (err) => {
      event.sender.send('sftp:progress', { remotePath, finished: true })
      resolve(err ? { ok: false, error: err.message } : { ok: true })
    })
  })
})

// ─── Открыть файл локально для редактирования + watch + автозалив ──────────
const editWatchers = new Map() // localPath → { watcher, debounce }

ipcMain.handle('sftp:open-edit', async (event, { id, remotePath, fileName }) => {
  try {
    const c = sftpClients.get(id)
    if (!c) return { ok: false, error: 'SFTP не подключён' }

    const ext = path.extname(fileName).toLowerCase()
    // Бинарные и архивные форматы, которые нельзя редактировать как текст
    const binaryExts = ['.zip', '.tar', '.gz', '.rar', '.7z', '.exe', '.dll', '.so', '.bin', '.jpg', '.png', '.pdf', '.mp4', '.mp3']
    const isBinary = binaryExts.includes(ext)

    const tmpDir = path.join(os.tmpdir(), isBinary ? 'asm-download' : 'asm-edit')
    fs.mkdirSync(tmpDir, { recursive: true })
    const localPath = path.join(tmpDir, `${id}_${fileName}`)

    // Скачиваем с прогрессом (если нужно, или просто fastGet для маленьких файлов)
    // Для простоты пока оставим fastGet, но для больших бинарников это будет скачивание
    const dlOk = await new Promise((resolve) => {
      c.sftp.fastGet(remotePath, localPath, (err) => resolve(!err))
    })
    if (!dlOk) return { ok: false, error: 'Не удалось скачать файл' }

    if (isBinary) {
      // Открываем через системную ассоциацию и возвращаем путь, чтобы UI не открывал редактор
      const { exec } = require('child_process')
      const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
      exec(`${opener} "${localPath}"`, { timeout: 5000 }).unref()
      return { ok: true, localPath, isBinary: true }
    }

    // Text files are handled by internal editor only.
    return { ok: true, localPath, isBinary: false }

    if (false) {
      return { ok: false, noAssoc: true, localPath }
    }

    // Вотчим изменения и автозаливаем
    if (editWatchers.has(localPath)) {
      editWatchers.get(localPath).watcher.close()
    }
    let debTimer = null
    const watcher = fs.watch(localPath, () => {
      clearTimeout(debTimer)
      debTimer = setTimeout(async () => {
        const uploadOk = await new Promise((resolve) => {
          c.sftp.fastPut(localPath, remotePath, (err) => resolve(!err))
        })
        mainWindow?.webContents.send('sftp:edit-saved', { localPath, remotePath, ok: uploadOk })
      }, 500)
    })
    editWatchers.set(localPath, { watcher, debTimer: null })
    return { ok: true, localPath, isBinary: false }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('sftp:read-text', async (event, { id, remotePath }) => {
  try {
    const c = sftpClients.get(id)
    if (!c) return { ok: false, error: 'SFTP не подключён' }
    const chunks = []
    return await new Promise((resolve) => {
      const stream = c.sftp.createReadStream(remotePath)
      stream.on('data', (d) => chunks.push(d))
      stream.on('end', () => resolve({ ok: true, content: Buffer.concat(chunks).toString('utf8') }))
      stream.on('error', (e) => resolve({ ok: false, error: e.message }))
    })
  } catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('sftp:write-text', async (event, { id, remotePath, content }) => {
  try {
    const c = sftpClients.get(id)
    if (!c) return { ok: false, error: 'SFTP не подключён' }
    return await new Promise((resolve) => {
      const stream = c.sftp.createWriteStream(remotePath)
      stream.on('close', () => resolve({ ok: true }))
      stream.on('error', (e) => resolve({ ok: false, error: e.message }))
      stream.end(Buffer.from(content, 'utf8'))
    })
  } catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('sftp:open-with', async (event, { localPath, app: appPath }) => {
  const { exec } = require('child_process')
  return new Promise((resolve) => {
    const cmd = appPath ? `"${appPath}" "${localPath}"` : `xdg-open "${localPath}"`
    exec(cmd, (err) => resolve(err ? { ok: false, error: err.message } : { ok: true }))
  })
})

ipcMain.handle('sftp:pick-app', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выбрать приложение',
    properties: ['openFile'],
    filters: [{ name: 'Исполняемые файлы', extensions: ['*'] }],
  })
  return result.canceled ? null : result.filePaths[0]
})

// Drag-out: скачиваем во tmp и отдаём путь для startDrag
ipcMain.handle('sftp:prepare-drag', async (event, { id, remotePath, fileName }) => {
  const c = sftpClients.get(id)
  if (!c) return { ok: false }
  const tmpDir = path.join(os.tmpdir(), 'asm-drag')
  fs.mkdirSync(tmpDir, { recursive: true })
  const localPath = path.join(tmpDir, fileName)
  const ok = await new Promise((resolve) => {
    c.sftp.fastGet(remotePath, localPath, (err) => resolve(!err))
  })
  if (!ok) return { ok: false }
  // startDrag должен вызываться из webContents
  event.sender.startDrag({ file: localPath, icon: path.join(__dirname, '../renderer/drag-icon.png') })
  return { ok: true }
})

ipcMain.handle('sftp:upload', async (event, { id, localPath, remotePath }) => {
  const c = sftpClients.get(id)
  if (!c) return { ok: false }
  return new Promise((resolve) => {
    c.sftp.fastPut(localPath, remotePath, (err) =>
      resolve(err ? { ok: false, error: err.message } : { ok: true })
    )
  })
})

// Рекурсивное скачивание папки
ipcMain.handle('sftp:download-dir', async (event, { id, remoteDir, localDir }) => {
  const c = sftpClients.get(id)
  if (!c) return { ok: false, error: 'SFTP не подключён' }
  const results = []

  const downloadRecursive = async (remotePath, localPath) => {
    fs.mkdirSync(localPath, { recursive: true })
    const list = await new Promise((resolve, reject) => {
      c.sftp.readdir(remotePath, (err, items) => err ? reject(err) : resolve(items))
    })
    for (const f of list) {
      if (f.filename === '.' || f.filename === '..') continue
      const rp = `${remotePath}/${f.filename}`
      const lp = path.join(localPath, f.filename)
      const isDir = (f.attrs.mode & 0o170000) === 0o040000
      if (isDir) {
        await downloadRecursive(rp, lp)
      } else {
        const ok = await new Promise((r) => c.sftp.fastGet(rp, lp, (err) => r(!err)))
        results.push({ path: rp, ok })
      }
    }
  }

  try {
    await downloadRecursive(remoteDir, localDir)
    return { ok: true, results }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('sftp:rename', async (event, { id, oldPath, newPath }) => {
  const c = sftpClients.get(id)
  if (!c) return { ok: false }
  return new Promise((resolve) => {
    c.sftp.rename(oldPath, newPath, (err) => resolve(err ? { ok: false, error: err.message } : { ok: true }))
  })
})

ipcMain.handle('sftp:mkdir', async (event, { id, dir }) => {
  const c = sftpClients.get(id)
  if (!c) return { ok: false }
  return new Promise((resolve) => {
    c.sftp.mkdir(dir, (err) => resolve(err ? { ok: false, error: err.message } : { ok: true }))
  })
})

ipcMain.handle('sftp:delete', async (event, { id, remotePath, isDir }) => {
  const c = sftpClients.get(id)
  if (!c) return { ok: false }
  return new Promise((resolve) => {
    const fn = isDir ? c.sftp.rmdir.bind(c.sftp) : c.sftp.unlink.bind(c.sftp)
    fn(remotePath, (err) => resolve(err ? { ok: false, error: err.message } : { ok: true }))
  })
})

ipcMain.handle('sftp:disconnect', async (event, { id }) => {
  const c = sftpClients.get(id)
  if (c) { c.conn.end(); sftpClients.delete(id) }
  return { ok: true }
})

// ─── Копирование между двумя SFTP сессиями ───────────────────────────────────
// srcId и dstId — id сессий из sftpClients (могут быть разными хостами)
// Если один хост (srcId === dstId) — выполняет cp через SSH exec
// Если разные — piped copy через память (без временных файлов)

ipcMain.handle('sftp:copy-remote', async (event, { srcId, dstId, srcPaths, dstDir, move }) => {
  const src = sftpClients.get(srcId)
  const dst = sftpClients.get(dstId)
  if (!src) return { ok: false, error: `src сессия не найдена: ${srcId}` }
  if (!dst) return { ok: false, error: `dst сессия не найдена: ${dstId}` }

  const send = (name, done, error, transferred, total) => {
    try { event.sender.send('sftp:copy-progress', { name, done, error, transferred: transferred || 0, total: total || 0 }) } catch {}
  }

  // Копирует один файл с прогрессом
  const copyFile = (srcSftp, dstSftp, srcPath, dstPath) => new Promise((resolve, reject) => {
    const fileName = path.basename(srcPath)
    send(fileName, false, null, 0, 0)

    // Получаем размер для прогресс-бара
    srcSftp.stat(srcPath, (statErr, stat) => {
      const totalBytes = (!statErr && stat) ? stat.size : 0
      let transferred = 0

      const rs = srcSftp.createReadStream(srcPath)
      const ws = dstSftp.createWriteStream(dstPath)

      rs.on('data', (chunk) => {
        transferred += chunk.length
        send(fileName, false, null, transferred, totalBytes)
      })
      rs.on('error', (e) => { send(fileName, false, e.message, 0, 0); reject(e) })
      ws.on('error', (e) => { send(fileName, false, e.message, 0, 0); reject(e) })
      ws.on('close', () => { send(fileName, true, null, totalBytes, totalBytes); resolve() })

      rs.pipe(ws)
    })
  })

  // Создаёт папку если не существует
  const mkdirRemote = (sftp, dir) => new Promise((resolve) => {
    sftp.mkdir(dir, (err) => resolve())  // игнорируем ошибку если уже существует
  })

  // stat удалённого файла
  const statRemote = (sftp, p) => new Promise((resolve, reject) => {
    sftp.stat(p, (err, s) => err ? reject(err) : resolve(s))
  })

  // readdir удалённой папки
  const readdirRemote = (sftp, dir) => new Promise((resolve, reject) => {
    sftp.readdir(dir, (err, list) => err ? reject(err) : resolve(list))
  })

  // Рекурсивное копирование srcPath → dstPath
  const copyRecursive = async (srcPath, dstPath) => {
    const s = await statRemote(src.sftp, srcPath)
    const isDir = (s.mode & 0o170000) === 0o040000

    if (isDir) {
      await mkdirRemote(dst.sftp, dstPath)
      const entries = await readdirRemote(src.sftp, srcPath)
      for (const e of entries) {
        if (e.filename === '.' || e.filename === '..') continue
        const sp = srcPath.endsWith('/') ? `${srcPath}${e.filename}` : `${srcPath}/${e.filename}`
        const dp = dstPath.endsWith('/') ? `${dstPath}${e.filename}` : `${dstPath}/${e.filename}`
        await copyRecursive(sp, dp)
      }
    } else {
      await copyFile(src.sftp, dst.sftp, srcPath, dstPath)
    }
  }

  // Удаляет src файл/папку рекурсивно (для move)
  const removeRemote = (sftp, p, isDir) => new Promise((resolve) => {
    if (isDir) {
      sftp.rmdir(p, () => resolve())
    } else {
      sftp.unlink(p, () => resolve())
    }
  })

  const removeRecursive = async (sftp, srcPath) => {
    const s = await statRemote(sftp, srcPath).catch(() => null)
    if (!s) return
    const isDir = (s.mode & 0o170000) === 0o040000
    if (isDir) {
      const entries = await readdirRemote(sftp, srcPath).catch(() => [])
      for (const e of entries) {
        if (e.filename === '.' || e.filename === '..') continue
        const sp = srcPath.endsWith('/') ? `${srcPath}${e.filename}` : `${srcPath}/${e.filename}`
        await removeRecursive(sftp, sp)
      }
    }
    await removeRemote(sftp, srcPath, isDir)
  }

  const errors = []
  for (const srcPath of srcPaths) {
    const name = path.basename(srcPath)
    const dstPath = dstDir.endsWith('/') ? `${dstDir}${name}` : `${dstDir}/${name}`
    try {
      await copyRecursive(srcPath, dstPath)
      if (move) await removeRecursive(src.sftp, srcPath)
    } catch (e) {
      errors.push(`${name}: ${e.message}`)
    }
  }

  return errors.length > 0
    ? { ok: false, error: errors.join('\n') }
    : { ok: true }
})
// Рекурсивная загрузка папки
ipcMain.handle('sftp:upload-dir', async (event, { id, localDir, remoteDir }) => {
  const c = sftpClients.get(id)
  if (!c) return { ok: false, error: 'SFTP не подключён' }
  const results = []

  const uploadRecursive = async (localPath, remotePath) => {
    const stat = fs.statSync(localPath)
    if (stat.isDirectory()) {
      // Создаём папку на сервере (игнорируем ошибку если уже есть)
      await new Promise((r) => c.sftp.mkdir(remotePath, () => r()))
      const entries = fs.readdirSync(localPath)
      for (const entry of entries) {
        await uploadRecursive(
          path.join(localPath, entry),
          `${remotePath}/${entry}`
        )
      }
    } else {
      const ok = await new Promise((r) => {
        c.sftp.fastPut(localPath, remotePath, (err) => r(!err))
      })
      results.push({ path: remotePath, ok })
    }
  }

  try {
    const dirName = path.basename(localDir)
    await uploadRecursive(localDir, `${remoteDir}/${dirName}`)
    return { ok: true, results }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})


// ─── Tunnels ─────────────────────────────────────────────────────────────────


const pendingWrites = new Map()
function scheduleJsonWrite(file, data) {
  clearTimeout(pendingWrites.get(file))
  const t = setTimeout(() => {
    fs.promises.writeFile(file, JSON.stringify(data, null, 2))
      .catch(err => console.error('write failed', file, err))
  }, 250)
  pendingWrites.set(file, t)
}

const tunnels = new Map()

ipcMain.handle('tunnel:start', async (event, { id, host, user, port, identityFile, localPort, remoteHost, remotePort, direction }) => {
  // Проверяем что порт свободен — резолвим ПОСЛЕ закрытия тестового сервера
  const net = require('net')
  const portFree = await new Promise((res) => {
    const tester = net.createServer()
    tester.once('error', () => res(false))
    tester.once('listening', () => tester.close(() => res(true)))
    tester.listen(localPort, '127.0.0.1')
  })
  if (!portFree) return { ok: false, error: `Порт ${localPort} уже занят` }

  return new Promise((resolve) => {
    // Таймаут 15 секунд на установку туннеля
    const timer = setTimeout(() => resolve({ ok: false, error: 'Таймаут подключения' }), 15000)
    const done  = (result) => { clearTimeout(timer); resolve(result) }

    const conn = new Client()
    const cfg = { host, port: port || 22, username: user || process.env.USER, compress: true }

    const keyPath = identityFile || [
      path.join(os.homedir(), '.ssh', 'id_ed25519'),
      path.join(os.homedir(), '.ssh', 'id_rsa'),
    ].find(fs.existsSync)

    if (keyPath) cfg.privateKey = fs.readFileSync(keyPath)
    else cfg.agent = process.env.SSH_AUTH_SOCK

    // Счётчики трафика для этого туннеля
    const stats = { bytesIn: 0, bytesOut: 0, connections: 0 }

    conn.on('ready', () => {
      if (direction === 'socks') {
        // Dynamic SOCKS5 proxy — правильная state machine
        const socks = require('net').createServer((sock) => {
          stats.connections++
          let state = 'greeting'  // greeting → connect → tunnel
          let buf   = Buffer.alloc(0)

          sock.on('data', (chunk) => {
            buf = Buffer.concat([buf, chunk])

            // ── Фаза 1: greeting ─────────────────────────────────────────────
            if (state === 'greeting') {
              if (buf.length < 2) return
              const ver = buf[0], nMethods = buf[1]
              if (ver !== 0x05) { sock.destroy(); return }
              if (buf.length < 2 + nMethods) return
              // Принимаем без аутентификации (0x00)
              sock.write(Buffer.from([0x05, 0x00]))
              buf = buf.slice(2 + nMethods)
              state = 'connect'
              // Если в буфере уже есть данные запроса — обработаем
              if (buf.length > 0) sock.emit('data', Buffer.alloc(0))
              return
            }

            // ── Фаза 2: CONNECT запрос ───────────────────────────────────────
            if (state === 'connect') {
              if (buf.length < 4) return
              const [ver, cmd, , atyp] = buf
              if (ver !== 0x05 || cmd !== 0x01) {
                // Только CONNECT поддерживается
                sock.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0,0,0,0, 0,0]))
                sock.destroy(); return
              }

              let dstHost, dstPort, consumed
              if (atyp === 0x01) {           // IPv4
                if (buf.length < 10) return
                dstHost = `${buf[4]}.${buf[5]}.${buf[6]}.${buf[7]}`
                dstPort = buf.readUInt16BE(8)
                consumed = 10
              } else if (atyp === 0x03) {    // hostname
                if (buf.length < 5) return
                const len = buf[4]
                if (buf.length < 5 + len + 2) return
                dstHost = buf.slice(5, 5 + len).toString('utf8')
                dstPort = buf.readUInt16BE(5 + len)
                consumed = 5 + len + 2
              } else if (atyp === 0x04) {    // IPv6 — поддерживаем
                if (buf.length < 22) return
                const parts = []
                for (let i = 0; i < 8; i++) parts.push(buf.readUInt16BE(4 + i * 2).toString(16))
                dstHost = parts.join(':')
                dstPort = buf.readUInt16BE(20)
                consumed = 22
              } else {
                sock.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0,0,0,0, 0,0]))
                sock.destroy(); return
              }

              state = 'tunnel'
              buf = buf.slice(consumed)

              conn.forwardOut('127.0.0.1', 0, dstHost, dstPort, (err, stream) => {
                if (err) {
                  sock.write(Buffer.from([0x05, 0x05, 0x00, 0x01, 0,0,0,0, 0,0]))
                  sock.destroy(); return
                }
                // Успешный ответ
                sock.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0,0,0,0, 0,0]))
                // Сброс буфера с накопившимися данными
                if (buf.length > 0) stream.write(buf)
                buf = null
                sock.on('data', (d) => { stats.bytesOut += d.length; stream.write(d) })
                stream.on('data', (d) => { stats.bytesIn += d.length; sock.write(d) })
                stream.on('close', () => sock.destroy())
                stream.on('error', () => sock.destroy())
                sock.on('close', () => stream.destroy())
                sock.on('error', () => stream.destroy())
                // Убираем общий data handler
                sock.removeAllListeners('data')
              })
            }
          })

          sock.on('error', () => {})
        })
        socks.listen(localPort, '127.0.0.1', () => {
          tunnels.set(id, { conn, server: socks, stats })
          done({ ok: true, info: `SOCKS5 127.0.0.1:${localPort}`, direction: 'socks', localPort })
        })
        socks.on('error', (e) => done({ ok: false, error: e.message }))

      } else if (direction === 'local') {
        const server = net.createServer((sock) => {
          stats.connections++
          conn.forwardOut('127.0.0.1', sock.remotePort || 0, remoteHost, remotePort, (err, stream) => {
            if (err) { sock.destroy(); return }
            sock.on('data', (d) => { stats.bytesOut += d.length })
            stream.on('data', (d) => { stats.bytesIn += d.length })
            sock.pipe(stream).pipe(sock)
          })
        })
        server.listen(localPort, '127.0.0.1', () => {
          tunnels.set(id, { conn, server, stats })
          done({ ok: true, info: `127.0.0.1:${localPort} → ${remoteHost}:${remotePort}`, direction: 'local', localPort, remoteHost, remotePort })
        })
        server.on('error', (e) => done({ ok: false, error: e.message }))

      } else {
        // Remote forward
        conn.forwardIn('0.0.0.0', localPort, (err) => {
          if (err) return done({ ok: false, error: err.message })
          tunnels.set(id, { conn, stats })
          done({ ok: true, info: `remote:${localPort} → 127.0.0.1:${remotePort}`, direction: 'remote', localPort, remoteHost, remotePort })
        })
      }
    })
    conn.on('error', (e) => resolve({ ok: false, error: e.message }))
    conn.connect(cfg)
  })
})

ipcMain.handle('tunnel:stop', async (event, { id }) => {
  const t = tunnels.get(id)
  if (t) {
    t.server?.close()
    t.conn.end()
    tunnels.delete(id)
  }
  return { ok: true }
})

ipcMain.handle('tunnel:stats', () => {
  const result = {}
  for (const [id, t] of tunnels.entries()) {
    result[id] = t.stats ? { ...t.stats } : { bytesIn: 0, bytesOut: 0, connections: 0 }
  }
  return result
})

ipcMain.handle('tunnel:list', () => {
  return Array.from(tunnels.entries()).map(([id]) => id)
})

// ─── Notes ───────────────────────────────────────────────────────────────────

const notesFile = path.join(app.getPath('userData'), 'notes.json')

ipcMain.handle('notes:load', () => {
  try { return JSON.parse(fs.readFileSync(notesFile, 'utf8')) } catch { return {} }
})

ipcMain.handle('notes:save', (event, notes) => {
  scheduleJsonWrite(notesFile, notes)
  return { ok: true }
})

// ─── Groups ──────────────────────────────────────────────────────────────────

const groupsFile = path.join(app.getPath('userData'), 'groups.json')

ipcMain.handle('groups:load', () => {
  try { return JSON.parse(fs.readFileSync(groupsFile, 'utf8')) } catch { return {} }
})

ipcMain.handle('groups:save', (event, groups) => {
  scheduleJsonWrite(groupsFile, groups)
  return { ok: true }
})

// ─── Settings ─────────────────────────────────────────────────────────────────

const settingsFile = path.join(app.getPath('userData'), 'settings.json')

ipcMain.handle('settings:load', () => {
  try { return JSON.parse(fs.readFileSync(settingsFile, 'utf8')) } catch { return null }
})

ipcMain.handle('settings:save', (event, settings) => {
  scheduleJsonWrite(settingsFile, settings)
  return { ok: true }
})

// ─── Sessions (не-SSH: VNC, RDP, IPMI, Telnet, Mosh и т.д.) ──────────────────
// Хранятся отдельно от SSH config — в sessions.json
// Схема одной сессии:
//   { id, type, name, hostname, port, user, ...typeSpecificFields }
//
// type:  'vnc' | 'rdp' | 'telnet' | 'mosh' | 'ipmi' | 'custom'
// Запуск VNC/RDP:  через внешний клиент (vncviewer, xfreerdp, Remmina)
// Запуск telnet/mosh: через PTY как SSH
// Запуск IPMI:    через BrowserPane (web UI) или ipmi-tool в PTY

const sessionsFile = path.join(app.getPath('userData'), 'sessions.json')

function loadSessions() {
  try { return JSON.parse(fs.readFileSync(sessionsFile, 'utf8')) } catch { return [] }
}
function saveSessions(sessions) {
  scheduleJsonWrite(sessionsFile, sessions)
}

ipcMain.handle('sessions:load', () => loadSessions())

ipcMain.handle('sessions:save', (event, sessions) => {
  saveSessions(sessions)
  return { ok: true }
})

ipcMain.handle('sessions:add', (event, session) => {
  const sessions = loadSessions()
  const id = session.id || `${session.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const entry = { ...session, id }
  sessions.push(entry)
  saveSessions(sessions)
  return { ok: true, session: entry }
})

ipcMain.handle('sessions:update', (event, { id, updates }) => {
  const sessions = loadSessions()
  const idx = sessions.findIndex((s) => s.id === id)
  if (idx === -1) return { ok: false, error: 'Not found' }
  sessions[idx] = { ...sessions[idx], ...updates }
  saveSessions(sessions)
  return { ok: true, session: sessions[idx] }
})

ipcMain.handle('sessions:delete', (event, { id }) => {
  const sessions = loadSessions().filter((s) => s.id !== id)
  saveSessions(sessions)
  return { ok: true }
})

// Запуск VNC/RDP через внешний клиент
ipcMain.handle('sessions:launch-external', async (event, { session }) => {
  const { execFile, exec } = require('child_process')
  const { type, hostname, port, user } = session

  const clients = {
    vnc: [
      ['vncviewer',    [hostname + (port ? `:${port}` : ':5900')]],
      ['tigervnc-viewer', [hostname + (port ? `:${port}` : ':5900')]],
      ['xtigervnc',    [hostname + (port ? `:${port}` : ':5900')]],
      ['Remmina',      [`vnc://${user ? user + '@' : ''}${hostname}${port ? ':' + port : ''}`]],
    ],
    rdp: [
      ['xfreerdp',     [`/v:${hostname}${port ? ':' + port : ''}`, user ? `/u:${user}` : '/u:', '/dynamic-resolution', '+clipboard']],
      ['rdesktop',     ['-u', user || '', hostname + (port ? `:${port}` : '')]],
      ['Remmina',      [`rdp://${user ? user + '@' : ''}${hostname}${port ? ':' + port : ''}`]],
    ],
    ipmi: [
      ['ipmitool',     ['-H', hostname, '-I', 'lanplus', 'mc', 'info']],
    ],
  }

  const candidates = clients[type] || []
  for (const [bin, args] of candidates) {
    try {
      execFile(bin, args, { detached: true, stdio: 'ignore' })
      return { ok: true, client: bin }
    } catch {}
  }

  // Если ни один клиент не найден — открыть в браузере для IPMI/web
  if (type === 'ipmi') {
    const url = `https://${hostname}`
    return { ok: true, browserUrl: url }
  }

  return { ok: false, error: `Клиент для ${type} не найден. Установите vncviewer/xfreerdp/Remmina.` }
})

// ─── Export / Import хостов и групп ───────────────────────────────────────────

ipcMain.handle('asm:export', async (event, { hostNames, includeGroups, includeNotes, includeColors }) => {
  try {
    // Собираем SSH хосты из конфига
    const allHosts = parseSSHConfig(path.join(os.homedir(), '.ssh', 'config'))
    const selectedHosts = hostNames
      ? allHosts.filter((h) => hostNames.includes(h.host))
      : allHosts

    // Дополнительные данные
    let groups = null, notes = null, hostSettings = null
    if (includeGroups) {
      try { groups = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'groups.json'), 'utf8')) } catch {}
    }
    if (includeNotes) {
      try { notes = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'notes.json'), 'utf8')) } catch {}
    }
    if (includeColors) {
      try { hostSettings = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'host-settings.json'), 'utf8')) } catch {}
    }

    // Не-SSH сессии тоже
    const sessions = loadSessions().filter((s) =>
      !hostNames || hostNames.includes(s.name)
    )

    const exportData = {
      version: 1,
      app: 'ASM',
      exportedAt: new Date().toISOString(),
      hosts: selectedHosts.map((h) => ({
        type: 'ssh',
        name: h.host,
        hostname: h.hostname,
        user: h.user,
        port: h.port !== 22 ? h.port : undefined,
        identityFile: h.identityFile || undefined,
        proxyJump: h.proxyJump || undefined,
      })),
      sessions,
      groups:      groups      || undefined,
      notes:       notes       || undefined,
      hostSettings: hostSettings || undefined,
    }

    const { dialog } = require('electron')
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Экспорт хостов ASM',
      defaultPath: `asm-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'ASM Export', extensions: ['json'] }],
    })
    if (result.canceled) return { ok: false, canceled: true }
    fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf8')
    return { ok: true, filePath: result.filePath, count: exportData.hosts.length + sessions.length }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('asm:import', async (event) => {
  try {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Импорт хостов ASM',
      filters: [{ name: 'ASM Export', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true }

    const raw = fs.readFileSync(result.filePaths[0], 'utf8')
    const data = JSON.parse(raw)

    if (!data.app || !data.hosts) return { ok: false, error: 'Неверный формат файла' }

    // Возвращаем данные для предпросмотра — пользователь сам решает что импортировать
    return {
      ok: true,
      data: {
        hosts:    data.hosts    || [],
        sessions: data.sessions || [],
        groups:   data.groups,
        notes:    data.notes,
        hostSettings: data.hostSettings,
        exportedAt: data.exportedAt,
        app: data.app,
      },
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// Применить импорт (после подтверждения пользователем)
ipcMain.handle('asm:apply-import', async (event, { data, options }) => {
  try {
    const { hosts = [], sessions: importSessions = [], groups, notes, hostSettings } = data
    const { appendToConfig = true, targetFile, overwriteGroups = false } = options

    // Добавляем SSH хосты
    if (hosts.length > 0 && targetFile) {
      const resolved = targetFile.replace('~', os.homedir())
      for (const h of hosts) {
        const sp = '    '
        let block = '\nHost ' + h.name + '\n'
        block += sp + 'HostName ' + h.hostname + '\n'
        if (h.user) block += sp + 'User ' + h.user + '\n'
        if (h.port) block += sp + 'Port ' + h.port + '\n'
        if (h.identityFile) block += sp + 'IdentityFile ' + h.identityFile + '\n'
        if (h.proxyJump)    block += sp + 'ProxyJump ' + h.proxyJump + '\n'
        fs.appendFileSync(resolved, block, 'utf8')
      }
    }

    // Добавляем не-SSH сессии
    if (importSessions.length > 0) {
      const existing = loadSessions()
      const newSessions = importSessions.filter((s) => !existing.find((e) => e.id === s.id))
      saveSessions([...existing, ...newSessions])
    }

    // Группы
    if (groups) {
      const gFile = path.join(app.getPath('userData'), 'groups.json')
      if (overwriteGroups) {
        fs.writeFileSync(gFile, JSON.stringify(groups, null, 2))
      } else {
        try {
          const existing = JSON.parse(fs.readFileSync(gFile, 'utf8'))
          // Merge — добавляем только новые корневые группы
          const merged = [...existing, ...groups.filter((g) => !existing.find((e) => e.id === g.id))]
          fs.writeFileSync(gFile, JSON.stringify(merged, null, 2))
        } catch { fs.writeFileSync(gFile, JSON.stringify(groups, null, 2)) }
      }
    }

    // Заметки (merge)
    if (notes) {
      const nFile = path.join(app.getPath('userData'), 'notes.json')
      try {
        const existing = JSON.parse(fs.readFileSync(nFile, 'utf8'))
        fs.writeFileSync(nFile, JSON.stringify({ ...existing, ...notes }, null, 2))
      } catch { fs.writeFileSync(nFile, JSON.stringify(notes, null, 2)) }
    }

    // Цвета хостов (merge)
    if (hostSettings) {
      const hsFile = path.join(app.getPath('userData'), 'host-settings.json')
      try {
        const existing = JSON.parse(fs.readFileSync(hsFile, 'utf8'))
        fs.writeFileSync(hsFile, JSON.stringify({ ...existing, ...hostSettings }, null, 2))
      } catch { fs.writeFileSync(hsFile, JSON.stringify(hostSettings, null, 2)) }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ─── Dialog ───────────────────────────────────────────────────────────────────

const { dialog } = require('electron')

ipcMain.handle('dialog:pick-upload', async (event, { mode }) => {
  // mode: 'files' | 'folder'
  const props = mode === 'folder'
    ? ['openDirectory']
    : ['openFile', 'multiSelections']
  const result = await dialog.showOpenDialog(mainWindow, {
    title: mode === 'folder' ? 'Выбрать папку для загрузки' : 'Выбрать файлы для загрузки',
    properties: props,
  })
  return result.canceled ? null : result.filePaths
})


// TCP ping — проверка доступности хоста через connect на порт SSH
ipcMain.handle('host:ping', async (event, { hostname, port = 22 }) => {
  const net = require('net')
  const start = Date.now()
  return new Promise((resolve) => {
    const sock = new net.Socket()
    const timeout = 3000
    sock.setTimeout(timeout)
    sock.on('connect', () => {
      const ms = Date.now() - start
      sock.destroy()
      resolve({ ok: true, ms })
    })
    sock.on('timeout', () => { sock.destroy(); resolve({ ok: false, ms: timeout }) })
    sock.on('error', () => resolve({ ok: false, ms: -1 }))
    sock.connect(port, hostname)
  })
})

ipcMain.handle('dialog:save-path', async (event, { defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Сохранить файл',
    defaultPath: path.join(os.homedir(), defaultName),
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  })
  return result.canceled ? null : result.filePath
})

ipcMain.handle('dialog:open-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Выбрать фоновое изображение',
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] },
    ],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  // Конвертируем в data URL чтобы renderer мог использовать без file:// проблем
  const filePath = result.filePaths[0]
  const ext  = path.extname(filePath).slice(1).toLowerCase()
  const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
  const data = fs.readFileSync(filePath).toString('base64')
  return { path: filePath, dataUrl: `data:${mime};base64,${data}` }
})
// ─── Session History ──────────────────────────────────────────────────────────

const historyFile = path.join(app.getPath('userData'), 'history.json')

ipcMain.handle('history:load', () => {
  try { return JSON.parse(fs.readFileSync(historyFile, 'utf8')) } catch { return [] }
})

ipcMain.handle('history:save', (event, history) => {
  scheduleJsonWrite(historyFile, history)
  return { ok: true }
})
// ─── Tunnel Rules ─────────────────────────────────────────────────────────────

const tunnelRulesFile = path.join(app.getPath('userData'), 'tunnel-rules.json')

ipcMain.handle('tunnelRules:load', () => {
  try { return JSON.parse(fs.readFileSync(tunnelRulesFile, 'utf8')) } catch { return [] }
})

ipcMain.handle('tunnelRules:save', (event, rules) => {
  scheduleJsonWrite(tunnelRulesFile, rules)
  return { ok: true }
})

// ─── Host Settings (проброс и др. per-host настройки) ────────────────────────

const hostSettingsFile = path.join(app.getPath('userData'), 'host-settings.json')

ipcMain.handle('hostSettings:load', () => {
  try { return JSON.parse(fs.readFileSync(hostSettingsFile, 'utf8')) } catch { return {} }
})

ipcMain.handle('hostSettings:save', (event, settings) => {
  fs.writeFileSync(hostSettingsFile, JSON.stringify(settings, null, 2))
  return { ok: true }
})

// ─── Favorites ────────────────────────────────────────────────────────────────

const favoritesFile = path.join(app.getPath('userData'), 'favorites.json')

ipcMain.handle('favorites:load', () => {
  try { return JSON.parse(fs.readFileSync(favoritesFile, 'utf8')) } catch { return [] }
})

ipcMain.handle('favorites:save', (event, favorites) => {
  fs.writeFileSync(favoritesFile, JSON.stringify(favorites, null, 2))
  return { ok: true }
})
// ─── Перехват popup-окон от webview ──────────────────────────────────────────
// Когда webview пытается открыть новое окно — убиваем его и шлём URL в renderer

app.on('web-contents-created', (event, contents) => {
  if (contents.getType() === 'webview') {
    // Перехват popup
    contents.setWindowOpenHandler(({ url }) => {
      mainWindow?.webContents.send('browser:popup', url)
      return { action: 'deny' }
    })

    // Webview при инициализации может сбросить zoom главного окна
    // Восстанавливаем сохранённый zoom
    contents.on('did-finish-load', () => {
      if (mainWindow && savedZoom !== null) {
        mainWindow.webContents.setZoomFactor(savedZoom)
      }
    })
  }
})
// ─── Локальный терминал ───────────────────────────────────────────────────────

ipcMain.handle('terminal:open-local', async (event, { command }) => {
  const { exec } = require('child_process')
  const cmd = (command || 'konsole') + ' &'
  exec(cmd, { cwd: os.homedir(), env: { ...process.env } })
  return { ok: true }
})
// ─── UI Zoom ──────────────────────────────────────────────────────────────────

ipcMain.handle('ui:set-zoom', (event, factor) => {
  savedZoom = factor
  mainWindow?.webContents.setZoomFactor(factor)
  return { ok: true }
})

ipcMain.handle('ui:get-zoom', () => {
  return mainWindow?.webContents.getZoomFactor() || 1.0
})
// ─── Управление SSH Config ────────────────────────────────────────────────────

// Получить список Include-файлов из основного конфига
ipcMain.handle('ssh:list-config-files', async () => {
  const mainConfig = path.join(os.homedir(), '.ssh', 'config')
  const files = [{ path: mainConfig, label: '~/.ssh/config (основной)' }]

  try {
    const content = fs.readFileSync(mainConfig, 'utf8')
    for (const line of content.split('\n')) {
      const m = line.trim().match(/^[Ii]nclude\s+(.+)$/)
      if (!m) continue
      const includePath = m[1].trim().replace('~', os.homedir())
      try {
        const { globSync } = require('glob')
        const resolved = globSync(includePath)
        for (const f of resolved) {
          files.push({ path: f, label: f.replace(os.homedir(), '~') })
        }
      } catch {
        if (fs.existsSync(includePath)) {
          files.push({ path: includePath, label: includePath.replace(os.homedir(), '~') })
        }
      }
    }
  } catch {}

  return files
})

// Записать новый хост в указанный файл конфига
ipcMain.handle('ssh:add-host', async (event, { filePath, host }) => {
  try {
    const resolved = filePath.replace('~', os.homedir())
    const nl = '\n'
    const sp = '    '
    let block = nl + 'Host ' + host.name + nl
    block += sp + 'HostName ' + host.hostname + nl
    if (host.user)         block += sp + 'User ' + host.user + nl
    if (host.port && host.port !== 22) block += sp + 'Port ' + host.port + nl
    if (host.identityFile) block += sp + 'IdentityFile ' + host.identityFile + nl
    if (host.proxyJump)    block += sp + 'ProxyJump ' + host.proxyJump + nl
    block += nl
    fs.appendFileSync(resolved, block, 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('ssh:delete-host', async (event, { filePath, hostName }) => {
  try {
    const resolved = filePath.replace('~', os.homedir())
    const content = fs.readFileSync(resolved, 'utf8')
    const lines = content.split('\n')
    let inHostBlock = false
    const newLines = []

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (/^Host\s/i.test(trimmed)) {
        const tokens = trimmed.slice(5).trim().split(/\s+/)
        if (tokens.includes(hostName)) {
          inHostBlock = true
          continue
        } else {
          inHostBlock = false
        }
      }
      if (!inHostBlock) newLines.push(lines[i])
    }

    // Убрать лишние пустые строки в конце
    while (newLines.length > 0 && newLines[newLines.length - 1].trim() === '') {
      newLines.pop()
    }
    newLines.push('')  // финальный перевод строки

    fs.writeFileSync(resolved, newLines.join('\n'), 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('ssh:update-host', async (event, { filePath, oldName, host }) => {
  try {
    const resolved = filePath.replace('~', os.homedir())
    const content = fs.readFileSync(resolved, 'utf8')

    const lines = content.split('\n')
    let inHostBlock = false
    let newLines = []

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()

      // Точная проверка: "Host name1 name2 ..."  →  splitToken должен совпадать точно
      if (/^Host\s/i.test(trimmed)) {
        const tokens = trimmed.slice(5).trim().split(/\s+/)
        if (tokens.includes(oldName)) {
          inHostBlock = true
          continue  // пропускаем строку Host oldName
        } else {
          inHostBlock = false  // начало другого блока — закончили удалять
        }
      }

      if (!inHostBlock) newLines.push(lines[i])
    }

    // Убираем лишние пустые строки в конце
    while (newLines.length > 0 && newLines[newLines.length - 1].trim() === '') {
      newLines.pop()
    }

    const sp = '    '
    let block = '\n' + 'Host ' + host.name + '\n'
    block += sp + 'HostName ' + host.hostname + '\n'
    if (host.user)         block += sp + 'User ' + host.user + '\n'
    if (host.port && host.port !== 22) block += sp + 'Port ' + host.port + '\n'
    if (host.identityFile) block += sp + 'IdentityFile ' + host.identityFile + '\n'
    if (host.proxyJump)    block += sp + 'ProxyJump ' + host.proxyJump + '\n'

    newLines.push(block)
    fs.writeFileSync(resolved, newLines.join('\n'), 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ─── Encrypted Passwords ──────────────────────────────────────────────────────

const crypto = require('crypto')
const passwordsFile = path.join(app.getPath('userData'), 'passwords.json')

function getMachineKey() {
  // Используем путь userData как уникальный seed для этой машины
  const seed = app.getPath('userData')
  return crypto.createHash('sha256').update(seed).digest()
}

function encrypt(text) {
  const key = getMachineKey()
  const iv  = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decrypt(data) {
  try {
    const [ivHex, encHex] = data.split(':')
    const key = getMachineKey()
    const iv  = Buffer.from(ivHex, 'hex')
    const enc = Buffer.from(encHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
  } catch { return null }
}

function loadPasswords() {
  try { return JSON.parse(fs.readFileSync(passwordsFile, 'utf8')) } catch { return {} }
}

function savePasswords(data) {
  fs.writeFileSync(passwordsFile, JSON.stringify(data, null, 2))
}

ipcMain.handle('ssh:save-password', (event, { hostName, password }) => {
  const data = loadPasswords()
  data[hostName] = encrypt(password)
  savePasswords(data)
  return { ok: true }
})

ipcMain.handle('ssh:get-password', (event, { hostName }) => {
  const data = loadPasswords()
  if (!data[hostName]) return { ok: false }
  const pass = decrypt(data[hostName])
  return pass ? { ok: true, password: pass } : { ok: false }
})

ipcMain.handle('ssh:delete-password', (event, { hostName }) => {
  const data = loadPasswords()
  delete data[hostName]
  savePasswords(data)
  return { ok: true }
})
