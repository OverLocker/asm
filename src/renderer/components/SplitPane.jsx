import React, { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'
import TerminalPane from './TerminalPane'
import HostMonitorBar from './HostMonitorBar'
import QuickCommandsBar from './QuickCommandsBar'

// ─── Layout tree ─────────────────────────────────────────────────────────────
let _pid = 0
const newId = () => `p${++_pid}`

function collectIds(node, acc = []) {
  if (node.type === 'leaf') { acc.push(node.id); return acc }
  collectIds(node.a, acc); collectIds(node.b, acc); return acc
}

function insertSplit(node, paneId, where) {
  if (node.type === 'leaf') {
    if (node.id !== paneId) return node
    const newLeaf = { type: 'leaf', id: newId(), _isNew: true }
    const dir   = (where === 'left' || where === 'right') ? 'h' : 'v'
    const first = (where === 'left' || where === 'top')
    return { type: 'split', dir, ratio: 0.5,
      a: first ? newLeaf : node,
      b: first ? node    : newLeaf }
  }
  return { ...node, a: insertSplit(node.a, paneId, where), b: insertSplit(node.b, paneId, where) }
}

function findNew(node) {
  if (node.type === 'leaf') return node._isNew ? node.id : null
  return findNew(node.a) || findNew(node.b)
}

function cleanNew(node) {
  if (node.type === 'leaf') { const { _isNew, ...r } = node; return r }
  return { ...node, a: cleanNew(node.a), b: cleanNew(node.b) }
}

function removeLeaf(node, paneId) {
  if (node.type === 'leaf') return node.id === paneId ? null : node
  const a = removeLeaf(node.a, paneId)
  const b = removeLeaf(node.b, paneId)
  if (a === null) return b
  if (b === null) return a
  return { ...node, a, b }
}

// ─── Вычислить прямоугольники для каждого листа ───────────────────────────────
// Возвращает Map: paneId → { left, top, width, height } в процентах
function computeRects(node, x = 0, y = 0, w = 100, h = 100, map = new Map()) {
  if (node.type === 'leaf') {
    map.set(node.id, { left: x, top: y, width: w, height: h })
    return map
  }
  if (node.dir === 'h') {
    const aw = w * node.ratio
    computeRects(node.a, x, y, aw, h, map)
    computeRects(node.b, x + aw, y, w - aw, h, map)
  } else {
    const ah = h * node.ratio
    computeRects(node.a, x, y, w, ah, map)
    computeRects(node.b, x, y + ah, w, h - ah, map)
  }
  return map
}

// ─── Сплиттеры ───────────────────────────────────────────────────────────────
function collectSplitters(node, x = 0, y = 0, w = 100, h = 100, acc = []) {
  if (node.type === 'leaf') return acc
  if (node.dir === 'h') {
    const sx = x + w * node.ratio
    acc.push({ id: `${node.a.id}-${node.b.id}`, dir: 'h', x: sx, y, h, node })
    collectSplitters(node.a, x, y, w * node.ratio, h, acc)
    collectSplitters(node.b, sx, y, w - w * node.ratio, h, acc)
  } else {
    const sy = y + h * node.ratio
    acc.push({ id: `${node.a.id}-${node.b.id}`, dir: 'v', x, y: sy, w, node })
    collectSplitters(node.a, x, y, w, h * node.ratio, acc)
    collectSplitters(node.b, x, sy, w, h - h * node.ratio, acc)
  }
  return acc
}

// ─── Splitter компонент ───────────────────────────────────────────────────────
function Splitter({ splitter, size, onRatio, containerRef }) {
  const { dir, x, y, h, w, node } = splitter
  const isH = dir === 'h'
  const halfSize = size / 2

  const onMouseDown = (e) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const move = (ev) => {
      const ratio = isH
        ? Math.max(0.1, Math.min(0.9, (ev.clientX - rect.left) / rect.width))
        : Math.max(0.1, Math.min(0.9, (ev.clientY - rect.top) / rect.height))
      onRatio(node, ratio)
    }
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  const hitSize = Math.max(size, 8) // зона захвата минимум 8px

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute', zIndex: 10,
        left:   isH ? `calc(${x}% - ${hitSize/2}px)` : `${x}%`,
        top:    isH ? `${y}%` : `calc(${y}% - ${hitSize/2}px)`,
        width:  isH ? `${hitSize}px` : `${w}%`,
        height: isH ? `${h}%`        : `${hitSize}px`,
        cursor: isH ? 'col-resize' : 'row-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => { e.currentTarget.querySelector('.sp-line').style.background = 'var(--accent)'; e.currentTarget.querySelector('.sp-handle').style.opacity = '1' }}
      onMouseLeave={(e) => { e.currentTarget.querySelector('.sp-line').style.background = '#888'; e.currentTarget.querySelector('.sp-handle').style.opacity = '0' }}
    >
      {/* Видимая линия */}
      <div className="sp-line" style={{
        [isH ? 'width' : 'height']: `${Math.max(size, 2)}px`,
        [isH ? 'height' : 'width']: '100%',
        background: '#888',
        flexShrink: 0,
      }} />
      {/* Маркер посередине — появляется при наведении */}
      <div className="sp-handle" style={{
        position: 'absolute',
        [isH ? 'width' : 'height']: '4px',
        [isH ? 'height' : 'width']: '24px',
        borderRadius: '3px',
        background: 'var(--text3)',
        opacity: 0,
        transition: 'opacity .15s',
      }} />
    </div>
  )
}

// ─── Broadcast bar ────────────────────────────────────────────────────────────
const HISTORY_KEY = 'broadcast-history'
const MAX_HISTORY = 100

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}
function saveHistory(h) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)) } catch {}
}

function BroadcastBar({ count, onSend, onSendRaw, host }) {
  const [val, setVal]               = useState('')
  const [focused, setFocused]       = useState(false)
  const [history, setHistory]       = useState(loadHistory)
  const [histIdx, setHistIdx]       = useState(-1)

  // История — дропдаун
  const [showHist, setShowHist]     = useState(false)
  const [histSearch, setHistSearch] = useState('')
  const histRef     = useRef(null)
  const histSrchRef = useRef(null)

  // Tab completion
  const cmdsRef     = useRef(null)   // null = не загружено, [] = пусто, [...] = список
  const loadingRef  = useRef(false)
  const [completions, setCompletions] = useState([])  // текущие варианты
  const [compIdx, setCompIdx]         = useState(0)
  const compRef     = useRef(null)

  const taRef = useRef(null)

  // ── Закрытие дропдаунов при клике снаружи ──────────────────────────────
  useEffect(() => {
    if (!showHist && completions.length === 0) return
    const close = (e) => {
      if (!histRef.current?.contains(e.target) && !compRef.current?.contains(e.target)) {
        setShowHist(false)
        setCompletions([])
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showHist, completions.length])

  if (count < 2) return null

  // ── История ────────────────────────────────────────────────────────────
  const pushHistory = (cmd) => {
    setHistory((h) => {
      const next = [cmd, ...h.filter(x => x !== cmd)].slice(0, MAX_HISTORY)
      saveHistory(next)
      return next
    })
  }

  const deleteHistory = (cmd, e) => {
    e.stopPropagation()
    setHistory((h) => {
      const next = h.filter(x => x !== cmd)
      saveHistory(next)
      return next
    })
  }

  const clearHistory = () => {
    setHistory([])
    saveHistory([])
    setShowHist(false)
  }

  const filteredHistory = histSearch
    ? history.filter(h => h.toLowerCase().includes(histSearch.toLowerCase()))
    : history

  // ── Tab completion ─────────────────────────────────────────────────────
  const loadCompletions = async () => {
    if (loadingRef.current || !host || host.isLocal) return
    loadingRef.current = true
    const res = await window.api.completions({
      host: host.hostname || host.host,
      user: host.user,
      port: host.port,
      identityFile: host.identityFile,
    })
    loadingRef.current = false
    cmdsRef.current = res.ok ? res.cmds : []
  }

  const triggerCompletion = async () => {
    if (!host || host.isLocal) return
    // Берём слово до курсора
    const cursor = taRef.current?.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    // Только первое слово строки / последнее слово перед пробелом
    const word = before.split(/[\s;|&]/).pop()
    if (!word) return

    if (cmdsRef.current === null) await loadCompletions()
    const cmds = cmdsRef.current || []
    const matches = cmds.filter(c => c.startsWith(word)).slice(0, 12)
    if (matches.length === 0) return
    if (matches.length === 1) {
      // Единственный вариант — вставляем сразу
      const newVal = val.slice(0, cursor - word.length) + matches[0] + ' ' + val.slice(cursor)
      setVal(newVal)
      setCompletions([])
      return
    }
    setCompletions(matches)
    setCompIdx(0)
  }

  const applyCompletion = (cmd) => {
    const cursor = taRef.current?.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const word   = before.split(/[\s;|&]/).pop()
    const newVal = val.slice(0, cursor - word.length) + cmd + ' ' + val.slice(cursor)
    setVal(newVal)
    setCompletions([])
    setTimeout(() => taRef.current?.focus(), 0)
  }

  // ── Отправка ───────────────────────────────────────────────────────────
  const send = () => {
    const trimmed = val.trim()
    if (!trimmed) return
    trimmed.split('\n').forEach((line, i) => {
      setTimeout(() => onSend(line + '\n'), i * 10)
    })
    pushHistory(trimmed)
    setVal('')
    setHistIdx(-1)
    setCompletions([])
    setShowHist(false)
    setTimeout(() => taRef.current?.focus(), 0)
  }

  // ── Навигация по истории стрелками ─────────────────────────────────────
  const navigateHistory = (dir) => {
    if (history.length === 0) return
    const next = Math.max(-1, Math.min(history.length - 1, histIdx + dir))
    setHistIdx(next)
    setVal(next === -1 ? '' : history[next])
    setCompletions([])
  }

  // ── Клавиатура ─────────────────────────────────────────────────────────
  const onKeyDown = (e) => {
    // Ctrl+H — история
    if (e.ctrlKey && e.key === 'h') {
      e.preventDefault()
      setShowHist(v => !v)
      setHistSearch('')
      if (!showHist) setTimeout(() => histSrchRef.current?.focus(), 50)
      return
    }

    // Отправка
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); return }

    // Escape — очистить
    if (e.key === 'Escape') {
      setVal(''); setHistIdx(-1); setCompletions([])
      setShowHist(false); e.target.blur(); return
    }

    // Tab — completion
    if (e.key === 'Tab') {
      e.preventDefault()
      if (completions.length > 0) {
        // Цикл по вариантам
        const next = e.shiftKey
          ? (compIdx - 1 + completions.length) % completions.length
          : (compIdx + 1) % completions.length
        setCompIdx(next)
      } else {
        triggerCompletion()
      }
      return
    }

    // Enter при открытом completion — выбрать
    if (e.key === 'Enter' && completions.length > 0) {
      e.preventDefault()
      applyCompletion(completions[compIdx])
      return
    }

    // Стрелки — история (только в однострочном режиме без completion)
    if (completions.length === 0 && val.indexOf('\n') === -1) {
      if (e.key === 'ArrowUp'   && !e.shiftKey) { e.preventDefault(); navigateHistory(1); return }
      if (e.key === 'ArrowDown' && !e.shiftKey) { e.preventDefault(); navigateHistory(-1); return }
    }

    // Стрелки в completion popup
    if (completions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setCompIdx(i => (i + 1) % completions.length) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCompIdx(i => (i - 1 + completions.length) % completions.length) }
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 8, padding: '4px 10px',
      borderTop: '1px solid var(--border)', flexShrink: 0,
      background: focused ? 'rgba(37,99,235,0.05)' : 'var(--bg1)',
      position: 'relative',
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: focused ? 'var(--accent)' : 'var(--text3)', whiteSpace: 'nowrap', paddingBottom: 4 }}>
        ⚡ {count} панели
      </span>

      {/* Textarea + completion popup */}
      <div style={{ flex: 1, position: 'relative' }}>
        <textarea
          ref={taRef}
          value={val}
          rows={Math.min(val.split('\n').length, 5) || 1}
          placeholder={host && !host.isLocal ? 'Команда → все панели  (Tab = автодополнение)' : 'Команда → все панели'}
          onChange={(e) => { setVal(e.target.value); setHistIdx(-1); setCompletions([]) }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          style={{
            width: '100%', fontSize: 12, fontFamily: 'var(--font-mono)', padding: '3px 8px',
            borderRadius: 5, outline: 'none', resize: 'none', overflow: 'auto',
            border: `1px solid ${focused ? 'var(--accent)' : 'var(--border2)'}`,
            background: 'var(--bg2)', color: 'var(--text0)', lineHeight: 1.5,
            boxSizing: 'border-box',
          }}
        />

        {/* Tab completion popup */}
        {completions.length > 0 && (
          <div ref={compRef} style={{
            position: 'absolute', bottom: 'calc(100% + 4px)', left: 0,
            background: 'var(--bg1)', border: '1px solid var(--accent)',
            borderRadius: 7, boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            minWidth: 180, zIndex: 2001, padding: '4px 0',
          }}>
            <div style={{ padding: '2px 10px 4px', fontSize: 9, color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
              Tab — следующий · Shift+Tab — пред · Enter — выбрать
            </div>
            {completions.map((cmd, i) => (
              <div
                key={cmd}
                onClick={() => applyCompletion(cmd)}
                style={{
                  padding: '4px 12px', fontSize: 12, fontFamily: 'var(--font-mono)',
                  background: i === compIdx ? 'var(--accent)' : 'transparent',
                  color: i === compIdx ? '#fff' : 'var(--text0)',
                }}
              >{cmd}</div>
            ))}
          </div>
        )}
      </div>

      {/* История */}
      <div ref={histRef} style={{ position: 'relative', flexShrink: 0, marginBottom: 1 }}>
        <button
          onClick={() => { setShowHist(v => !v); setHistSearch(''); setTimeout(() => histSrchRef.current?.focus(), 50) }}
          title={`История команд (${history.length})`}
          style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 5,
            background: showHist ? 'var(--accent)' : 'var(--bg2)',
            color: showHist ? '#fff' : 'var(--text2)',
            border: `1px solid ${showHist ? 'var(--accent)' : 'var(--border2)'}`,
            cursor: 'pointer',
          }}
        >▾ {history.length > 0 && <span style={{ fontSize: 9 }}>{history.length}</span>}</button>

        {showHist && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', right: 0,
            background: 'var(--bg1)', border: '1px solid var(--border2)',
            borderRadius: 7, boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            width: 340, zIndex: 2000,
          }}>
            {/* Поиск */}
            <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
              <input
                ref={histSrchRef}
                value={histSearch}
                onChange={e => setHistSearch(e.target.value)}
                placeholder="Поиск в истории…"
                style={{
                  width: '100%', fontSize: 12, fontFamily: 'var(--font-mono)',
                  padding: '3px 8px', borderRadius: 5, outline: 'none', boxSizing: 'border-box',
                  border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text0)',
                }}
              />
            </div>

            {/* Список */}
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {filteredHistory.length === 0 && (
                <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>
                  {histSearch ? 'Ничего не найдено' : 'История пуста'}
                </div>
              )}
              {filteredHistory.map((cmd) => (
                <div
                  key={cmd}
                  onClick={() => { setVal(cmd); setHistIdx(history.indexOf(cmd)); setShowHist(false); taRef.current?.focus() }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px 5px 14px', cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text0)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cmd}
                  </span>
                  <button
                    onClick={(e) => deleteHistory(cmd, e)}
                    title="Удалить"
                    style={{ flexShrink: 0, fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
                  >✕</button>
                </div>
              ))}
            </div>

            {/* Подвал */}
            {history.length > 0 && (
              <div style={{ padding: '5px 10px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={clearHistory}
                  style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
                >Очистить всё</button>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={send}
        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', marginBottom: 1 }}
      >→ Всем</button>

      {/* Функциональные клавиши — отправляют raw bytes во все панели */}
      {[
        { label: '^C', byte: '\x03', title: 'Ctrl+C — прервать (SIGINT)' },
        { label: '^Z', byte: '\x1a', title: 'Ctrl+Z — приостановить (SIGTSTP)' },
        { label: '^D', byte: '\x04', title: 'Ctrl+D — конец ввода (EOF)' },
        { label: '^L', byte: '\x0c', title: 'Ctrl+L — очистить экран' },
      ].map(({ label, byte, title }) => (
        <button
          key={label}
          onClick={() => onSendRaw?.(byte)}
          title={title}
          style={{
            fontSize: 10, padding: '3px 6px', borderRadius: 4, marginBottom: 1,
            background: 'var(--bg2)', color: 'var(--text2)',
            border: '1px solid var(--border2)', cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.color = 'var(--text0)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.color = 'var(--text2)' }}
        >{label}</button>
      ))}
    </div>
  )
}

// ─── Стабильная обёртка для TerminalPane ─────────────────────────────────────
const PaneTerminal = React.memo(function PaneTerminal({ paneId, pane, termSettings, cbRef }) {
  const onUpdate        = useCallback((p) => cbRef.current.onUpdate(paneId, p),        [paneId, cbRef])
  const onReconnect     = useCallback(()  => cbRef.current.onReconnect(paneId),         [paneId, cbRef])
  const onOpenBrowser   = useCallback((u) => cbRef.current.onOpenBrowser?.(u),          [cbRef])
  const onActivity      = useCallback(()  => cbRef.current.onActivity(paneId),          [paneId, cbRef])
  const onRegisterWriter= useCallback((id, fn) => cbRef.current.onRegisterWriter(id, fn), [cbRef])

  return (
    <TerminalPane
      tab={{ ...pane, id: paneId }}
      termSettings={termSettings}
      onUpdate={onUpdate}
      onReconnect={onReconnect}
      onOpenBrowser={onOpenBrowser}
      onActivity={onActivity}
      onRegisterWriter={onRegisterWriter}
    />
  )
}, (prev, next) =>
  prev.paneId === next.paneId &&
  prev.termSettings === next.termSettings &&
  (prev.pane.reconnectKey ?? 0) === (next.pane.reconnectKey ?? 0)
)

// ─── Main ─────────────────────────────────────────────────────────────────────
const SplitPane = forwardRef(function SplitPane({ tab, termSettings, splitBorderSize = 2, onUpdate, onReconnect, onOpenBrowser, onActivity, showMonitor }, ref) {
  const firstId   = useRef(newId())
  const [layout, setLayout]     = useState(() => ({ type: 'leaf', id: firstId.current }))
  const [panes,  setPanes]      = useState(() => ({ [firstId.current]: { host: tab.host, title: tab.host.host } }))
  const [activeId, setActiveId] = useState(firstId.current)
  const writersRef = useRef({})
  const containerRef = useRef(null)
  const lastTitleRef = useRef(tab.host.host)
  const [hoveredPane, setHoveredPane] = useState(null)

  // cbRef — всегда актуальные коллбэки, без пересоздания функций
  const cbRef = useRef(null)
  cbRef.current = {
    onUpdate:         (paneId, patch) => handlePaneUpdate(paneId, patch),
    onReconnect:      (paneId) => handlePaneReconnect(paneId),
    onOpenBrowser,
    onActivity:       (paneId) => handleActivity(paneId),
    onRegisterWriter: (paneId, fn) => {
      writersRef.current[paneId] = fn
      // Возвращаем функцию отмены — TerminalPane вызовет её при размонтировании
      return () => { delete writersRef.current[paneId] }
    },
  }

  const paneCount = collectIds(layout).length
  const rects = computeRects(layout)
  const splitters = collectSplitters(layout, 0, 0, 100, 100)

  const handleSplit = useCallback((where) => {
    const dirty = insertSplit(layout, activeId, where)
    const newPaneId = findNew(dirty)
    const clean = cleanNew(dirty)
    setLayout(clean)
    if (newPaneId) {
      setPanes((p) => ({
        ...p,
        [newPaneId]: { host: p[activeId]?.host || tab.host, title: (p[activeId]?.host || tab.host).host }
      }))
      setActiveId(newPaneId)
    }
  }, [layout, activeId, tab.host])

  const handleClose = useCallback((paneId) => {
    const ids = collectIds(layout)
    if (ids.length <= 1) return
    const newLayout = removeLeaf(layout, paneId)
    setLayout(newLayout)
    setPanes((p) => { const n = { ...p }; delete n[paneId]; return n })
    if (activeId === paneId) setActiveId(collectIds(newLayout)[0])
    delete writersRef.current[paneId]
    window.api.pty.kill(paneId).catch?.(() => {})
  }, [layout, activeId])

  const handleRatio = useCallback((node, ratio) => {
    setLayout((prev) => updateRatioNode(prev, node.a.id, node.b.id, ratio))
  }, [])

  function updateRatioNode(n, aid, bid, ratio) {
    if (n.type === 'leaf') return n
    if (n.a.id === aid && n.b.id === bid) return { ...n, ratio }
    // для split-нод сравниваем по id первых листов
    const aIds = collectIds(n.a), bIds = collectIds(n.b)
    if (aIds.includes(aid) && bIds.includes(bid)) return { ...n, ratio }
    return { ...n, a: updateRatioNode(n.a, aid, bid, ratio), b: updateRatioNode(n.b, aid, bid, ratio) }
  }

  const handlePaneUpdate = useCallback((paneId, patch) => {
    setPanes((prev) => ({ ...prev, [paneId]: { ...prev[paneId], ...patch } }))
    if (paneId === activeId) {
      if (patch.title) { lastTitleRef.current = patch.title; onUpdate({ title: patch.title }) }
      if (patch.status) onUpdate({ status: patch.status })
    }
  }, [activeId, onUpdate])

  const handlePaneReconnect = useCallback((paneId) => {
    setPanes((prev) => ({
      ...prev,
      [paneId]: { ...prev[paneId], reconnectKey: (prev[paneId]?.reconnectKey || 0) + 1 }
    }))
  }, [])

  const handleActivity = useCallback((paneId) => {
    onActivity?.()
    if (paneId !== activeId) {
      setPanes((prev) => ({ ...prev, [paneId]: { ...prev[paneId], hasActivity: true } }))
    }
  }, [activeId, onActivity])

  const handleActivate = useCallback((paneId) => {
    setActiveId(paneId)
    setPanes((prev) => ({ ...prev, [paneId]: { ...prev[paneId], hasActivity: false } }))
    const title = panes[paneId]?.title
    if (title) { lastTitleRef.current = title; onUpdate({ title }) }
  }, [panes, onUpdate])

  const handleBroadcast = useCallback((line) => {
    Object.values(writersRef.current).forEach((fn) => { try { fn(line) } catch {} })
  }, [])

  const handleBroadcastRaw = useCallback((bytes) => {
    Object.values(writersRef.current).forEach((fn) => { try { fn(bytes) } catch {} })
  }, [])

  // Отправка только в активную панель (для быстрых команд)
  const handleSendToActive = useCallback((line) => {
    try { writersRef.current[activeId]?.(line) } catch {}
  }, [activeId])

  useImperativeHandle(ref, () => ({
    splitWith: (host, where) => handleSplit(where)
      // handleSplit uses activeId's host — override for external call
  }), [handleSplit])

  // Override splitWith to use passed host
  useImperativeHandle(ref, () => ({
    splitWith: (host, where) => {
      const dirty = insertSplit(layout, activeId, where)
      const newPaneId = findNew(dirty)
      const clean = cleanNew(dirty)
      setLayout(clean)
      if (newPaneId) {
        setPanes((p) => ({ ...p, [newPaneId]: { host, title: host.host } }))
        setActiveId(newPaneId)
      }
    }
  }), [layout, activeId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Основная область — все панели абсолютно позиционированы */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Рендерим все панели параллельно — без вложенности в layout дерево */}
        {Object.entries(panes).map(([paneId, pane]) => {
          const rect = rects.get(paneId)
          if (!rect) return null
          const isActive = paneId === activeId
          return (
            <div
              key={paneId}
              onClick={() => handleActivate(paneId)}
              onMouseEnter={() => setHoveredPane(paneId)}
              onMouseLeave={() => setHoveredPane(null)}
              style={{
                position: 'absolute',
                left:   `${rect.left}%`,
                top:    `${rect.top}%`,
                width:  `${rect.width}%`,
                height: `${rect.height}%`,
                boxSizing: 'border-box',
                boxShadow: isActive && paneCount > 1 ? 'inset 0 0 0 1px var(--accent)' : 'none',
              }}
            >
              <PaneTerminal
                paneId={paneId}
                pane={pane}
                termSettings={termSettings}
                cbRef={cbRef}
              />
              {/* Крестик закрытия — только если панелей > 1 */}
              {paneCount > 1 && hoveredPane === paneId && (
                <div
                  onClick={(e) => { e.stopPropagation(); handleClose(paneId) }}
                  title="Закрыть панель"
                  style={{
                    position: 'absolute', top: 4, right: 4, zIndex: 20,
                    width: 18, height: 18, borderRadius: 4,
                    background: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 11, color: '#fff', lineHeight: 1,
                    transition: 'background .1s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220,38,38,0.85)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.55)'}
                >✕</div>
              )}
            </div>
          )
        })}

        {/* Сплиттеры поверх */}
        {splitters.map((s) => (
          <Splitter key={s.id} splitter={s} size={splitBorderSize} onRatio={handleRatio} containerRef={containerRef} />
        ))}
      </div>

      <QuickCommandsBar onSend={handleSendToActive} />
      <BroadcastBar count={paneCount} onSend={handleBroadcast} onSendRaw={handleBroadcastRaw} host={tab.host} />

      {/* Панель мониторинга — контекст активной панели в сплите */}
      {showMonitor && (() => {
        const activeHost = panes[activeId]?.host
        if (!activeHost || activeHost.isLocal) return null
        return <HostMonitorBar tabId={activeId} host={activeHost} />
      })()}
    </div>
  )
})

export default SplitPane
