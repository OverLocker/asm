import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { SearchAddon } from 'xterm-addon-search'
import { buildXtermTheme } from '../termSettings'

// Границы локального масштаба (Ctrl+колесо)
const LOCAL_FONT_MIN = 8
const LOCAL_FONT_MAX = 32
const LOCAL_FONT_STEP = 1

export default function TerminalPane({ tab, termSettings, onUpdate, onReconnect, onActivity, onOpenBrowser, onRegisterWriter }) {
  const containerRef  = useRef(null)
  const [localStatus, setLocalStatus] = useState('connecting') // 'connecting'|'connected'|'closed'|'error'
  const [sessionClosed, setSessionClosed] = useState(false)
  const [connectTimedOut, setConnectTimedOut] = useState(false)
  const termRef       = useRef(null)
  const fitRef        = useRef(null)
  const searchRef     = useRef(null)
  const [searchOpen, setSearchOpen]   = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInfo, setSearchInfo]   = useState('')
  const searchInputRef = useRef(null)
  const localFontSize = useRef(termSettings.fontSize)

  // ─── Таймаут подключения — только локальный стейт, не tab.status ─────────
  useEffect(() => {
    if (localStatus !== 'connecting') { setConnectTimedOut(false); return }
    const timeout = (termSettings.connectionTimeout || 15) * 1000
    const timer = setTimeout(() => setConnectTimedOut(true), timeout)
    return () => clearTimeout(timer)
  }, [localStatus, termSettings.connectionTimeout])

  // ─── Монтирование: PTY создаётся один раз ────────────────────────────────
  useEffect(() => {
    const theme = buildXtermTheme(termSettings)
    localFontSize.current = termSettings.fontSize

    const term = new Terminal({
      theme,
      fontFamily:  `'${termSettings.fontFamily}', monospace`,
      fontSize:    termSettings.fontSize,
      lineHeight:  termSettings.lineHeight,
      cursorBlink: termSettings.cursorBlink,
      cursorStyle: termSettings.cursorStyle,
      scrollback:  termSettings.scrollback,
      allowProposedApi: true,
      applicationCursor: false,
      macOptionIsMeta:   false,
      // F1 пробрасываем в window чтобы App.jsx мог поймать
      customKeyEventHandler: (e) => {
        if (e.type === 'keydown' && e.key === 'F1') {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true }))
          return false
        }
        return true
      },
    })

    const fit = new FitAddon()
    const searchAddon = new SearchAddon()
    term.loadAddon(fit)
    term.loadAddon(searchAddon)
    searchRef.current = searchAddon
    
    // WebLinksAddon с кастомным обработчиком — открывать ссылки в браузере SSHM
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      event.preventDefault()
      // Открываем ссылку в встроенном браузере SSHM
      if (onOpenBrowser && uri) {
        onOpenBrowser(uri)
      }
    })
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)

    // F11 — перехватываем для fullscreen, остальные F-keys идут в PTY как есть
    if (typeof term.attachCustomKeyEventHandler === 'function') {
      term.attachCustomKeyEventHandler((e) => {
        if (e.key === 'F11' && e.type === 'keydown') {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11', bubbles: true }))
          return false  // не передавать в PTY
        }
        return true  // всё остальное (F1-F10, F12) идёт в PTY
      })
    }

    // Сплит: контейнер может ещё не иметь размера в момент open().
    // rAF + setTimeout 0 — два кадра; к тому времени layout гарантированно применён.
    const doFit = () => { try { fit.fit() } catch {} }
    requestAnimationFrame(() => { doFit(); setTimeout(doFit, 50) })

    termRef.current = term
    fitRef.current  = fit

    // Ctrl+колесо — масштаб шрифта локально для этой вкладки
    const onWheel = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const delta = e.deltaY < 0 ? LOCAL_FONT_STEP : -LOCAL_FONT_STEP
      const next  = Math.max(LOCAL_FONT_MIN, Math.min(LOCAL_FONT_MAX, localFontSize.current + delta))
      if (next === localFontSize.current) return
      localFontSize.current = next
      term.options.fontSize = next
      try { fit.fit() } catch {}
    }
    // passive: false чтобы preventDefault работал
    containerRef.current.addEventListener('wheel', onWheel, { passive: false })

    // Ctrl+F — открыть поиск
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen((v) => !v)
        setTimeout(() => searchInputRef.current?.focus(), 30)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    containerRef.current.addEventListener('keydown', onKeyDown)

    const id = tab.id
    const { hostname, host, user, port, identityFile, proxyJump, type: hostType } = tab.host
    const isLocal  = hostname === 'localhost' && host === 'local'
    const isSerial = hostType === 'serial'
    onUpdate({ status: 'connecting' })
    setLocalStatus('connecting')

    const spawnOpts = isSerial
      ? {
          id,
          isSerial:   true,
          serialPort: tab.host.serialPort || hostname,
          baudRate:   tab.host.baudRate   || 115200,
          dataBits:   tab.host.dataBits   || 8,
          parity:     tab.host.parity     || 'none',
          stopBits:   tab.host.stopBits   || 1,
          serialProg: tab.host.serialProg || 'picocom',
        }
      : { id, host: hostname, user, port, identityFile, proxyJump, isLocal }

    const spawnTitle = isSerial
      ? `${tab.host.serialPort || hostname} @ ${tab.host.baudRate || 115200}`
      : isLocal ? 'localhost' : `${user ? user + '@' : ''}${host}`

    window.api.pty.spawn(spawnOpts)
      .then(() => {
        setLocalStatus('connected')
        onUpdate({ status: 'connected', title: spawnTitle })
      })
      .catch(() => {
        setLocalStatus('error')
        onUpdate({ status: 'error' })
        term.write('\r\n\x1b[31mFailed to spawn process\x1b[0m\r\n')
      })

    const offData = window.api.pty.onData(id, (data) => {
      term.write(data)
      onActivity?.()
    })
    term.onData((data) => window.api.pty.write(id, data))

    // Регистрируем функцию записи для broadcast (SplitPane)
    const unregister = onRegisterWriter?.(id, (data) => window.api.pty.write(id, data))

    window.api.pty.onExit(id, (code) => {
      const wasAbrupt = code !== 0
      setLocalStatus('closed')
      onUpdate({ status: 'closed' })
      term.write(`\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m\r\n`)
      if (wasAbrupt) {
        setSessionClosed(true)
      }
    })

    const ro = new ResizeObserver(() => {
      try { fit.fit(); window.api.pty.resize(id, term.cols, term.rows) } catch {}
    })
    ro.observe(containerRef.current)

    return () => {
      containerRef.current?.removeEventListener('wheel', onWheel)
      containerRef.current?.removeEventListener('keydown', onKeyDown)
      offData?.()
      unregister?.()
      ro.disconnect()
      window.api.pty.kill(id)
      term.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Применяем глобальные настройки горячо, без перезапуска PTY ──────────
  useEffect(() => {
    const term = termRef.current
    if (!term) return

    const theme = buildXtermTheme(termSettings)
    term.options.theme       = theme
    term.options.fontFamily  = `'${termSettings.fontFamily}', monospace`
    term.options.lineHeight  = termSettings.lineHeight
    term.options.cursorBlink = termSettings.cursorBlink
    term.options.cursorStyle = termSettings.cursorStyle

    // Глобальный fontSize сбрасывает локальный масштаб
    localFontSize.current   = termSettings.fontSize
    term.options.fontSize   = termSettings.fontSize

    // xterm обновляет canvas-цвета через IThemeService, но CSS-фон
    // .xterm-viewport не перерисовывается автоматически при горячей смене.
    // Явно прописываем background, чтобы терминал не оставался с дефолтным
    // цветом пока не придёт первый вывод (актуально при старте до загрузки настроек).
    if (term.element) {
      const viewport = term.element.querySelector('.xterm-viewport')
      if (viewport) viewport.style.backgroundColor = theme.background
    }

    try { fitRef.current?.fit() } catch {}
  }, [termSettings])

  const doSearch = useCallback((q, direction = 'next') => {
    if (!searchRef.current || !q) { setSearchInfo(''); return }
    const opts = { regex: false, wholeWord: false, caseSensitive: false, incremental: true,
      decorations: { matchBackground: '#facc15cc', matchBorder: '#d97706', matchOverviewRuler: '#d97706',
        activeMatchBackground: '#f97316cc', activeMatchBorder: '#ea580c', activeMatchColorOverviewRuler: '#ea580c' } }
    const found = direction === 'prev'
      ? searchRef.current.findPrevious(q, opts)
      : searchRef.current.findNext(q, opts)
    setSearchInfo(found ? 'found' : 'not-found')
  }, [])

  // Сбросить подсветку при закрытии
  useEffect(() => {
    if (!searchOpen) {
      searchRef.current?.clearDecorations?.()
      setSearchQuery('')
      setSearchInfo('')
    }
  }, [searchOpen])

  // ─── Стиль контейнера: цветной фон + картинка поверх ─────────────────────
  const { background, opacity, bgImage, bgImageOpacity } = termSettings
  const hasBgImage = bgImage && bgImage.length > 0

  return (
    <div style={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden', background }}>

      {/* Слой 1: фоновая картинка */}
      {hasBgImage && (
        <div style={{
          position:   'absolute', inset: 0, zIndex: 0,
          backgroundImage:    `url(${bgImage})`,
          backgroundSize:     'cover',
          backgroundPosition: 'center',
          opacity:            bgImageOpacity,
          pointerEvents:      'none',
        }} />
      )}

      {/* Слой 2: xterm */}
      <div
        ref={containerRef}
        style={{
          position:   'absolute', inset: 0, zIndex: 1,
          background: hasBgImage ? 'transparent' : background,
        }}
      />

      {/* Слой 3: оверлей реконнекта — показываем если сессия закрыта, ошибка, или таймаут коннекта */}
      {termSettings.showReconnectButton && (sessionClosed || localStatus === 'error' || localStatus === 'closed' || connectTimedOut) && (
        <div style={{
          position: 'absolute', bottom: 16, right: 16, zIndex: 10,
        }}>
          <button
            onClick={() => { setSessionClosed(false); setConnectTimedOut(false); setLocalStatus('connecting'); onReconnect && onReconnect(tab) }}
            style={{
              padding: '7px 16px',
              background: connectTimedOut && localStatus === 'connecting' ? 'var(--amber)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 12px rgba(37,99,235,0.35)',
              transition: 'opacity 0.2s',
            }}
            className="hov-dim"
          >
            {connectTimedOut && localStatus === 'connecting' ? '⏱ Долгое подключение — переподключиться?' : '↺ Подключиться заново'}
          </button>
        </div>
      )}
      {/* Слой 4: поиск (Ctrl+F) */}
      {searchOpen && (
        <div style={{
          position: 'absolute', top: 8, right: 12, zIndex: 20,
          background: 'var(--bg1)', border: '1px solid var(--border2)',
          borderRadius: 8, padding: '6px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); doSearch(e.target.value) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  { e.shiftKey ? doSearch(searchQuery, 'prev') : doSearch(searchQuery, 'next') }
              if (e.key === 'Escape') { setSearchOpen(false) }
            }}
            placeholder="Поиск..."
            style={{
              width: 180, fontSize: 12, fontFamily: 'var(--font-mono)',
              padding: '3px 8px', borderRadius: 5,
              border: searchInfo === 'not-found' ? '1.5px solid var(--red)' : '1px solid var(--border2)',
              background: 'var(--bg2)', color: 'var(--text0)',
              outline: 'none',
            }}
          />
          {searchInfo === 'not-found' && (
            <span style={{ fontSize: 11, color: 'var(--red)', whiteSpace: 'nowrap' }}>Не найдено</span>
          )}
          <button onClick={() => doSearch(searchQuery, 'prev')} title="Пред. (Shift+Enter)"
            style={{ fontSize: 13, color: 'var(--text2)', padding: '2px 6px', borderRadius: 4, background: 'var(--bg2)', border: '1px solid var(--border2)' }}>↑</button>
          <button onClick={() => doSearch(searchQuery, 'next')} title="След. (Enter)"
            style={{ fontSize: 13, color: 'var(--text2)', padding: '2px 6px', borderRadius: 4, background: 'var(--bg2)', border: '1px solid var(--border2)' }}>↓</button>
          <button onClick={() => setSearchOpen(false)} title="Закрыть (Esc)"
            style={{ fontSize: 15, color: 'var(--text3)', padding: '0 4px', marginLeft: 2 }}
            className="hov-red"
          >×</button>
        </div>
      )}
    </div>
  )
}
