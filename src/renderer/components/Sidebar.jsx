import React, { useState, useRef, useEffect, useMemo, useCallback, useDeferredValue } from 'react'
import AddHostModal from './AddHostModal'
import { useInputModal } from './InputModal'
import './Sidebar.css'

// ─── Константы ───────────────────────────────────────────────────────────────

const FOUND_GROUP = 'Найденные'   // системная группа для хостов без кастомной группы
const FOUND_KEY   = '__found__'   // ключ в collapsed

const COLORS = ['#2563eb','#7c3aed','#16a34a','#d97706','#dc2626','#0891b2','#be185d']

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function hostKey(h) { return h.host }

function hostColor(name) {
  let n = 0
  for (const c of name) n = (n * 31 + c.charCodeAt(0)) & 0xffff
  return COLORS[n % COLORS.length]
}

// Возвращает кастомный цвет из hostSettings или авто-цвет
function hostColorFor(h, hostSettings) {
  return hostSettings?.[hostKey(h)]?.color || hostColor(h.host)
}

function matchesSearch(h, q) {
  // Ищем по основному имени, псевдонимам (aliases) и пользователю.
  // hostname (IP/адрес) намеренно исключён — он не является идентификатором для пользователя.
  if (h.host.toLowerCase().includes(q)) return true
  if ((h.user || '').toLowerCase().includes(q)) return true
  if (h.aliases && h.aliases.some(a => a.toLowerCase().includes(q))) return true
  return false
}

// ─── Главный компонент ───────────────────────────────────────────────────────

export default React.memo(function Sidebar({
  onEditHost,
  hosts,
  customGroups,
  notes,
  hostSettings,
  search,
  onSearch,
  onOpen,
  onOpenSplit,
  onSaveCustomGroups,
  onSaveNote,
  onToggleHostTunnel,
  onToggleFavorite,
  favorites,
  externalTerminal,
  onAddHost,
  onSaveHostSettings,
  onOpenSftpCommander,
  width,
  onResize,
  compact = false,
  onHide,
  onExportImport,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    // Все группы свёрнуты по умолчанию при старте
    return { [FOUND_KEY]: true }
    // customGroups ещё не загружены при init — дополним в useEffect
  })

  // При изменении дерева групп — добавляем новые id в collapsed (свёрнуты по умолчанию)
  useEffect(() => {
    if (customGroups.length === 0) return
    setCollapsed((c) => {
      const next = { ...c }
      let changed = false
      function walk(nodes) {
        for (const n of nodes) {
          if (!(n.id in next)) { next[n.id] = true; changed = true }
          if (n.children?.length) walk(n.children)
        }
      }
      walk(customGroups)
      return changed ? next : c  // не триггерим ре-рендер если ничего не изменилось
    })
  }, [customGroups])
  const { inputModal, askInput } = useInputModal()
  const [groupCtx, setGroupCtx] = useState(null) // { x, y, node }

  const [ctx, setCtx]         = useState(null)
  const deferredSearch = useDeferredValue(search)
  const normalizedSearch = useMemo(() => deferredSearch.trim().toLowerCase(), [deferredSearch])   // { x, y, host }
  const [editNote, setEditNote]   = useState(null)
  const [noteText, setNoteText]   = useState('')


  const dragRef = useRef(false)

  // ─── Resize сайдбара ─────────────────────────────────────────────────────

  const onMouseDown = useCallback((e) => {
    dragRef.current = true
    const onMove = (e) => { if (dragRef.current) onResize(Math.max(180, Math.min(420, e.clientX))) }
    const onUp   = () => { dragRef.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
  }, [onResize])

  // ─── Контекстное меню ────────────────────────────────────────────────────

  const openCtx = useCallback((e, host, groupId = null) => {
    e.preventDefault()
    setCtx({ x: e.clientX, y: e.clientY, host, groupId })
  }, [])

  useEffect(() => {
    if (!ctx) return
    const dismiss = (e) => setCtx(null)
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
  }, [ctx])

  // ─── Вычисление: какие хосты уже в кастомных группах ─────────────────────

  const assignedKeys = useMemo(() => {
    const set = new Set()
    function walk(nodes) {
      for (const n of nodes) {
        for (const k of (n.hostKeys || [])) set.add(k)
        if (n.children?.length) walk(n.children)
      }
    }
    walk(customGroups)
    return set
  }, [customGroups])

  // ─── Фильтрация для поиска ───────────────────────────────────────────────

  const isSearching = search.trim().length > 0
  const searchQ     = search.trim().toLowerCase()

  // Хосты, попадающие под поиск (если поиск активен)
  const matchedHosts = useMemo(() => {
    if (!isSearching) return null
    return new Set(hosts.filter((h) => matchesSearch(h, searchQ)).map(hostKey))
  }, [hosts, isSearching, searchQ])

  // ─── Кастомные группы: рекурсивный рендер ───────────────────────────────

  function renderCustomGroups(nodes, depth = 0) {
    return nodes.map((node) => {
      const nodeHosts = (node.hostKeys || [])
        .map((k) => hosts.find((h) => hostKey(h) === k))
        .filter(Boolean)
        .filter((h) => !isSearching || matchedHosts.has(hostKey(h)))

      const hasChildren = (node.children || []).length > 0
      const isCollapsed = !!collapsed[node.id]
      if (isSearching && nodeHosts.length === 0 && !hasChildren) return null

      // Подгруппы видны независимо от collapsed состояния родителя:
      // collapsed скрывает только хосты группы, но не дочерние группы
      const showHosts = (!isCollapsed || (isSearching && nodeHosts.length > 0))

      return (
        <div key={node.id} style={{ paddingLeft: depth * 12 }}>
          <GroupHeader
            label={node.name}
            count={nodeHosts.length}
            collapsed={isCollapsed}
            onToggle={() => setCollapsed((c) => ({ ...c, [node.id]: !c[node.id] }))}
            onCtxMenu={(e) => setGroupCtx({ x: e.clientX, y: e.clientY, node })}
          />
          {showHosts && (
            <>
              {nodeHosts.map((h) => (
                <HostRow
                  key={hostKey(h)}
                  host={h}
                  note={notes[hostKey(h)]}
                  color={hostColorFor(h, hostSettings)}
                  depth={depth + 1}
                  searchQ={isSearching ? searchQ : ''}
                  groupId={node.id}
                  tunnelEnabled={!!(hostSettings?.[hostKey(h)]?.tunnel)}
                  onOpen={onOpen}
                  onCtx={openCtx}
                  compact={compact}
                />
              ))}
            </>
          )}
          {/* Дочерние группы: коллапсируются вместе с родителем */}
          {hasChildren && !isCollapsed && renderCustomGroups(node.children, depth + 1)}
        </div>
      )
    })
  }

  // ─── Хосты группы "Найденные" ────────────────────────────────────────────

  // 'Найденные' показывает все хосты — хост может быть одновременно в группе и здесь
  const foundHosts = useMemo(() => hosts, [hosts])

  // При поиске — фильтруем из foundHosts; при этом collapsed не меняем
  const foundVisible = isSearching
    ? foundHosts.filter((h) => matchedHosts.has(hostKey(h)))
    : foundHosts

  // Показывать ли содержимое "Найденных":
  // - при поиске: всегда показывать (независимо от collapsed)
  // - без поиска: только если не свёрнута
  const foundOpen = isSearching ? true : !collapsed[FOUND_KEY]

  // ─── Добавить хост в кастомную группу ───────────────────────────────────

  function addHostToGroup(groupId, hKey) {
    function walk(nodes) {
      return nodes.map((n) => {
        if (n.id === groupId) {
          const keys = Array.from(new Set([...(n.hostKeys || []), hKey]))
          return { ...n, hostKeys: keys }
        }
        return { ...n, children: walk(n.children || []) }
      })
    }
    return walk(customGroups)
  }

  function addHostToGroupById(targetGroupId, hKey) {
    onSaveCustomGroups(addHostToGroup(targetGroupId, hKey))
  }

  // Плоский список всех групп для пикера
  const allGroupsFlat = useMemo(() => {
    const list = []
    function walk(nodes, prefix = '') {
      for (const n of nodes) {
        list.push({ id: n.id, label: prefix + n.name })
        if (n.children?.length) walk(n.children, prefix + n.name + ' / ')
      }
    }
    walk(customGroups)
    return list
  }, [customGroups])

  // ─── Рендер ──────────────────────────────────────────────────────────────

  return (
    <div style={{
      width,
      minWidth: 180,
      maxWidth: 420,
      background: 'var(--bg1)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      position: 'relative',
      flexShrink: 0,
      overflow: 'hidden',   // ← фиксирует скролл внутри flex-колонки
      height: '100%',
    }}>

      {/* Заголовок + поиск */}
      <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4"/>
          </svg>
          <span style={{ fontWeight: 600, color: 'var(--text0)', fontSize: 13 }}>ASM</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>{hosts.length}</span>
          <button className="sb-header-btn" onClick={onAddHost} title="Добавить хост" style={{ fontSize: 16, marginLeft: 6 }}>+</button>
          {onExportImport && (
            <button className="sb-header-btn" onClick={onExportImport} title="Экспорт / Импорт хостов" style={{ fontSize: 11 }}>📦</button>
          )}
          {onHide && (
            <button className="sb-header-btn" onClick={onHide} title="Свернуть панель">◀</button>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            style={{ width: '100%', fontSize: 12, paddingRight: search ? 28 : 10 }}
          />
          {search && (
            <button
              onClick={() => onSearch('')}
              style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text3)', fontSize: 15, lineHeight: 1,
              }}
            >×</button>
          )}
        </div>
      </div>

      {/* Дерево */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>

        {/* Кастомные группы */}
        {renderCustomGroups(customGroups)}



        {/* Разделитель */}
        {(customGroups.length > 0 || !isSearching) && foundHosts.length > 0 && (
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
        )}

        {/* Группа "Найденные" */}
        {foundVisible.length > 0 && (
          <div>
            <GroupHeader
              label={FOUND_GROUP}
              count={isSearching ? foundVisible.length : foundHosts.length}
              collapsed={!foundOpen}
            muted
            onToggle={() => {
                if (!isSearching) {
                  setCollapsed((c) => ({ ...c, [FOUND_KEY]: !c[FOUND_KEY] }))
                }
                // при поиске клик на заголовок ничего не делает (всегда открыта)
              }}
            />
            {foundOpen && foundVisible.map((h) => (
              <HostRow
                key={hostKey(h)}
                host={h}
                note={notes[hostKey(h)]}
                color={hostColorFor(h, hostSettings)}
                depth={1}
                searchQ={isSearching ? searchQ : ''}
                tunnelEnabled={!!(hostSettings?.[hostKey(h)]?.tunnel)}
                onOpen={onOpen}
                onCtx={openCtx}
                compact={compact}
              />
            ))}
          </div>
        )}

        {isSearching && matchedHosts.size === 0 && (
          <div style={{ padding: '20px 14px', color: 'var(--text3)', fontSize: 12, textAlign: 'center' }}>
            Ничего не найдено
          </div>
        )}
      </div>

      {/* Ручка ресайза */}
      <div
        onMouseDown={onMouseDown}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize', zIndex: 10 }}
      />

      {/* Контекстное меню */}
      {ctx && (
        <ContextMenu
          x={ctx.x} y={ctx.y}
          host={ctx.host}
          groupId={ctx.groupId}
          customGroups={customGroups}
          tunnelEnabled={!!(hostSettings?.[hostKey(ctx.host)]?.tunnel)}
          isFavorite={!!favorites.find((f) => f.host === ctx.host.host)}
          hostColor={hostColorFor(ctx.host, hostSettings)}
          externalTerminal={externalTerminal}
          onOpen={(type) => { onOpen(ctx.host, type); setCtx(null) }}
          onOpenSplit={(where) => { onOpenSplit?.(ctx.host, where); setCtx(null) }}
          onAddToGroup={(gid) => { addHostToGroupById(gid, hostKey(ctx.host)); setCtx(null) }}
          onRemoveFromGroup={() => {
            onSaveCustomGroups(removeHostFromGroup(customGroups, ctx.groupId, hostKey(ctx.host)))
            setCtx(null)
          }}
          onToggleTunnel={() => { onToggleHostTunnel(hostKey(ctx.host)); setCtx(null) }}
          onToggleFavorite={() => { onToggleFavorite(ctx.host); setCtx(null) }}
          onEditHost={() => { onEditHost && onEditHost(ctx.host); setCtx(null) }}
          onDeleteHost={async () => {
            const h = ctx.host
            setCtx(null)
            // Диалог подтверждения через window.confirm (нативный)
            if (!window.confirm(`Удалить хост «${h.host}» из конфига?\nЭто действие необратимо.`)) return
            // Берём файл источника, иначе перебираем все файлы
            const files = await window.api.sshConfig.listFiles()
            const targetFile = h._sourceFile
              ? (files.find((f) => f.path === h._sourceFile) || files[0])?.path
              : files[0]?.path
            if (!targetFile) return
            const res = await window.api.sshConfig.deleteHost({ filePath: targetFile, hostName: h.host })
            if (res?.ok) {
              // Удаляем пароль если был
              await window.api.sshConfig.deletePassword(h.host).catch(() => {})
              // Перечитываем хосты
              const updated = await window.api.sshConfig.reload()
              // Проброс наверх — нужен onHostsUpdated проп или использовать window event
              window.dispatchEvent(new CustomEvent('asm:hosts-updated', { detail: updated }))
            }
          }}
          onOpenSftpCommander={(side) => { onOpenSftpCommander?.(ctx.host, side); setCtx(null) }}
          onEditNote={() => { setEditNote(ctx.host); setNoteText(notes[hostKey(ctx.host)] || ''); setCtx(null) }}
          allHosts={hosts}
          onCopySSH={() => {
            const h = ctx.host
            const port = h.port && h.port !== 22 ? ` -p ${h.port}` : ''
            const user = h.user ? `${h.user}@` : ''
            const cmd = `ssh${port} ${user}${h.hostname || h.host}`
            navigator.clipboard.writeText(cmd).catch(() => {})
            setCtx(null)
          }}
          onSetColor={(color) => {
            if (onSaveHostSettings) {
              const key = hostKey(ctx.host)
              const entry = { ...hostSettings[key] }
              if (color === null) {
                delete entry.color
              } else {
                entry.color = color
              }
              onSaveHostSettings({ ...hostSettings, [key]: entry })
            }
            setCtx(null)
          }}
        />
      )}



      {/* Контекстное меню группы */}
      {groupCtx && (
        <GroupContextMenu
          x={groupCtx.x} y={groupCtx.y} node={groupCtx.node}
          onAddChild={async () => {
            setGroupCtx(null)
            const name = await askInput('Название подгруппы:')
            if (!name) return
            const newNode = { id: `g-${Date.now()}`, name, hostKeys: [], children: [] }
            setCollapsed((c) => ({ ...c, [newNode.id]: true }))
            onSaveCustomGroups(addChildToGroup(customGroups, groupCtx.node.id, newNode))
          }}
          onRename={async () => {
            const oldNode = groupCtx.node
            setGroupCtx(null)
            const name = await askInput('Новое название:', oldNode.name)
            if (!name || name === oldNode.name) return
            onSaveCustomGroups(renameGroup(customGroups, oldNode.id, name))
          }}
          onDelete={async () => {
            const node = groupCtx.node
            setGroupCtx(null)
            const ok = await askInput(`Удалить "${node.name}"? Введите "да":`)
            if (ok && ok.toLowerCase() === 'да')
              onSaveCustomGroups(removeGroup(customGroups, node.id))
          }}
          onClose={() => setGroupCtx(null)}
        />
      )}

      {inputModal}

      {/* Модал: заметка */}
      {editNote && (
        <Modal title={`Заметка: ${editNote.host}`} onClose={() => setEditNote(null)}>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            style={{ width: '100%', minHeight: 100, resize: 'vertical', fontSize: 12 }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
            <Btn onClick={() => setEditNote(null)}>Отмена</Btn>
            <Btn accent onClick={() => { onSaveNote(hostKey(editNote), noteText); setEditNote(null) }}>Сохранить</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
})

// ─── Вспомогательные функции для мутации дерева ──────────────────────────────

function removeHostFromGroup(nodes, groupId, hKey) {
  return nodes.map((n) => {
    if (n.id === groupId) return { ...n, hostKeys: (n.hostKeys || []).filter((k) => k !== hKey) }
    return { ...n, children: removeHostFromGroup(n.children || [], groupId, hKey) }
  })
}

function addChildToGroup(nodes, parentId, child) {
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...(n.children || []), child] }
    return { ...n, children: addChildToGroup(n.children || [], parentId, child) }
  })
}

function removeGroup(nodes, id) {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: removeGroup(n.children || [], id) }))
}

function renameGroup(nodes, id, name) {
  return nodes.map((n) =>
    n.id === id
      ? { ...n, name }
      : { ...n, children: renameGroup(n.children || [], id, name) }
  )
}

// ─── Под-компоненты ──────────────────────────────────────────────────────────

function GroupHeader({ label, count, collapsed, onToggle, muted, onCtxMenu }) {
  return (
    <div
      onClick={onToggle}
      onContextMenu={onCtxMenu ? (e) => { e.preventDefault(); onCtxMenu(e) } : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '3px 12px',
        cursor: 'pointer',
        color: muted ? 'var(--text3)' : 'var(--text2)',
      }}
    >
      <span style={{
        fontSize: 9, display: 'inline-block',
        transition: 'transform .15s',
        transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        color: 'var(--text3)',
      }}>▼</span>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.2px', flex: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text3)' }}>{count}</span>
    </div>
  )
}

function HostRow({ host, note, color, depth, searchQ, groupId, tunnelEnabled, onOpen, onCtx, compact = false }) {
  // ✅ НЕ используем hov state — это было причиной React ре-рендера на каждый hover!
  // Вместо этого CSS :hover управляет фоном, а ping триггерится через ref.
  const [ping, setPing] = useState(null)
  const pingFetchedRef = useRef(false)
  const pl = (compact ? 8 : 12) + depth * (compact ? 8 : 12)

  // Ping триггерится один раз при первом наведении — без setState!
  const handleMouseEnter = useCallback(() => {
    if (pingFetchedRef.current || ping !== null) return
    const hostname = host.hostname || host.host
    if (!hostname || hostname === 'localhost') return
    pingFetchedRef.current = true
    window.api.host.ping(hostname, host.port || 22).then(setPing)
  }, [host, ping])

  const pingColor = ping == null ? 'transparent'
    : !ping.ok ? '#ef4444'
    : ping.ms < 50  ? '#22c55e'
    : ping.ms < 150 ? '#f59e0b'
    : '#ef4444'

  const pingTitle = ping == null ? ''
    : !ping.ok ? 'Недоступен'
    : `${ping.ms} мс`

  const matchField = searchQ
    ? !host.host.toLowerCase().includes(searchQ) && (host.user || '').toLowerCase().includes(searchQ)
      ? 'user' : null
    : null

  if (compact) {
    return (
      <div
        className="host-row compact"
        style={{ paddingLeft: pl }}
        onMouseEnter={handleMouseEnter}
        onDoubleClick={() => onOpen(host, 'terminal')}
        onContextMenu={(e) => onCtx(e, host, groupId)}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 4, flexShrink: 0,
          background: color + '18', border: `1px solid ${color}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 600, color, fontFamily: 'var(--font-mono)',
        }}>
          {host.host.slice(0, 2).toUpperCase()}
        </div>
        <span style={{
          fontSize: 12, fontWeight: 500, color: 'var(--text0)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
        }}>
          {host.host}
        </span>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {tunnelEnabled && <span title="Проброс портов" style={{ fontSize: 9 }}>🔌</span>}
          {note && <span title={note} style={{ color: 'var(--amber)', fontSize: 9 }}>●</span>}
          {/* ✅ Ping dot: скрыт по умолчанию, показывается через CSS :hover */}
          {ping && (
            <span title={pingTitle} className="ping-dot" style={{ background: pingColor, boxShadow: `0 0 4px ${pingColor}` }} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="host-row"
      style={{ paddingLeft: pl }}
      onMouseEnter={handleMouseEnter}
      onDoubleClick={() => onOpen(host, 'terminal')}
      onContextMenu={(e) => onCtx(e, host, groupId)}
    >
      <div style={{
        width: 26, height: 26, borderRadius: 5, flexShrink: 0,
        background: color + '18', border: `1px solid ${color}35`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 600, color, fontFamily: 'var(--font-mono)',
      }}>
        {host.host.slice(0, 2).toUpperCase()}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {host.host}
        </div>
        <div style={{ fontSize: 10, color: matchField ? 'var(--accent)' : 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {host.user ? `${host.user}@` : ''}{host.hostname}{host.port !== 22 ? `:${host.port}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {tunnelEnabled && <span title="Проброс портов включён" style={{ fontSize: 10 }}>🔌</span>}
        {note && <span title={note} style={{ color: 'var(--amber)', fontSize: 11 }}>●</span>}
        {/* ✅ Ping dot: CSS управляет видимостью через .host-row:hover .ping-dot */}
        {ping && (
          <span title={pingTitle} className="ping-dot" style={{ background: pingColor, boxShadow: `0 0 4px ${pingColor}` }} />
        )}
      </div>
    </div>
  )
}

function ContextMenu({ x, y, host, groupId, customGroups, tunnelEnabled, isFavorite, hostColor, externalTerminal, onOpen, onOpenSplit, onAddToGroup, onRemoveFromGroup, onToggleTunnel, onToggleFavorite, onEditHost, onDeleteHost, onEditNote, onCopySSH, onSetColor, onOpenSftpCommander, allHosts }) {
  const menuRef = useRef(null)
  const [pos, setPos] = useState(null)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const COLOR_PALETTE = [
    '#2563eb','#7c3aed','#16a34a','#d97706','#dc2626',
    '#0891b2','#be185d','#ea580c','#65a30d','#0284c7',
    '#9333ea','#e11d48','#14b8a6','#f59e0b','#6366f1',
  ]

  // Пересчитываем позицию при изменении размера меню (разворот групп).
  // Используем функциональный setState чтобы не триггерить ре-рендер если позиция не изменилась
  // и тем самым не создавать бесконечный цикл ResizeObserver → setState → render → ResizeObserver.
  useEffect(() => {
    if (!menuRef.current) return
    const reposition = () => {
      const rect = menuRef.current?.getBoundingClientRect()
      if (!rect) return
      const margin = 6
      const left = Math.min(x, window.innerWidth  - rect.width  - margin)
      const top  = Math.min(y, window.innerHeight - rect.height - margin)
      setPos((prev) => (prev?.left === left && prev?.top === top) ? prev : { left, top })
    }
    reposition()
    const ro = new ResizeObserver(reposition)
    ro.observe(menuRef.current)
    return () => ro.disconnect()
  }, [x, y, showColorPicker])

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: pos ? pos.left : x,
        top:  pos ? pos.top  : y,
        zIndex: 1000,
        background: 'var(--bg1)', border: '1px solid var(--border2)',
        borderRadius: 8, padding: '4px 0', minWidth: 230,
        boxShadow: '0 4px 20px rgba(0,0,0,.12)',
        visibility: pos ? 'visible' : 'hidden',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* ── Подключение ── */}
      <CtxLabel>Подключение</CtxLabel>
      <CtxAction onClick={() => onOpen('terminal')}>⌨  Терминал</CtxAction>
      {onOpenSplit && (
        <SubMenu label="⌨  Терминал → сплит">
          <CtxAction onClick={() => onOpenSplit('right')}  indent>▶  Справа</CtxAction>
          <CtxAction onClick={() => onOpenSplit('left')}   indent>◀  Слева</CtxAction>
          <CtxAction onClick={() => onOpenSplit('bottom')} indent>▼  Снизу</CtxAction>
          <CtxAction onClick={() => onOpenSplit('top')}    indent>▲  Сверху</CtxAction>
        </SubMenu>
      )}
      <CtxAction onClick={() => onOpen('sftp')}>📁  SFTP</CtxAction>
      {onOpenSftpCommander && (
        <SubMenu label="⇄  В SFTP Commander">
          <CtxAction indent onClick={() => onOpenSftpCommander('left')}>◧  Левая панель</CtxAction>
          <CtxAction indent onClick={() => onOpenSftpCommander('right')}>◨  Правая панель</CtxAction>
        </SubMenu>
      )}
      <CtxAction onClick={() => onOpen('tunnel')}>🔌  Туннели</CtxAction>
      <CtxAction onClick={() => window.api.ssh.openExternal({ host: host.hostname || host.host, user: host.user, port: host.port, identityFile: host.identityFile, externalTerminal })}>↗  Системный терминал</CtxAction>

      <Divider />

      {/* ── Настройки хоста ── */}
      <CtxLabel>Хост</CtxLabel>
      <CtxAction onClick={onToggleFavorite}>
        {isFavorite ? '⭐  Убрать из избранного' : '☆  Добавить в избранное'}
      </CtxAction>
      <CtxAction onClick={onToggleTunnel}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          🔌  Проброс Портов
          <span style={{
            marginLeft: 'auto', fontSize: 10, padding: '1px 6px', borderRadius: 3,
            background: tunnelEnabled ? 'rgba(22,163,74,0.12)' : 'var(--bg3)',
            color: tunnelEnabled ? 'var(--green)' : 'var(--text3)',
            border: `1px solid ${tunnelEnabled ? 'rgba(22,163,74,0.25)' : 'var(--border2)'}`,
          }}>{tunnelEnabled ? 'вкл' : 'выкл'}</span>
        </span>
      </CtxAction>

      <CtxAction onClick={onEditHost}>✎ Редактировать хост</CtxAction>
      <CtxAction onClick={onDeleteHost} style={{ color: 'var(--red)' }}>✕ Удалить хост</CtxAction>

      {/* Цвет метки */}
      <div
        className="ctx-action"
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        onClick={() => setShowColorPicker((v) => !v)}
      >
        <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: hostColor, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
        🎨  Цвет метки
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text3)' }}>{showColorPicker ? '▲' : '▼'}</span>
      </div>
          {showColorPicker && (
            <div style={{ padding: '6px 14px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {COLOR_PALETTE.map((c) => (
                <div key={c} onClick={() => onSetColor(c)} title={c}
                  className="color-dot"
                  style={{ width: 18, height: 18, borderRadius: 4, background: c, border: c === hostColor ? '2px solid var(--text0)' : '2px solid transparent' }}
                />
              ))}
              <div onClick={() => onSetColor(null)} title="Авто (сбросить)"
                className="color-dot"
                style={{ width: 18, height: 18, borderRadius: 4, border: '2px solid var(--border2)', background: 'linear-gradient(135deg, #ccc 50%, #fff 50%)' }}
              />
            </div>
          )}

      <CtxAction onClick={onEditNote}>📝  Заметка</CtxAction>

      {/* ── Группы ── */}
      {(customGroups.length > 0 || groupId) && (
        <>
          <Divider />
          <CtxLabel>Группы</CtxLabel>
          {customGroups.length > 0 && (
            <GroupTree nodes={customGroups} onSelect={onAddToGroup} depth={0} />
          )}
          {groupId && (
            <CtxAction onClick={onRemoveFromGroup} danger>✕  Убрать из группы</CtxAction>
          )}
        </>
      )}
    </div>
  )
}

// Раскрывающееся дерево групп внутри контекстного меню
// УЛУЧШЕНО: автораскрытие при наведении + возможность раскрыть подгруппу даже если родитель свёрнут
function GroupTree({ nodes, onSelect, depth }) {
  const [open, setOpen] = useState({})
  const [hoverOpen, setHoverOpen] = useState({})
  
  const toggleNode = (nodeId) => {
    setOpen((o) => ({ ...o, [nodeId]: !o[nodeId] }))
  }
  
  const handleNodeHover = (nodeId, hasChildren) => {
    if (hasChildren) {
      setHoverOpen((h) => ({ ...h, [nodeId]: true }))
    }
  }
  
  const handleNodeLeave = (nodeId) => {
    setHoverOpen((h) => {
      const next = { ...h }
      delete next[nodeId]
      return next
    })
  }
  
  return (
    <>
      {nodes.map((node) => {
        const hasChildren = (node.children || []).length > 0
        const isOpen = open[node.id]
        const shouldShowChildren = isOpen || hoverOpen[node.id]
        const pl = 14 + depth * 12
        
        return (
          <React.Fragment key={node.id}>
            <div
              className="group-tree-item"
              style={{ padding: `5px 14px 5px ${pl}px` }}
              onMouseEnter={() => handleNodeHover(node.id, hasChildren)}
              onMouseLeave={() => handleNodeLeave(node.id)}
              onClick={(e) => {
                e.stopPropagation()
                if (hasChildren) {
                  const arrow = e.target.closest('[data-arrow]')
                  if (arrow) { 
                    toggleNode(node.id)
                    return 
                  }
                }
                onSelect(node.id)
              }}
            >
              {hasChildren && (
                <span
                  data-arrow="1"
                  onClick={(e) => { 
                    e.stopPropagation()
                    toggleNode(node.id)
                  }}
                  style={{
                    fontSize: 8, marginRight: 5, display: 'inline-block',
                    transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform .15s', color: 'var(--text3)',
                    cursor: 'pointer', padding: '0 3px',
                  }}
                >▼</span>
              )}
              {!hasChildren && <span style={{ width: 16, display: 'inline-block' }} />}
              <span style={{ flex: 1 }}>{node.name}</span>
              {hasChildren && hoverOpen[node.id] && !isOpen && (
                <span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 4 }}>▶</span>
              )}
            </div>
            {/* Показываем подгруппы если открыто ИЛИ если наведение мышки */}
            {hasChildren && shouldShowChildren && (
              <GroupTree nodes={node.children} onSelect={onSelect} depth={depth + 1} />
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
}

function CtxLabel({ children }) {
  return (
    <div style={{ padding: '3px 14px 2px', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.4px' }}>
      {children}
    </div>
  )
}

function SubMenu({ label, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  return (
    <div ref={ref} style={{ position: 'relative' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        style={{ padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text0)', display: 'flex', alignItems: 'center', background: open ? 'var(--bg2)' : 'transparent' }}
      >
        <span style={{ flex: 1 }}>{label}</span>
        <span style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 8 }}>▶</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', left: '100%', top: 0, zIndex: 1100,
          background: 'var(--bg1)', border: '1px solid var(--border2)',
          borderRadius: 8, padding: '4px 0', minWidth: 160,
          boxShadow: '0 4px 16px rgba(0,0,0,.14)',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

function CtxAction({ children, onClick, danger, indent }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`ctx-action${danger ? ' danger' : ''}${indent ? ' indent' : ''}`}
    >{children}</div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={onClose}
    >
      <div
        style={{
          background: 'var(--bg1)', border: '1px solid var(--border2)',
          borderRadius: 10, padding: 20, minWidth: 300, maxWidth: 420,
          boxShadow: '0 8px 32px rgba(0,0,0,.15)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 13, color: 'var(--text0)' }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

function Btn({ children, onClick, accent }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
        background: accent ? 'var(--accent)' : 'var(--bg3)',
        color:      accent ? '#fff'          : 'var(--text1)',
        border: accent ? 'none' : '1px solid var(--border2)',
      }}
    >
      {children}
    </button>
  )
}

function GroupContextMenu({ x, y, node, onAddChild, onRename, onDelete, onClose }) {
  useEffect(() => {
    const dismiss = () => onClose()
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
  }, [])

  const menuRef = useRef(null)
  const [pos, setPos] = useState(null)

  useEffect(() => {
    if (!menuRef.current) return
    const reposition = () => {
      const rect = menuRef.current?.getBoundingClientRect()
      if (!rect) return
      const margin = 6
      const left = Math.min(x, window.innerWidth  - rect.width  - margin)
      const top  = Math.min(y, window.innerHeight - rect.height - margin)
      setPos((prev) => (prev?.left === left && prev?.top === top) ? prev : { left, top })
    }
    reposition()
    const ro = new ResizeObserver(reposition)
    ro.observe(menuRef.current)
    return () => ro.disconnect()
  }, [x, y])

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: pos ? pos.left : x,
        top:  pos ? pos.top  : y,
        zIndex: 1000,
        background: 'var(--bg1)', border: '1px solid var(--border2)',
        borderRadius: 8, padding: '4px 0', minWidth: 190,
        boxShadow: '0 4px 20px rgba(0,0,0,.12)',
        visibility: pos ? 'visible' : 'hidden',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <GItem onClick={onAddChild}>+ Добавить подгруппу</GItem>
      <GItem onClick={onRename}>✏ Переименовать</GItem>
      <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
      <GItem onClick={onDelete} danger>✕ Удалить группу</GItem>
    </div>
  )
}

function GItem({ children, onClick, danger }) {
  return (
    <div
      onClick={onClick}
      className={`g-item${danger ? ' danger' : ''}`}
    >{children}</div>
  )
}
