import React, { useState, useEffect, useRef, useCallback } from 'react'

const TYPE_ICON = {
  terminal: '',            // нет иконки — экономим место
  sftp:     '📁',
  tunnel:   '🔌',
  browser:  '🌐',
  editor:   '📝',
  'sftp-commander': '',   // нет иконки у вкладки — кнопка ⇄ уже есть в toolbar
}

const STATUS_COLOR = {
  connecting: 'var(--amber)',
  connected:  'var(--green)',
  error:      'var(--red)',
  closed:     'var(--text3)',
}

// Цвета для шарика сессии
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

export default function TabBar({
  onOpenSftpCommander, tabs, activeTab, onSelect, onClose, onOpenSettings, onOpenTunnels, activeTunnelCount, onOpenLocalTerminal, onSetTabColor, onGoHome,
  x11, onToggleX11,
}) {
  const [ctxMenu, setCtxMenu] = useState(null) // { tabId, x, y }
  const tabsContainerRef = useRef(null)
  const [canScrollLeft,  setCanScrollLeft]  = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Адаптивный размер вкладок в зависимости от их количества
  const tabScale = tabs.length <= 6  ? 1.0
                 : tabs.length <= 10 ? 0.85
                 : tabs.length <= 16 ? 0.72
                 : 0.62
  const tabFontSize = Math.round(12 * tabScale)
  const tabMaxWidth = Math.round(130 * tabScale)
  const tabPadding  = tabScale < 0.8 ? '0 6px' : '0 12px'

  // Проверяем можно ли скроллить влево/вправо
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

  // Горизонтальный скролл колесом мыши на контейнере вкладок
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

  // Закрыть меню по клику вне
  useEffect(() => {
    if (!ctxMenu) return
    const dismiss = () => setCtxMenu(null)
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
  }, [ctxMenu])

  return (
    <div style={{
      display:       'flex',
      alignItems:    'center',
      background:    'var(--bg1)',
      borderBottom:  '1px solid var(--border)',
      flexShrink:    0,
      height:        30,
      minWidth:      0,
    }}>
      {/* Кнопка домой */}
      <button
        onClick={onGoHome}
        title="Домашний экран"
        style={{
          height: '100%', padding: '0 9px', flexShrink: 0,
          borderRight: '1px solid var(--border)',
          color: 'var(--text3)', fontSize: 13,
          display: 'flex', alignItems: 'center',
          transition: 'color .1s, background .1s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent' }}
      >⌂</button>

      {/* Стрелка влево */}
      {canScrollLeft && (
        <button
          onClick={() => scrollTabs(-1)}
          style={{
            height: '100%', padding: '0 6px', flexShrink: 0,
            background: 'linear-gradient(to right, var(--bg1), transparent)',
            color: 'var(--text2)', fontSize: 14, borderRight: '1px solid var(--border)',
            cursor: 'pointer',
          }}
        >‹</button>
      )}

      <div
        ref={tabsContainerRef}
        style={{
          display: 'flex', alignItems: 'center',
          flex: 1, overflowX: 'auto', height: '100%',
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ tabId: tab.id, x: e.clientX, y: e.clientY }) }}
            style={{
              display: 'flex', alignItems: 'center', gap: tabScale < 0.8 ? 3 : 6,
              padding: tabPadding, height: '100%', cursor: 'pointer',
              borderRight: '1px solid var(--border)',
              background:  tab.id === activeTab ? 'var(--bg0)' : 'transparent',
              color:       tab.id === activeTab ? 'var(--text0)' : 'var(--text2)',
              fontSize: tabFontSize, whiteSpace: 'nowrap', flexShrink: 0,
              position: 'relative', transition: 'background .1s, color .1s',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => { if (tab.id !== activeTab) e.currentTarget.style.background = 'var(--bg2)' }}
            onMouseLeave={(e) => { if (tab.id !== activeTab) e.currentTarget.style.background = 'transparent' }}
          >
            {/* Акцентная полоска */}
            {tab.id === activeTab && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: tab.color || 'var(--accent)' }} />
            )}

            <span style={{ fontSize: tabFontSize }}>{TYPE_ICON[tab.type]}</span>

            {/* Статусный шарик — цвет из tab.color если задан */}
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: tab.color || STATUS_COLOR[tab.status] || 'var(--text3)',
              boxShadow: tab.color ? `0 0 4px ${tab.color}88` : 'none',
              transition: 'background .2s',
            }} />

            {/* Шарик активности — скрываем при сильном сжатии */}
            {tab.hasActivity && tab.id !== activeTab && tabScale >= 0.72 && (
              <span style={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                background: tab.activityColor || '#f0a844',
                animation: 'tabPulse 1s ease-in-out infinite',
              }} />
            )}

            <span style={{ maxWidth: tabMaxWidth, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tab.title}
            </span>

            <button
              onClick={(e) => { e.stopPropagation(); onClose(tab.id) }}
              style={{ color: 'var(--text3)', fontSize: 14, lineHeight: 1, padding: '0 2px', borderRadius: 3, marginLeft: 2 }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--red)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text3)'}
            >×</button>
          </div>
        ))}
      </div>

      {/* Стрелка вправо */}
      {canScrollRight && (
        <button
          onClick={() => scrollTabs(1)}
          style={{
            height: '100%', padding: '0 6px', flexShrink: 0,
            background: 'linear-gradient(to left, var(--bg1), transparent)',
            color: 'var(--text2)', fontSize: 14, borderLeft: '1px solid var(--border)',
            cursor: 'pointer',
          }}
        >›</button>
      )}

      {/* Кнопка + локальный терминал */}
      <button
        onClick={onOpenLocalTerminal}
        title="Открыть локальный терминал"
        style={{
          height: '100%', padding: '0 10px',
          borderLeft: '1px solid var(--border)',
          color: 'var(--text3)', fontSize: 16, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          transition: 'color .1s, background .1s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent' }}
      >+</button>

      {/* Кнопка X11 Forwarding */}
      {onToggleX11 && (
        <button
          onClick={onToggleX11}
          title={x11 ? 'X11 Forwarding включён' : 'X11 Forwarding выключен'}
          style={{
            height: '100%', padding: '0 8px',
            borderLeft: '1px solid var(--border)',
            color: x11 ? 'var(--accent)' : 'var(--text3)',
            fontSize: 10, fontWeight: 700, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 2,
            fontFamily: 'var(--font-mono)',
            background: x11 ? 'rgba(37,99,235,0.08)' : 'transparent',
            transition: 'color .1s, background .1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg2)' }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = x11 ? 'var(--accent)' : 'var(--text3)'
            e.currentTarget.style.background = x11 ? 'rgba(37,99,235,0.08)' : 'transparent'
          }}
        >
          {x11 ? '✦X11' : 'X11'}
        </button>
      )}

      {/* Кнопка SFTP Commander */}
      {onOpenSftpCommander && (
        <button
          onClick={() => onOpenSftpCommander()}
          title="SFTP Commander"
          style={{
            height: '100%', padding: '0 8px',
            borderLeft: '1px solid var(--border)',
            color: 'var(--text3)', fontSize: 13, flexShrink: 0,
            display: 'flex', alignItems: 'center',
            transition: 'color .1s, background .1s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent' }}
        >⇄</button>
      )}

      {/* Кнопка туннелей */}
      <button
        onClick={onOpenTunnels}
        title="Глобальные туннели"
        style={{
          height: '100%', padding: '0 9px',
          borderLeft: '1px solid var(--border)',
          color: activeTunnelCount > 0 ? 'var(--green)' : 'var(--text3)',
          fontSize: 12, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 3,
          transition: 'color .1s, background .1s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        🔌{activeTunnelCount > 0 && <span style={{ fontSize: 9, fontWeight: 700 }}>{activeTunnelCount}</span>}
      </button>

      {/* Кнопка настроек */}
      <button
        onClick={onOpenSettings}
        title="Настройки"
        style={{
          height: '100%', padding: '0 9px',
          borderLeft: '1px solid var(--border)',
          color: 'var(--text3)', flexShrink: 0,
          display: 'flex', alignItems: 'center',
          transition: 'color .1s, background .1s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.background = 'transparent' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>

      {/* Контекстное меню вкладки */}
      {ctxMenu && (
        <TabContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          tab={tabs.find((t) => t.id === ctxMenu.tabId)}
          onSetColor={(color) => { onSetTabColor(ctxMenu.tabId, color); setCtxMenu(null) }}
          onClose={() => { onClose(ctxMenu.tabId); setCtxMenu(null) }}
          onDismiss={() => setCtxMenu(null)}
        />
      )}

      <style>{`
        @keyframes tabPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  )
}

function TabContextMenu({ x, y, tab, onSetColor, onClose, onDismiss }) {
  const menuRef = useRef(null)
  // Простое позиционирование без пересчёта — zoom сам масштабирует
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
        visibility: 'visible',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Выбор цвета */}
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
              border: tab.color === c.value
                ? '2px solid var(--text0)'
                : '2px solid transparent',
              outline: 'none',
            }}
          />
        ))}
      </div>
      <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
      <div
        onClick={onClose}
        style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--red)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg2)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >✕ Закрыть вкладку</div>
    </div>
  )
}
