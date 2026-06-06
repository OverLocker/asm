const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  ssh: {
    listHosts:    () => ipcRenderer.invoke('ssh:list-hosts'),
    openExternal: (opts) => ipcRenderer.invoke('ssh:open-external', opts),
    getX11Forwarding: () => ipcRenderer.invoke('ssh:get-x11-forwarding'),
    setX11Forwarding: (v) => ipcRenderer.invoke('ssh:set-x11-forwarding', v),
    onX11Toggled: (cb) => {
      ipcRenderer.on('x11:toggled', (_, value) => cb(value))
      return () => ipcRenderer.removeAllListeners('x11:toggled')
    },
  },
  view: {
    getCompactMode:    () => ipcRenderer.invoke('view:get-compact-mode'),
    onCompactToggled:  (cb) => {
      ipcRenderer.on('compact:toggled', (_, v) => cb(v))
      return () => ipcRenderer.removeAllListeners('compact:toggled')
    },
    onFullscreenToggled: (cb) => {
      ipcRenderer.on('fullscreen:toggled', (_, v) => cb(v))
      return () => ipcRenderer.removeAllListeners('fullscreen:toggled')
    },
    setFullScreen: (flag) => ipcRenderer.invoke('view:set-fullscreen', flag),
  },
  pty: {
    spawn:  (opts) => ipcRenderer.invoke('pty:spawn', opts),
    write:  (id, data) => ipcRenderer.send('pty:write', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.send('pty:resize', { id, cols, rows }),
    kill:   (id) => ipcRenderer.send('pty:kill', { id }),
    onData: (id, cb) => {
      const ch = `pty:data:${id}`
      ipcRenderer.on(ch, (_, data) => cb(data))
      return () => ipcRenderer.removeAllListeners(ch)
    },
    onExit: (id, cb) => {
      const ch = `pty:exit:${id}`
      ipcRenderer.once(ch, (_, code) => cb(code))
    },
  },
  sftp: {
    connect:     (opts) => ipcRenderer.invoke('sftp:connect', opts),
    readdir:     (id, dir) => ipcRenderer.invoke('sftp:readdir', { id, dir }),
    existsLocal:  (localPath) => ipcRenderer.invoke('sftp:exists-local', { localPath }),
    existsRemote: (id, remotePath) => ipcRenderer.invoke('sftp:exists-remote', { id, remotePath }),
    download:    (id, remotePath, localPath) => ipcRenderer.invoke('sftp:download', { id, remotePath, localPath }),
    downloadDir: (id, remoteDir, localDir) => ipcRenderer.invoke('sftp:download-dir', { id, remoteDir, localDir }),
    upload:      (id, localPath, remotePath) => ipcRenderer.invoke('sftp:upload', { id, localPath, remotePath }),
    mkdir:       (id, dir) => ipcRenderer.invoke('sftp:mkdir', { id, dir }),
    rename:      (id, oldPath, newPath) => ipcRenderer.invoke('sftp:rename', { id, oldPath, newPath }),
    delete:      (id, remotePath, isDir) => ipcRenderer.invoke('sftp:delete', { id, remotePath, isDir }),
    disconnect:  (id) => ipcRenderer.invoke('sftp:disconnect', { id }),
    readText:    (id, remotePath) => ipcRenderer.invoke('sftp:read-text', { id, remotePath }),
    writeText:   (id, remotePath, content) => ipcRenderer.invoke('sftp:write-text', { id, remotePath, content }),
    uploadDir:   (id, localDir, remoteDir) => ipcRenderer.invoke('sftp:upload-dir', { id, localDir, remoteDir }),
    openEdit:    (id, remotePath, fileName) => ipcRenderer.invoke('sftp:open-edit', { id, remotePath, fileName }),
    openWith:    (localPath, app) => ipcRenderer.invoke('sftp:open-with', { localPath, app }),
    pickApp:     () => ipcRenderer.invoke('sftp:pick-app'),
    prepareDrag: (id, remotePath, fileName) => ipcRenderer.invoke('sftp:prepare-drag', { id, remotePath, fileName }),
    // ─── Копирование между двумя SFTP сессиями ───────────────────────────────
    copyRemote:  (opts) => ipcRenderer.invoke('sftp:copy-remote', opts),
    onCopyProgress: (cb) => {
      ipcRenderer.on('sftp:copy-progress', (_, data) => cb(data))
      return () => ipcRenderer.removeAllListeners('sftp:copy-progress')
    },
    onEditSaved: (cb) => {
      ipcRenderer.on('sftp:edit-saved', (_, data) => cb(data))
      return () => ipcRenderer.removeAllListeners('sftp:edit-saved')
    },
    onProgress: (cb) => {
      ipcRenderer.on('sftp:progress', (_, data) => cb(data))
      return () => ipcRenderer.removeAllListeners('sftp:progress')
    },
  },
  tunnel: {
    start: (opts) => ipcRenderer.invoke('tunnel:start', opts),
    stop:  (id) => ipcRenderer.invoke('tunnel:stop', { id }),
    list:  () => ipcRenderer.invoke('tunnel:list'),
    stats: () => ipcRenderer.invoke('tunnel:stats'),
  },
  notes: {
    load: () => ipcRenderer.invoke('notes:load'),
    save: (notes) => ipcRenderer.invoke('notes:save', notes),
  },
  quickCommands: {
    load: () => ipcRenderer.invoke('quickCommands:load'),
    save: (cmds) => ipcRenderer.invoke('quickCommands:save', cmds),
  },
  groups: {
    load: () => ipcRenderer.invoke('groups:load'),
    save: (groups) => ipcRenderer.invoke('groups:save', groups),
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (s) => ipcRenderer.invoke('settings:save', s),
  },
  sessions: {
    load:           () => ipcRenderer.invoke('sessions:load'),
    save:           (s) => ipcRenderer.invoke('sessions:save', s),
    add:            (s) => ipcRenderer.invoke('sessions:add', s),
    update:         (id, updates) => ipcRenderer.invoke('sessions:update', { id, updates }),
    delete:         (id) => ipcRenderer.invoke('sessions:delete', { id }),
    launchExternal: (session) => ipcRenderer.invoke('sessions:launch-external', { session }),
  },
  asm: {
    export:      (opts) => ipcRenderer.invoke('asm:export', opts),
    import:      () => ipcRenderer.invoke('asm:import'),
    applyImport: (data, options) => ipcRenderer.invoke('asm:apply-import', { data, options }),
  },
  host: {
    ping: (hostname, port) => ipcRenderer.invoke('host:ping', { hostname, port }),
  },
  dialog: {
    openImage:  () => ipcRenderer.invoke('dialog:open-image'),
    savePath:   (defaultName) => ipcRenderer.invoke('dialog:save-path', { defaultName }),
    pickUpload: (mode) => ipcRenderer.invoke('dialog:pick-upload', { mode }),
    openFile:   (opts) => ipcRenderer.invoke('dialog:openFile', opts),
  },
  history: {
    load: () => ipcRenderer.invoke('history:load'),
    save: (h) => ipcRenderer.invoke('history:save', h),
  },
  tunnelRules: {
    load: () => ipcRenderer.invoke('tunnelRules:load'),
    save: (r) => ipcRenderer.invoke('tunnelRules:save', r),
  },
  hostSettings: {
    load: () => ipcRenderer.invoke('hostSettings:load'),
    save: (s) => ipcRenderer.invoke('hostSettings:save', s),
  },
  browser: {
    onPopup: (cb) => {
      ipcRenderer.on('browser:popup', (_, url) => cb(url))
      return () => ipcRenderer.removeAllListeners('browser:popup')
    },
  },
  terminal: {
    openLocal: (command) => ipcRenderer.invoke('terminal:open-local', { command }),
  },
  ui: {
    setZoom: (factor) => ipcRenderer.invoke('ui:set-zoom', factor),
    getZoom: () => ipcRenderer.invoke('ui:get-zoom'),
  },
  favorites: {
    load: () => ipcRenderer.invoke('favorites:load'),
    save: (f) => ipcRenderer.invoke('favorites:save', f),
  },
  monitor: {
    start:    (tabId, host) => ipcRenderer.invoke('ssh:monitor-start', { tabId, ...host }),
    stop:     (tabId) => ipcRenderer.invoke('ssh:monitor-stop', { tabId }),
    onStats:  (tabId, cb) => {
      const ch = `monitor:stats:${tabId}`
      ipcRenderer.on(ch, (_, data) => cb(data))
      return () => ipcRenderer.removeAllListeners(ch)
    },
  },
  completions: (opts) => ipcRenderer.invoke('ssh:completions', opts),
  serial: {
    listPorts: () => ipcRenderer.invoke('serial:list-ports'),
  },
  sshConfig: {
    listFiles:     () => ipcRenderer.invoke('ssh:list-config-files'),
    addHost:       (opts) => ipcRenderer.invoke('ssh:add-host', opts),
    updateHost:    (opts) => ipcRenderer.invoke('ssh:update-host', opts),
    deleteHost:    (opts) => ipcRenderer.invoke('ssh:delete-host', opts),
    reload:        () => ipcRenderer.invoke('ssh:list-hosts'),
    savePassword:  (name, pass) => ipcRenderer.invoke('ssh:save-password', { hostName: name, password: pass }),
    getPassword:   (name) => ipcRenderer.invoke('ssh:get-password', { hostName: name }),
    deletePassword:(name) => ipcRenderer.invoke('ssh:delete-password', { hostName: name }),
  },
})
