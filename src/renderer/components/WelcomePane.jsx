import React, { useState, useEffect, useRef } from 'react'

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60)    return 'только что'
  if (s < 3600)  return `${Math.floor(s / 60)} мин назад`
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`
  return `${Math.floor(s / 86400)} д назад`
}

const COLORS = ['#2563eb','#7c3aed','#16a34a','#d97706','#dc2626','#0891b2','#be185d']
function autoColor(name) {
  let n = 0
  for (const c of name) n = (n * 31 + c.charCodeAt(0)) & 0xffff
  return COLORS[n % COLORS.length]
}

function HostCard({ entry, host, badge, onOpen, onContextMenu }) {
  const color = autoColor(entry.host)
  const alive = !!host
  return (
    <div
      onClick={() => alive && onOpen(host, 'terminal')}
      onContextMenu={(e) => { e.preventDefault(); if (alive) onContextMenu(e, host) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 10px', borderRadius: 8,
        background: 'var(--bg1)', border: '1px solid var(--border)',
        cursor: alive ? 'pointer' : 'default',
        transition: 'border-color .12s, background .12s',
      }}
      onMouseEnter={(e) => { if (!alive) return; e.currentTarget.style.background='var(--bg2)'; e.currentTarget.style.borderColor='var(--border2)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background='var(--bg1)'; e.currentTarget.style.borderColor='var(--border)' }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 7, flexShrink: 0,
        background: color + '18', border: `1px solid ${color}35`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color, fontFamily: 'var(--font-mono)',
      }}>
        {entry.host.slice(0, 2).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 400, color: alive ? 'var(--text0)' : 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.host}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.user ? `${entry.user}@` : ''}{entry.hostname || entry.host}
          {entry.port && entry.port !== 22 ? `:${entry.port}` : ''}
        </div>
      </div>
      {badge && <div style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{badge}</div>}
      {alive && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(host, 'terminal') }}
          style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}
        >→</button>
      )}
    </div>
  )
}

function HostCtxMenu({ x, y, host, isFavorite, onOpen, onToggleFavorite, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: -999, top: -999 })

  useEffect(() => {
    const dismiss = () => onClose()
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
  }, [])

  useEffect(() => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({
      left: Math.min(x, window.innerWidth  - r.width  - 6),
      top:  Math.min(y, window.innerHeight - r.height - 6),
    })
  }, [x, y])

  return (
    <div ref={ref} onMouseDown={(e) => e.stopPropagation()} style={{
      position: 'fixed', left: pos.left, top: pos.top, zIndex: 2000,
      background: 'var(--bg1)', border: '1px solid var(--border2)',
      borderRadius: 8, padding: '4px 0', minWidth: 200,
      boxShadow: '0 4px 20px rgba(0,0,0,.14)',
    }}>
      <MI onClick={() => onOpen(host, 'terminal')}>⌨  Открыть терминал</MI>
      <MI onClick={() => onOpen(host, 'sftp')}>📁  Открыть SFTP</MI>
      <MI onClick={() => onOpen(host, 'tunnel')}>🔌  Туннели</MI>
      <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
      <MI onClick={onToggleFavorite}>
        {isFavorite ? '⭐ Убрать из избранного' : '☆  Добавить в избранное'}
      </MI>
    </div>
  )
}

function MI({ children, onClick }) {
  return (
    <div onClick={onClick} style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text0)' }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg2)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >{children}</div>
  )
}

export default function WelcomePane({ hosts, history, favorites, onOpen, onOpenSettings, onToggleFavorite, historyLimit = 5 }) {
  const [ctxMenu, setCtxMenu] = useState(null)

  const handleCtx = (e, host) => {
    const isFav = !!(favorites?.find((f) => f.host === host.host))
    setCtxMenu({ x: e.clientX, y: e.clientY, host, isFavorite: isFav })
  }

  const hasFav = favorites && favorites.length > 0
  const recentEntries = history.slice(0, historyLimit)

  return (
    <div
      style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 28px', gap: 24, background: 'var(--bg0)' }}
      onClick={() => setCtxMenu(null)}
    >
      {/* Лого */}
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, margin: '0 auto 10px', background: 'linear-gradient(135deg, var(--accent), #7c3aed)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: -1 }}>ASM</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text0)' }}>Absolute Session Manager</div>
        <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text2)' }}>Клик для подключения · ПКМ для меню</div>
      </div>

      {/* Две колонки */}
      <div style={{
        width: '100%', maxWidth: 860,
        display: 'grid',
        gridTemplateColumns: hasFav && recentEntries.length > 0 ? '1fr 1fr' : '1fr',
        gap: 20, alignItems: 'start',
      }}>
        {/* Избранное */}
        <div>
          <SectionTitle>⭐ Избранное</SectionTitle>
          {hasFav ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {favorites.map((entry) => {
                const host = hosts.find((h) => h.host === entry.host)
                return <HostCard key={entry.host} entry={host || entry} host={host} onOpen={onOpen} onContextMenu={handleCtx} />
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text3)', padding: '10px 0' }}>
              Добавьте хосты через ПКМ в сайдбаре или здесь
            </div>
          )}
        </div>

        {/* Последние */}
        {recentEntries.length > 0 && (
          <div>
            <SectionTitle>Последние сессии</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentEntries.map((entry) => {
                const host = hosts.find((h) => h.host === entry.host)
                return <HostCard key={entry.host + entry.ts} entry={host || entry} host={host} badge={timeAgo(entry.ts)} onOpen={onOpen} onContextMenu={handleCtx} />
              })}
            </div>
          </div>
        )}
      </div>

      {/* Подвал */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          Читает <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>~/.ssh/config</span> включая Include
        </div>
        <button onClick={onOpenSettings} style={{
          fontSize: 11, color: 'var(--text3)', padding: '4px 10px',
          borderRadius: 5, border: '1px solid var(--border2)', background: 'transparent', cursor: 'pointer',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.color='var(--accent)'; e.currentTarget.style.borderColor='var(--accent)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color='var(--text3)'; e.currentTarget.style.borderColor='var(--border2)' }}
        >⚙ Настройки</button>
      </div>

      {ctxMenu && (
        <HostCtxMenu
          x={ctxMenu.x} y={ctxMenu.y}
          host={ctxMenu.host}
          isFavorite={ctxMenu.isFavorite}
          onOpen={(h, type) => { onOpen(h, type); setCtxMenu(null) }}
          onToggleFavorite={() => { onToggleFavorite?.(ctxMenu.host); setCtxMenu(null) }}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginBottom: 8 }}>
      {children}
    </div>
  )
}
