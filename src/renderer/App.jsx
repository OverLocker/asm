// patch3: editor preference placeholder
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar            from './components/Sidebar'
import MiniSftp           from './components/MiniSftp'
import TabBar             from './components/TabBar'
import SftpPane           from './components/SftpPane'
import TunnelPane         from './components/TunnelPane'
import WelcomePane        from './components/WelcomePane'
import SettingsModal      from './components/SettingsModal'
import TunnelRulesModal   from './components/TunnelRulesModal'
import AddHostModal       from './components/AddHostModal'
import ActiveTunnels      from './components/ActiveTunnels'
import BrowserPane        from './components/BrowserPane'
import EditorPane         from './components/EditorPane'
import HotkeyHelp        from './components/HotkeyHelp'
import SplitPane          from './components/SplitPane'
import SftpCommander      from './components/SftpCommander'
import ExportImportModal  from './components/ExportImportModal'
import { DEFAULT_SETTINGS, applyUITheme } from './termSettings'

// ─── Error Boundary — ловит краши внутри вкладок ─────────────────────────────
class TabErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  componentDidCatch(e, info) { console.error('[TabErrorBoundary]', e, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg1)', height: '100%' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠ Ошибка рендеринга вкладки</div>
          <pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text1)' }}>{String(this.state.error)}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, padding: '4px 12px', borderRadius: 5, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Попробовать снова
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

let tabCounter = 0
const newId = () => `tab-${++tabCounter}`

export default function App() {
  const [hosts, setHosts]               = useState([])
  const [customGroups, setCustomGroups] = useState([])
  const [notes, setNotes]               = useState({})
  const [tabs, setTabs]                 = useState([])
  const [activeTab, setActiveTab]       = useState(null)
  const [search, setSearch]             = useState('')
  const [sidebarWidth, setSidebarWidth] = useState(240)
  const [sidebarHidden, setSidebarHidden] = useState(false)  // ← скрыть панель
  const [compact, setCompact]           = useState(false)    // ← краткий вывод
  const [x11, setX11]                   = useState(false)    // ← X11 Forwarding
  const [uiFullscreen, setUiFullscreen] = useState(false)    // ← полный экран (без TabBar/Sidebar)
  const [termSettings, setTermSettings] = useState(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp]         = useState(false)
  const [monitorEnabled, setMonitorEnabled] = useState(false)
  const [history, setHistory]           = useState([])
  const [tunnelRules, setTunnelRules]   = useState([])
  const [hostSettings, setHostSettings] = useState({})
  const hostSettingsRef = React.useRef({})
  const splitPaneRefs   = React.useRef({})
  const [showTunnels, setShowTunnels]   = useState(false)
  const [showAddHost, setShowAddHost]   = useState(false)
  const [showExportImport, setShowExportImport] = useState(false)
  const [editingHost, setEditingHost] = useState(null)
  const [autoTunnels, setAutoTunnels]   = useState({})
  const [favorites, setFavorites]       = useState([])

  useEffect(() => {
    window.api.ssh.listHosts().then(setHosts)
    window.api.groups.load().then((saved) => {
      if (Array.isArray(saved) && saved.length > 0) setCustomGroups(saved)
      else {
        const def = [{ id: 'my-hosts', name: 'My Hosts', hostKeys: [], children: [] }]
        setCustomGroups(def); window.api.groups.save(def)
      }
    })
    window.api.notes.load().then(setNotes)
    window.api.settings.load().then((saved) => {
      if (saved) setTermSettings({ ...DEFAULT_SETTINGS, ...saved })
    })
    window.api.history.load().then((saved) => {
      if (Array.isArray(saved)) setHistory(saved)
    })
    window.api.tunnelRules.load().then((saved) => {
      if (Array.isArray(saved)) setTunnelRules(saved)
    })
    window.api.hostSettings.load().then((saved) => {
      if (saved && typeof saved === 'object') setHostSettings(saved)
    })
    window.api.favorites.load().then((saved) => {
      if (Array.isArray(saved)) setFavorites(saved)
    })

    // Загружаем compact mode из глобальных настроек
    window.api.view?.getCompactMode?.().then((v) => { if (v) setCompact(v) })
    window.api.ssh?.getX11Forwarding?.().then((v) => { if (v) setX11(v) })

    // Подписки на события из меню
    const offCompact     = window.api.view?.onCompactToggled?.((v) => setCompact(v))
    const offFullscreen  = window.api.view?.onFullscreenToggled?.((v) => setUiFullscreen(v))

    // F11 — переключение полного экрана
    const onKey = (e) => {
      if (e.key === 'F11') {
        e.preventDefault()
        setUiFullscreen((prev) => {
          const next = !prev
          window.api.view?.setFullScreen?.(next)
          return next
        })
      }
      if (e.key === 'F1') {
        e.preventDefault()
        setShowHelp(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)

    // Обновление хостов после удаления из Sidebar
    const onHostsUpdated = (e) => { if (Array.isArray(e.detail)) setHosts(e.detail) }
    window.addEventListener('asm:hosts-updated', onHostsUpdated)

    return () => {
      offCompact?.()
      offFullscreen?.()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('asm:hosts-updated', onHostsUpdated)
    }
  }, [])

  useEffect(() => {
    // setZoomFactor работает на уровне Electron и не зависит от системного DPI
    window.api.ui?.setZoom(termSettings.uiScale || 1.0)
  }, [termSettings.uiScale])

  // Webview сбрасывает zoom при монтировании — переприменяем с задержкой
  useEffect(() => {
    const hasBrowser = tabs.some(t => t.type === 'browser')
    if (!hasBrowser) return
    const scale = termSettings.uiScale || 1.0
    // Даём webview время инициализироваться, потом восстанавливаем zoom
    const t1 = setTimeout(() => window.api.ui?.setZoom(scale), 100)
    const t2 = setTimeout(() => window.api.ui?.setZoom(scale), 600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [tabs.length, activeTab, termSettings.uiScale])

  useEffect(() => {
    applyUITheme(termSettings.uiTheme || 'Light')
  }, [termSettings.uiTheme])

  // Следим за системной темой если выбрана 'System'
  useEffect(() => {
    if (termSettings.uiTheme !== 'System') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyUITheme('System')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [termSettings.uiTheme])

  const saveCustomGroups = useCallback((tree) => {
    setCustomGroups(tree); window.api.groups.save(tree)
  }, [])

  const saveSettings = useCallback((next) => {
    setTermSettings(next)
    window.api.settings.save(next)
    // Кешируем тему для мгновенного применения при следующем старте
    try { localStorage.setItem('asm-theme-cache', JSON.stringify({ uiTheme: next.uiTheme })) } catch {}
  }, [])

  const saveTunnelRules = useCallback((rules) => {
    setTunnelRules(rules); window.api.tunnelRules.save(rules)
  }, [])

  const saveHostSettings = useCallback((hs) => {
    setHostSettings(hs); window.api.hostSettings.save(hs)
  }, [])

  // Переключить признак "Проброс" у хоста
  const toggleFavorite = useCallback((host) => {
    setFavorites((prev) => {
      const exists = prev.find((f) => f.host === host.host)
      const next = exists
        ? prev.filter((f) => f.host !== host.host)
        : [...prev, { host: host.host, hostname: host.hostname, user: host.user, port: host.port }]
      window.api.favorites.save(next)
      return next
    })
  }, [])

  const toggleHostTunnel = useCallback((hostKey) => {
    setHostSettings((prev) => {
      const next = { ...prev, [hostKey]: { ...prev[hostKey], tunnel: !prev[hostKey]?.tunnel } }
      window.api.hostSettings.save(next)
      return next
    })
  }, [])

  const openTab = useCallback((host, type = 'terminal') => {
    const id  = newId()
    const hostColor = hostSettingsRef.current[host.host]?.color
    const tab = { id, host, type, title: host.host, status: 'connecting', ...(hostColor ? { color: hostColor } : {}) }
    setTabs((t) => [...t, tab])
    setActiveTab(id)

    if (type === 'terminal') {
      setHistory((prev) => {
        const entry = { host: host.host, hostname: host.hostname, user: host.user, port: host.port, ts: Date.now() }
        const next = [entry, ...prev.filter((e) => e.host !== host.host)].slice(0, 20)
        window.api.history.save(next)
        return next
      })
    }
  }, [])

  // Открыть хост в сплите активного терминального таба
  const openSplit = useCallback((host, where) => {
    // Читаем из рефов вместо state — deps не нужны, функция стабильна
    const activeTerm = tabsRef.current.find(
      (t) => t.id === activeTabRef.current && t.type === 'terminal'
    )
    if (activeTerm) {
      splitPaneRefs.current[activeTabRef.current]?.splitWith(host, where)
    } else {
      openTab(host, 'terminal')
    }
  }, [openTab])


  // Открыть файл с сервера во встроенном редакторе
  const openEditorTab = useCallback((sftpId, remotePath, fileName) => {
    // Если такой файл уже открыт — просто переключаемся
    setTabs((prev) => {
      const existing = prev.find((t) => t.type === 'editor' && t.remotePath === remotePath && t.sftpId === sftpId)
      if (existing) { setActiveTab(existing.id); return prev }
      const id = newId()
      const tab = { id, type: 'editor', sftpId, remotePath, fileName, title: fileName, status: 'connecting' }
      setActiveTab(id)
      return [...prev, tab]
    })
  }, [])

  // Автозапуск туннелей ПОСЛЕ установки SSH-соединения
  const handleTabConnected = useCallback(async (tabId, host, currentHostSettings, currentRules) => {
    const hs = currentHostSettings[host.host]
    if (!hs?.tunnel) return
    const enabled = currentRules.filter((r) => r.enabled && r.localPort)
    if (enabled.length === 0) return

    const results = await Promise.all(enabled.map(async (rule) => {
      const tid = `auto-${tabId}-${rule.id}`
      const res = await window.api.tunnel.start({
        id:          tid,
        host:        host.hostname,
        user:        host.user,
        port:        host.port,
        identityFile: host.identityFile,
        localPort:   parseInt(rule.localPort),
        remoteHost:  rule.remoteHost  || 'localhost',
        remotePort:  parseInt(rule.remotePort) || 0,
        direction:   rule.direction,
      })
      return res.ok ? { tid, rule, info: res.info } : null
    }))

    const started = results.filter(Boolean)
    if (started.length > 0) {
      setAutoTunnels((prev) => {
        const existing = prev[tabId] || []
        // Проверяем дубли по tid и добавляем только новые
        const newTunnels = started.filter((s) => !existing.find((e) => e.tid === s.tid))
        return { ...prev, [tabId]: [...existing, ...newTunnels] }
      })
    }
  }, [])

  const stopAutoTunnels = useCallback((tabId) => {
    const entries = autoTunnels[tabId] || []
    entries.forEach(({ tid }) => window.api.tunnel.stop(tid))
    setAutoTunnels((prev) => { const next = { ...prev }; delete next[tabId]; return next })
  }, [autoTunnels])

  const stopSingleTunnel = useCallback((tid) => {
    window.api.tunnel.stop(tid)
    setAutoTunnels((prev) => {
      const next = {}
      for (const [tabId, entries] of Object.entries(prev)) {
        const filtered = entries.filter((e) => e.tid !== tid)
        if (filtered.length > 0) next[tabId] = filtered
      }
      return next
    })
  }, [])

  const handleReconnect = useCallback((closedTab) => {
    const id  = newId()
    const hostColor = hostSettingsRef.current[closedTab.host.host]?.color
    const tab = { id, host: closedTab.host, type: 'terminal', title: closedTab.host.host, status: 'connecting', ...(hostColor ? { color: hostColor } : {}) }
    setTabs((t) => t.map((x) => x.id === closedTab.id ? tab : x))
    setActiveTab(id)
  }, [])

  const closeTab = useCallback((id) => {
    stopAutoTunnels(id)
    setTabs((t) => {
      const next = t.filter((x) => x.id !== id)
      if (activeTab === id) {
        const idx = t.findIndex((x) => x.id === id)
        setActiveTab(next[Math.max(0, idx - 1)]?.id ?? null)
      }
      return next
    })
  }, [activeTab, stopAutoTunnels])

  // ─── Глобальные горячие клавиши ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return

      // Ctrl+W — закрыть активную вкладку
      if (e.key === 'w') {
        e.preventDefault()
        if (activeTabRef.current) closeTab(activeTabRef.current)
        return
      }

      // Ctrl+Tab / Ctrl+Shift+Tab — следующая/предыдущая вкладка
      if (e.key === 'Tab') {
        e.preventDefault()
        const t = tabsRef.current
        if (t.length < 2) return
        const idx = t.findIndex((x) => x.id === activeTabRef.current)
        const next = e.shiftKey
          ? t[(idx - 1 + t.length) % t.length]
          : t[(idx + 1) % t.length]
        setActiveTab(next.id)
        return
      }

      // Ctrl+1..9 — переключиться на вкладку по номеру
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1
        const t = tabsRef.current
        if (t[idx]) { e.preventDefault(); setActiveTab(t[idx].id) }
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeTab])

  // Ref для актуальных значений без stale closure
  const tunnelRulesRef   = React.useRef(tunnelRules)
  const tabsRef          = React.useRef(tabs)
  const activeTabRef     = React.useRef(activeTab)
  React.useEffect(() => { hostSettingsRef.current = hostSettings }, [hostSettings])
  React.useEffect(() => { tunnelRulesRef.current  = tunnelRules  }, [tunnelRules])
  React.useEffect(() => { tabsRef.current         = tabs         }, [tabs])
  React.useEffect(() => { activeTabRef.current    = activeTab    }, [activeTab])

  const updateTab = useCallback((id, patch) => {
    // Persist browserZoom to settings when changed from BrowserPane
    if (patch.browserZoom !== undefined) {
      setTermSettings((prev) => {
        const next = { ...prev, browserZoom: patch.browserZoom }
        window.api.settings.save(next)
        return next
      })
    }
    setTabs((t) => {
      const next = t.map((x) => x.id === id ? { ...x, ...patch } : x)
      // Запускаем туннели ПОСЛЕ установки соединения
      // host берём из обновлённого стейта — он точно актуален
      if (patch.status === 'connected') {
        const tab = next.find((x) => x.id === id)
        if (tab?.host && tab.type === 'terminal') {
          setTimeout(() => {
            handleTabConnected(id, tab.host, hostSettingsRef.current, tunnelRulesRef.current)
          }, 0)
        }
      }
      return next
    })
  }, [handleTabConnected])

  // Стабильные per-tabId коллбэки — не пересоздаются на каждый рендер App
  // Предотвращает ненужные ре-рендеры SplitPane/SftpPane/EditorPane
  const tabUpdatersRef = React.useRef({})
  const tabActivityRef = React.useRef({})
  React.useEffect(() => {
    const ids = new Set(tabs.map(t => t.id))
    Object.keys(tabUpdatersRef.current).forEach(id => { if (!ids.has(id)) delete tabUpdatersRef.current[id] })
    Object.keys(tabActivityRef.current).forEach(id => { if (!ids.has(id)) delete tabActivityRef.current[id] })
  }, [tabs])
  const getTabUpdater = React.useCallback((tabId) => {
    if (!tabUpdatersRef.current[tabId])
      tabUpdatersRef.current[tabId] = (p) => updateTab(tabId, p)
    return tabUpdatersRef.current[tabId]
  }, [updateTab])
  const getTabActivity = React.useCallback((tabId) => {
    if (!tabActivityRef.current[tabId])
      tabActivityRef.current[tabId] = () => {
        if (activeTabRef.current !== tabId)
          setTabs(t => t.map(x => x.id === tabId ? { ...x, hasActivity: true } : x))
      }
    return tabActivityRef.current[tabId]
  }, [])

  // ─── SFTP Commander ───────────────────────────────────────────────────────
  // openSftpCommander() — открыть пустой
  // openSftpCommander(host, 'left'|'right') — подключить панель
  const openSftpCommander = useCallback((host = null, side = null) => {
    // Если side указан — ищем уже открытый Commander и подключаем панель
    if (host && side) {
      const existing = tabsRef.current.find((t) => t.type === 'sftp-commander')
      if (existing) {
        setActiveTab(existing.id)
        // Передаём хост через pending — SftpCommander подхватит в useEffect
        updateTab(existing.id, { pendingHost: host, pendingPanel: side })
        return
      }
    }
    // Создаём новый Commander
    const id  = newId()
    const tab = {
      id, type: 'sftp-commander',
      leftHost:  side === 'left'  ? host : (side === null ? null : null),
      rightHost: side === 'right' ? host : null,
      title: '⇄ Commander',
      status: 'connected',
    }
    setTabs((t) => [...t, tab])
    setActiveTab(id)
  }, [updateTab])

  const openBrowser = useCallback((url) => {
    const existing = tabsRef.current.find((t) => t.type === 'browser')
    if (existing) {
      // Вкладка уже открыта — переключаемся и диспатчим ПОСЛЕ переключения
      setActiveTab(existing.id)
      // setTimeout даёт React отрендерить вкладку прежде чем слать событие
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('browser:open-url', { detail: { url } }))
      }, 50)
      return
    }
    // Первое открытие — передаём url прямо в таб, BrowserPane прочитает его при монтировании
    const id  = newId()
    const tab = { id, url, type: 'browser', title: 'Браузер', status: 'connected' }
    setTabs((t) => [...t, tab])
    setActiveTab(id)
  }, [])

  const setTabColor = useCallback((id, color) => {
    setTabs((t) => t.map((x) => x.id === id ? { ...x, color } : x))
  }, [])

  // Сбросить активность при переключении на вкладку
  const handleSelect = useCallback((id) => {
    setActiveTab(id)
    setTabs((t) => t.map((x) => x.id === id ? { ...x, hasActivity: false } : x))
  }, [])

  const goHome = useCallback(() => {
    setActiveTab(null)
  }, [])

  const saveNote = useCallback((key, text) => {
    setNotes((n) => { const next = { ...n, [key]: text }; window.api.notes.save(next); return next })
  }, [])

  // Стабильные коллбэки для Sidebar — без них Sidebar ре-рендерится на каждый байт из PTY
  const onAddHostCb      = useCallback(() => setShowAddHost(true), [])
  const onEditHostCb     = useCallback((host) => { setEditingHost(host); setShowAddHost(true) }, [])
  const onExportImportCb = useCallback(() => setShowExportImport(true), [])
  const onHideSidebarCb  = useCallback(() => setSidebarHidden(true), [])

  
  // activeTabData оставлен для совместимости если где-то используется
  const activeTabData = useMemo(() => tabs.find(t => t.id === activeTab) || null, [tabs, activeTab])

return (
    <div style={{ display: 'flex', height: '100vh', minHeight: 0, overflow: 'hidden', background: 'var(--bg0)' }}>

      {/* Боковая панель — скрывается в fullscreen или sidebarHidden */}
      {!uiFullscreen && !sidebarHidden && (
        <div style={{ display: 'flex', flexDirection: 'column', width: sidebarWidth, flexShrink: 0, minHeight: 0 }}>
          <Sidebar
            hosts={hosts}
            customGroups={customGroups}
            notes={notes}
            hostSettings={hostSettings}
            search={search}
            onSearch={setSearch}
            onOpen={openTab}
            onOpenSplit={openSplit}
            onSaveCustomGroups={saveCustomGroups}
            onSaveNote={saveNote}
            onToggleHostTunnel={toggleHostTunnel}
            onToggleFavorite={toggleFavorite}
            favorites={favorites}
            onAddHost={onAddHostCb}
            onEditHost={onEditHostCb}
            onExportImport={onExportImportCb}
            onOpenSftpCommander={openSftpCommander}
            onSaveHostSettings={saveHostSettings}
            externalTerminal={termSettings.externalTerminal || 'konsole'}
            width={sidebarWidth}
            onResize={setSidebarWidth}
            compact={compact}
            onHide={onHideSidebarCb}
          />
          {termSettings.miniSftp && (
            <div style={{
              flexShrink: 0, height: 220, borderTop: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: 'var(--text3)', padding: '4px 10px',
                background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
                textTransform: 'uppercase', letterSpacing: '.4px', flexShrink: 0,
              }}>📁 Мини-SFTP</div>
              <MiniSftp
                activeTab={tabs.find((t) => t.id === activeTab)}
                onOpenEditor={openEditorTab}
              />
            </div>
          )}
        </div>
      )}

      {/* Кнопка разворачивания свёрнутой панели */}
      {!uiFullscreen && sidebarHidden && (
        <button
          onClick={() => setSidebarHidden(false)}
          title="Показать панель (или нажмите F11 для полного экрана)"
          style={{
            width: 18, flexShrink: 0,
            background: 'var(--bg1)', border: 'none', borderRight: '1px solid var(--border)',
            color: 'var(--text3)', cursor: 'pointer', fontSize: 10, writingMode: 'vertical-rl',
            letterSpacing: 1,
          }}
          className="hov-bg-accent"
        >▶</button>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
        {/* TabBar скрывается в fullscreen — доступен F11 для выхода */}
        {!uiFullscreen && (
          <TabBar
            tabs={tabs}
            activeTab={activeTab}
            onSelect={handleSelect}
            onClose={closeTab}
            onOpenSettings={() => setShowSettings(true)}
            onOpenTunnels={() => setShowTunnels(true)}
            activeTunnelCount={Object.values(autoTunnels).reduce((s, arr) => s + arr.length, 0)}
            onSetTabColor={setTabColor}
            onGoHome={goHome}
            onOpenSftpCommander={openSftpCommander}
            onOpenLocalTerminal={() => openTab(
              { host: 'local', hostname: 'localhost', user: '', port: 22, identityFile: '', aliases: [] },
              'terminal'
            )}
            x11={x11}
            onToggleX11={async () => {
              const next = !x11
              setX11(next)
              await window.api.ssh?.setX11Forwarding?.(next)
            }}
            monitor={monitorEnabled}
            onToggleMonitor={() => setMonitorEnabled(v => !v)}
          />
        )}

        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {(tabs.length === 0 || activeTab === null) && (
            <WelcomePane
              hosts={hosts}
              history={history}
              favorites={favorites}
              onOpen={openTab}
              onOpenSettings={() => setShowSettings(true)}
              onToggleFavorite={toggleFavorite}
              historyLimit={termSettings.historyLimit ?? 5}
            />
          )}
          {tabs.map(tab => {
            const isActive = tab.id === activeTab
            return (
            <div key={tab.id} style={{ display: isActive ? 'flex' : 'none', height: '100%', minHeight: 0, flexDirection: 'column' }}>
              <TabErrorBoundary key={tab.id}>
              {tab.type === 'terminal' && (
                <SplitPane
                  ref={(el) => { if (el) splitPaneRefs.current[tab.id] = el; else delete splitPaneRefs.current[tab.id] }}
                  tab={tab}
                  termSettings={termSettings}
                  splitBorderSize={termSettings.splitBorderSize ?? 2}
                  onUpdate={getTabUpdater(tab.id)}
                  onReconnect={handleReconnect}
                  onOpenBrowser={openBrowser}
                  showMonitor={monitorEnabled}
                  onActivity={getTabActivity(tab.id)}
                />
              )}
              {tab.type === 'sftp'     && <SftpPane    tab={tab} onUpdate={getTabUpdater(tab.id)} onOpenEditor={openEditorTab} />}
              {tab.type === 'editor'   && <EditorPane  tab={tab} onUpdate={getTabUpdater(tab.id)} />}
              {tab.type === 'browser'  && (
                <BrowserPane
                  tab={tab}
                  browserZoom={termSettings.browserZoom}
                  browserNewTab={termSettings.browserNewTab}
                  browserHomePage={termSettings.browserHomePage}
                  onUpdate={getTabUpdater(tab.id)}
                />
              )}
              {tab.type === 'tunnel'   && <TunnelPane  tab={tab} onUpdate={getTabUpdater(tab.id)} />}
              {tab.type === 'sftp-commander' && (
                <SftpCommander
                  tab={{ ...tab, allHosts: hosts }}
                  onUpdate={getTabUpdater(tab.id)}
                  onOpenEditor={openEditorTab}
                />
              )}
              </TabErrorBoundary>
            </div>
            )
          })}
        </div>
      </div>

      {showSettings && (
        <SettingsModal settings={termSettings} onSave={saveSettings} onClose={() => setShowSettings(false)} />
      )}

      {showTunnels && (
        <TunnelRulesModal rules={tunnelRules} onSave={saveTunnelRules} onClose={() => setShowTunnels(false)} />
      )}

      {showExportImport && (
        <ExportImportModal
          hosts={hosts}
          groups={customGroups}
          onClose={() => setShowExportImport(false)}
          onImported={async () => {
            const updated = await window.api.ssh.listHosts()
            if (Array.isArray(updated)) setHosts(updated)
            setShowExportImport(false)
          }}
        />
      )}

      {showAddHost && (
        <AddHostModal
          initialHost={editingHost}
          onClose={() => { setEditingHost(null); setShowAddHost(false) }}
          onAdded={(newHosts) => { setHosts(newHosts); setShowAddHost(false) }}
        />
      )}

      <ActiveTunnels
        autoTunnels={autoTunnels}
        tabs={tabs}
        onStop={stopSingleTunnel}
        onOpenBrowser={openBrowser}
      />

      {showHelp && <HotkeyHelp onClose={() => setShowHelp(false)} />}

    </div>
  )
}
