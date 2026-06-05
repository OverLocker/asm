import React, { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'
import TerminalPane from './TerminalPane'

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
function BroadcastBar({ count, onSend }) {
  const [val, setVal]           = useState("")
  const [focused, setFocused]   = useState(false)
  const [history, setHistory]   = useState([])
  const [histIdx, setHistIdx]   = useState(-1)
  const [showHist, setShowHist] = useState(false)
  const taRef   = useRef(null)
  const histRef = useRef(null)

  // Закрывать список при клике снаружи
  // useEffect ОБЯЗАН быть до любого return — правило хуков
  useEffect(() => {
    if (!showHist) return
    const close = (e) => {
      if (!histRef.current?.contains(e.target)) setShowHist(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showHist])

  // Ранний выход ТОЛЬКО после всех хуков
  if (count < 2) return null

  const send = () => {
    const trimmed = val.trim()
    if (!trimmed) return
    trimmed.split("\n").forEach((line, i) => {
      setTimeout(() => onSend(line + "\n"), i * 10)
    })
    // Сохранить в историю (дедупликация, последнее наверху, макс. 50)
    setHistory((h) => {
      const next = [trimmed, ...h.filter((x) => x !== trimmed)].slice(0, 50)
      return next
    })
    setVal("")
    setHistIdx(-1)
    setShowHist(false)
    setTimeout(() => taRef.current?.focus(), 0)
  }

  const navigateHistory = (dir) => {
    setHistory((h) => {
      if (h.length === 0) return h
      const next = histIdx + dir
      if (next < -1) return h
      if (next >= h.length) return h
      setHistIdx(next)
      setVal(next === -1 ? "" : h[next])
      return h
    })
  }

  return (
    <div style={{
      display: "flex", alignItems: "flex-end", gap: 8, padding: "4px 10px",
      borderTop: "1px solid var(--border)", flexShrink: 0,
      background: focused ? "rgba(37,99,235,0.05)" : "var(--bg1)",
      position: "relative",
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: focused ? "var(--accent)" : "var(--text3)", whiteSpace: "nowrap", paddingBottom: 4 }}>
        ⚡ {count} панели
      </span>
      <textarea
        ref={taRef}
        value={val}
        rows={Math.min(val.split("\n").length, 5) || 1}
        placeholder="Команда → все панели  (Enter · Shift+Enter = новая строка)"
        onChange={(e) => { setVal(e.target.value); setHistIdx(-1) }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
          if (e.key === "Escape") { setVal(""); setHistIdx(-1); e.target.blur(); setShowHist(false) }
          // Стрелки — навигация по истории (только в однострочном режиме)
          if (e.key === "ArrowUp"   && !e.shiftKey && val.indexOf("\n") === -1) { e.preventDefault(); navigateHistory(1) }
          if (e.key === "ArrowDown" && !e.shiftKey && val.indexOf("\n") === -1) { e.preventDefault(); navigateHistory(-1) }
        }}
        style={{
          flex: 1, fontSize: 12, fontFamily: "var(--font-mono)", padding: "3px 8px",
          borderRadius: 5, outline: "none", resize: "none", overflow: "auto",
          border: `1px solid ${focused ? "var(--accent)" : "var(--border2)"}`,
          background: "var(--bg2)", color: "var(--text0)", lineHeight: 1.5,
        }}
      />
      {/* Кнопка истории */}
      {history.length > 0 && (
        <div ref={histRef} style={{ position: "relative", flexShrink: 0, marginBottom: 1 }}>
          <button
            onClick={() => setShowHist((v) => !v)}
            title="История команд"
            style={{
              fontSize: 11, padding: "3px 8px", borderRadius: 5,
              background: showHist ? "var(--accent)" : "var(--bg2)",
              color: showHist ? "#fff" : "var(--text2)",
              border: `1px solid ${showHist ? "var(--accent)" : "var(--border2)"}`,
              cursor: "pointer",
            }}
          >▾</button>
          {showHist && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 6px)", right: 0,
              background: "var(--bg1)", border: "1px solid var(--border2)",
              borderRadius: 7, boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
              minWidth: 260, maxWidth: 480, maxHeight: 220, overflowY: "auto",
              zIndex: 2000, padding: "4px 0",
            }}>
              {history.map((cmd, i) => (
                <div
                  key={i}
                  onClick={() => { setVal(cmd); setHistIdx(i); setShowHist(false); taRef.current?.focus() }}
                  style={{
                    padding: "5px 14px", fontSize: 12, fontFamily: "var(--font-mono)",
                    color: "var(--text0)", cursor: "pointer", whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg2)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >{cmd}</div>
              ))}
            </div>
          )}
        </div>
      )}
      <button onClick={send}
        style={{ fontSize: 11, padding: "3px 10px", borderRadius: 5, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", marginBottom: 1 }}
      >→ Всем</button>
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
const SplitPane = forwardRef(function SplitPane({ tab, termSettings, splitBorderSize = 2, onUpdate, onReconnect, onOpenBrowser, onActivity }, ref) {
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

      <BroadcastBar count={paneCount} onSend={handleBroadcast} />
    </div>
  )
})

export default SplitPane
