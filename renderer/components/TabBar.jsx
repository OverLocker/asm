import React, { useState, useEffect, useRef, useCallback } from 'react'
import './TabBar.css'

const TYPE_ICON = {
  terminal: '',
  sftp:     '📁',
  tunnel:   '🔌',
  browser:  '🌐',
  editor:   '📝',
  'sftp-commander': '',
}

const STATUS_COLOR = {
  connecting: 'var(--amber)',
  connected:  'var(--green)',
  error:      'var(--red)',
  closed:     'var(--text3)',
}

const TAB_COLORS = [
  { label: 'Серый',       value: null },
  { label: 'Зелёный',     value: '#16a34a' },
  { label: 'Синий',       value: '#2563eb' },
  { label: 'Фиолетовый',  value: '#7c3aed' },
  { label: 'Оранжевый',   value: '#d97706' },
  { label: 'Красный',     value: '#dc2626' },
  { label: 'Розовый',     value: '#db2777' },
  { label: 'Голубой',     value: '#0891b2' },
]

function TabBar({
  onOpenSftpCommander, tabs, activeTab, onSelect, onClose, onOpenSettings, onOpenTunnels,
  activeTunnelCount, onOpenLocalTerminal, onSetTabColor, onGoHome, x11, onToggleX11,
  monitor, onToggleMonitor,
}) {
  const [ctxMenu, setCtxMenu] = useState(null)
  const tabsContainerRef = useRef(null)
  const [canScrollLeft,  setCanScrollLeft]  = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const tabScale    = tabs.length <= 6  ? 1.0 : tabs.length <= 10 ? 0.85 : tabs.length <= 16 ? 0.72 : 0.62
  const tabFontSize = Math.round(12 * tabScale)
  const tabMaxWidth = Math.round(130 * tabScale)
  const tabPadding  = tabScale < 0.8 ? '0 6px' : '0 12px'

  const checkScroll = useCallback(() => {
    const el = tabsContainerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = tabsContainerRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll)
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [tabs.length, checkScroll])

  const scrollTabs = (dir) => {
    const el = tabsContainerRef.current
    if (el) el.scrollBy({ left: dir * 120, behavior: 'smooth' })
  }

  useEffect(() => {
    const el = tabsContainerRef.current
    if (!el) return
    const onWheel = (e) => {
      if (e.deltaY === 0) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    if (!ctxMenu) return
    const dismiss = () => setCtxMenu(null)
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
  }, [ctxMenu])

  return (
    <div className="tb-root">
      {/* Кнопка домой */}
      <button className="tb-btn tb-home" onClick={onGoHome} title="Домашний экран">⌂</button>

      {/* Стрелка влево */}
      {canScrollLeft && (
        <button className="tb-arrow tb-arrow-left" onClick={() => scrollTabs(-1)}>‹</button>
      )}

      <div ref={tabsContainerRef} className="tb-tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <div
              key={tab.id}
              className={`tb-tab${isActive ? ' tb-tab-active' : ''}`}
              onClick={() => onSelect(tab.id)}
              onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ tabId: tab.id, x: e.clientX, y: e.clientY }) }}
              style={{
                gap: tabScale < 0.8 ? 3 : 6,
                padding: tabPadding,
                background: isActive ? 'var(--bg0)' : 'transparent',
                color:      isActive ? 'var(--text0)' : 'var(--text2)',
                fontSize:   tabFontSize,
              }}
            >
              {/* Акцентная полоска */}
              {isActive && (
                <div className="tb-tab-accent" style={{ background: tab.color || 'var(--accent)' }} />
              )}
              <span style={{ fontSize: tabFontSize }}>{TYPE_ICON[tab.type]}</span>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: tab.color || STATUS_COLOR[tab.status] || 'var(--text3)',
                boxShadow: tab.color ? `0 0 4px ${tab.color}88` : 'none',
                transition: 'background .2s',
              }} />
              {tab.hasActivity && !isActive && tabScale >= 0.72 && (
                <span style={{
                  width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                  background: tab.activityColor || '#f0a844',
                  animation: 'tabPulse 1s ease-in-out infinite',
                }} />
              )}
              <span style={{ maxWidth: tabMaxWidth, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tab.title}
              </span>
              {/* ✅ CSS hover вместо onMouseEnter/Leave */}
              <button className="tb-close" onClick={(e) => { e.stopPropagation(); onClose(tab.id) }}>×</button>
            </div>
          )
        })}
      </div>

      {/* Стрелка вправо */}
      {canScrollRight && (
        <button className="tb-arrow tb-arrow-right" onClick={() => scrollTabs(1)}>›</button>
      )}

      {/* ✅ Все кнопки справа — hover через CSS */}
      <button className="tb-btn tb-plus" onClick={onOpenLocalTerminal} title="Открыть локальный терминал">+</button>

      {onToggleX11 && (
        <button
          className="tb-x11"
          onClick={onToggleX11}
          title={x11 ? 'X11 Forwarding включён' : 'X11 Forwarding выключен'}
          style={{
            color:      x11 ? 'var(--accent)' : 'var(--text3)',
            background: x11 ? 'rgba(37,99,235,0.08)' : 'transparent',
          }}
        >
          {x11 ? '✦X11' : 'X11'}
        </button>
      )}

      {onToggleMonitor && (
        <button
          className="tb-x11"
          onClick={onToggleMonitor}
          title={monitor ? 'Мониторинг хоста включён' : 'Мониторинг хоста выключен'}
          style={{
            color:      monitor ? 'var(--green)' : 'var(--text3)',
            background: monitor ? 'rgba(22,163,74,0.08)' : 'transparent',
          }}
        >
          {monitor ? '✦MON' : 'MON'}
        </button>
      )}

      {onOpenSftpCommander && (
        <button className="tb-btn tb-sftp" onClick={() => onOpenSftpCommander()} title="SFTP Commander">⇄</button>
      )}

      <button
        className="tb-tunnels"
        onClick={onOpenTunnels}
        title="Глобальные туннели"
        style={{ color: activeTunnelCount > 0 ? 'var(--green)' : 'var(--text3)' }}
      >
        🔌{activeTunnelCount > 0 && <span style={{ fontSize: 9, fontWeight: 700 }}>{activeTunnelCount}</span>}
      </button>

      <button className="tb-btn tb-settings" onClick={onOpenSettings} title="Настройки">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>

      {ctxMenu && (
        <TabContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          tab={tabs.find((t) => t.id === ctxMenu.tabId)}
          onSetColor={(color) => { onSetTabColor(ctxMenu.tabId, color); setCtxMenu(null) }}
          onClose={() => { onClose(ctxMenu.tabId); setCtxMenu(null) }}
          onDismiss={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}

function TabContextMenu({ x, y, tab, onSetColor, onClose, onDismiss }) {
  const menuRef = useRef(null)
  const left = Math.min(x, window.innerWidth  - 200)
  const top  = Math.min(y, window.innerHeight - 160)
  const [pos] = useState({ left, top })

  if (!tab) return null

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed', left: pos.left, top: pos.top, zIndex: 2000,
        background: 'var(--bg1)', border: '1px solid var(--border2)',
        borderRadius: 8, padding: '6px 0', minWidth: 180,
        boxShadow: '0 4px 20px rgba(0,0,0,.12)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={{ padding: '4px 12px 6px', fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>
        Цвет вкладки
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 12px 8px' }}>
        {TAB_COLORS.map((c) => (
          <button
            key={c.label}
            onClick={() => onSetColor(c.value)}
            title={c.label}
            style={{
              width: 18, height: 18, borderRadius: '50%', cursor: 'pointer',
              background: c.value || 'var(--bg4)',
              border: tab.color === c.value ? '2px solid var(--text0)' : '2px solid transparent',
            }}
          />
        ))}
      </div>
      <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
      {/* ✅ CSS hover вместо onMouseEnter/Leave */}
      <div className="tb-ctx-action" style={{ color: 'var(--red)' }} onClick={onClose}>✕ Закрыть вкладку</div>
    </div>
  )
}

export default React.memo(TabBar, (prevProps, nextProps) => {
  // Custom comparison для оптимизированного re-rendering
  if (prevProps.activeTab !== nextProps.activeTab) return false
  if (prevProps.tabs.length !== nextProps.tabs.length) return false
  if (prevProps.activeTunnelCount !== nextProps.activeTunnelCount) return false
  if (prevProps.x11 !== nextProps.x11) return false
  if (prevProps.monitor !== nextProps.monitor) return false
  // Если всё то же — не перерендериваем
  return true
})
