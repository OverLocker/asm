import React, { useState, useRef, useEffect } from 'react'

function fmtBytes(b) {
  if (!b) return '0B'
  if (b < 1024) return `${b}B`
  if (b < 1048576) return `${(b/1024).toFixed(1)}K`
  if (b < 1073741824) return `${(b/1048576).toFixed(1)}M`
  return `${(b/1073741824).toFixed(1)}G`
}

export default function ActiveTunnels({ autoTunnels, tabs, onStop, onOpenBrowser }) {
  const entries = Object.entries(autoTunnels).flatMap(([tabId, tunnels]) => {
    const tab = tabs.find((t) => t.id === tabId)
    return tunnels.map((t) => ({ ...t, tabId, tabTitle: tab?.title || tabId }))
  })

  const [stats, setStats] = useState({})

  // Polling статистики раз в 2 секунды пока есть туннели
  useEffect(() => {
    if (entries.length === 0) return
    const poll = async () => {
      try { setStats(await window.api.tunnel.stats()) } catch {}
    }
    poll()
    const iv = setInterval(poll, 2000)
    return () => clearInterval(iv)
  }, [entries.length])

  // ─── Перемещение окна ────────────────────────────────────────────────────
  const [pos, setPos]       = useState(null) // null = дефолт (правый нижний угол)
  const [collapsed, setCollapsed] = useState(true)
  const dragRef   = useRef(false)
  const offsetRef = useRef({ x: 0, y: 0 })
  const panelRef  = useRef(null)

  const onMouseDown = (e) => {
    // Только левая кнопка, только за заголовок
    if (e.button !== 0) return
    dragRef.current = true
    const rect = panelRef.current.getBoundingClientRect()
    offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    e.preventDefault()

    const onMove = (e) => {
      if (!dragRef.current) return
      const x = Math.max(0, Math.min(window.innerWidth  - rect.width,  e.clientX - offsetRef.current.x))
      const y = Math.max(0, Math.min(window.innerHeight - rect.height, e.clientY - offsetRef.current.y))
      setPos({ x, y })
    }
    const onUp = () => {
      dragRef.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }

  if (entries.length === 0) return null

  const style = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, zIndex: 500 }
    : { position: 'fixed', bottom: 16, right: 16, zIndex: 500 }

  return (
    <div ref={panelRef} style={{
      ...style,
      background: 'var(--bg1)', border: '1px solid var(--border2)',
      borderRadius: 10, minWidth: 280, maxWidth: 360,
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      userSelect: 'none',
    }}>
      {/* Заголовок — за него тащим */}
      <div
        onMouseDown={onMouseDown}
        onDoubleClick={() => setCollapsed((c) => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 10px',
          borderBottom: collapsed ? 'none' : '1px solid var(--border)',
          cursor: 'grab',
          borderRadius: collapsed ? 10 : '10px 10px 0 0',
        }}
      >
        <span style={{ fontSize: 12 }}>🔌</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', flex: 1, letterSpacing: '.3px' }}>
          Активные туннели
          <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: 5 }}>({entries.length})</span>
        </span>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setCollapsed((c) => !c)}
          style={{ fontSize: 11, color: 'var(--text3)', padding: '1px 5px', borderRadius: 3 }}
          title={collapsed ? 'Развернуть' : 'Свернуть'}
        >{collapsed ? '▲' : '▼'}</button>
      </div>

      {/* Список туннелей */}
      {!collapsed && (
        <div style={{ padding: '6px 10px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {entries.map(({ tid, rule, info, tabTitle }) => {
            const isSocks = rule.direction === 'socks'
            const isLocal = rule.direction === 'local'
            const httpUrl = isLocal ? `http://localhost:${rule.localPort}` : null

            return (
              <div key={tid} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px', borderRadius: 6,
                background: 'var(--bg2)',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rule.name || info}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                    {tabTitle} · {info}
                  </div>
                  {stats[tid] && (stats[tid].bytesIn > 0 || stats[tid].bytesOut > 0) && (
                    <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginTop: 1, display: 'flex', gap: 6 }}>
                      <span title="Получено">↓{fmtBytes(stats[tid].bytesIn)}</span>
                      <span title="Отправлено">↑{fmtBytes(stats[tid].bytesOut)}</span>
                      {stats[tid].connections > 0 && <span title="Соединений">{stats[tid].connections}conn</span>}
                    </div>
                  )}
                </div>

                {httpUrl && (
                  <button
                    onClick={() => onOpenBrowser(httpUrl)}
                    title={`Открыть в браузере: ${httpUrl}`}
                    style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 5,
                      background: 'var(--accent)', color: '#fff',
                      border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--font-mono)', flexShrink: 0,
                      fontWeight: 600, transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >🌐 :{rule.localPort}</button>
                )}
                {isSocks && (
                  <span style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4,
                    background: 'rgba(124,58,237,0.1)', color: 'var(--accent2)',
                    border: '1px solid rgba(124,58,237,0.2)',
                    fontFamily: 'var(--font-mono)', flexShrink: 0,
                  }}>SOCKS :{rule.localPort}</span>
                )}

                <button
                  onClick={() => onStop(tid)}
                  style={{ color: 'var(--text3)', fontSize: 13, padding: '0 2px', flexShrink: 0 }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--red)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text3)'}
                >×</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
