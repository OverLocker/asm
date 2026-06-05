import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { useInputModal } from './InputModal'

// ─── Утилиты ─────────────────────────────────────────────────────────────────

function fmt(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}K`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)}M`
  return `${(bytes / 1073741824).toFixed(1)}G`
}

function fmtDate(ms) {
  const d = new Date(ms)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

const TEXT_EXTS = new Set([
  'txt','md','json','yaml','yml','toml','ini','conf','config','cfg','env',
  'sh','bash','zsh','fish','py','js','ts','jsx','tsx','css','html','xml',
  'log','csv','sql','dockerfile','makefile','gitignore','htaccess','nginx',
])
function isText(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  return TEXT_EXTS.has(ext) || !name.includes('.')
}

function fileIcon(item) {
  if (item.isDir) return '📁'
  if (isText(item.name)) return '📝'
  return '📄'
}

// ─── SftpPanel ────────────────────────────────────────────────────────────────
// forwardRef: родитель может вызвать .refresh() и читать .cwd / .sftpId / .selected

const SftpPanel = forwardRef(function SftpPanel({
  host,           // { hostname, user, port, identityFile } | null — пустая панель
  sftpId,         // уникальный id сессии
  label,          // "Левая" / "Правая"
  active,         // bool — эта панель сейчас активна
  onActivate,     // () => void
  onOpenEditor,   // (sftpId, remotePath, fileName) => void
  onStatus,       // (sftpId, status) => void
  onChangeHost,   // (host) => void — пользователь выбрал хост для этой панели
  allHosts,       // все доступные хосты для выбора
}, ref) {
  const [status, setStatus]       = useState('connecting')
  const [error,  setError]        = useState('')
  const [cwd,    setCwd]          = useState('/')
  const [items,  setItems]        = useState([])
  const [loading, setLoading]     = useState(false)
  const [selected, setSelected]   = useState(new Set())  // Set of names
  const [filter,  setFilter]      = useState('')
  const [transferring, setTransferring] = useState(false)
  const [sortBy,  setSortBy]      = useState('name')     // name | size | mtime
  const [sortDir, setSortDir]     = useState(1)          // 1 | -1
  const [ctxMenu, setCtxMenu]     = useState(null)
  const cwdRef   = useRef('/')
  const itemsRef = useRef([])
  const { inputModal, askInput } = useInputModal()
  const listRef  = useRef(null)

  // ─── Пустая панель (нет хоста) ───────────────────────────────────────────
  // Рендерим до всех хуков нельзя — поэтому используем флаг
  const isEmpty = !host

  // Синхронизируем ref для доступа снаружи

  // ─── Подключение ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!host) return
    const { hostname, user, port, identityFile } = host
    window.api.sftp.connect({ id: sftpId, host: hostname, user, port, identityFile })
      .then((res) => {
        if (res.ok) {
          setStatus('connected')
          onStatus?.(sftpId, 'connected')
          readdir('/')
        } else {
          setStatus('error')
          setError(res.error || 'Connection failed')
          onStatus?.(sftpId, 'error')
        }
      })
    return () => { window.api.sftp.disconnect(sftpId) }
  }, [sftpId])

  // ─── Навигация ───────────────────────────────────────────────────────────
  const readdir = useCallback(async (dir) => {
    setLoading(true)
    const res = await window.api.sftp.readdir(sftpId, dir)
    setLoading(false)
    if (!res.ok) return
    const sorted = res.items
      .filter((x) => x.name !== '.')
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    setCwd(dir)
    cwdRef.current = dir
    setItems(sorted)
    itemsRef.current = sorted
    setSelected(new Set())
    setFilter('')
  }, [sftpId])

  const goUp = useCallback(() => {
    if (cwdRef.current === '/') return
    const parts = cwdRef.current.split('/').filter(Boolean)
    parts.pop()
    readdir('/' + parts.join('/') || '/')
  }, [readdir])

  const navigate = (item) => {
    if (!item.isDir) return
    const next = cwdRef.current === '/' ? `/${item.name}` : `${cwdRef.current}/${item.name}`
    readdir(next)
  }

  const remotePath = (name) =>
    cwdRef.current === '/' ? `/${name}` : `${cwdRef.current}/${name}`

  // ─── Сортировка ──────────────────────────────────────────────────────────
  const sortedItems = [...items].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    if (sortBy === 'name')  return sortDir * a.name.localeCompare(b.name)
    if (sortBy === 'size')  return sortDir * ((a.size || 0) - (b.size || 0))
    if (sortBy === 'mtime') return sortDir * (a.mtime - b.mtime)
    return 0
  })

  const visibleItems = filter
    ? sortedItems.filter((x) => x.name.toLowerCase().includes(filter.toLowerCase()))
    : sortedItems

  // ─── Выделение ───────────────────────────────────────────────────────────
  const toggleSelect = (name, e) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (e?.ctrlKey || e?.metaKey) {
        next.has(name) ? next.delete(name) : next.add(name)
      } else if (e?.shiftKey) {
        // Выделить диапазон от последнего выбранного до текущего
        const names = visibleItems.map((i) => i.name)
        const last  = [...prev].pop()
        const from  = last ? names.indexOf(last) : 0
        const to    = names.indexOf(name)
        const [lo, hi] = from < to ? [from, to] : [to, from]
        names.slice(lo, hi + 1).forEach((n) => next.add(n))
      } else {
        // Одиночный клик
        if (next.size === 1 && next.has(name)) {
          next.clear()
        } else {
          next.clear()
          next.add(name)
        }
      }
      return next
    })
  }

  const selectAll = () => setSelected(new Set(visibleItems.map((i) => i.name)))
  const clearSelection = () => setSelected(new Set())

  // ─── Операции с файлами ──────────────────────────────────────────────────
  const deleteSelected = async () => {
    const names = [...selected]
    if (!names.length) return
    const ok = await askInput(
      `Удалить ${names.length > 1 ? `${names.length} объектов` : `«${names[0]}»`}? Введите "да":`
    )
    if (!ok || ok.toLowerCase() !== 'да') return
    for (const name of names) {
      const item = items.find((x) => x.name === name)
      if (item) await window.api.sftp.delete(sftpId, remotePath(name), item.isDir)
    }
    readdir(cwdRef.current)
  }

  const renameItem = async (item) => {
    const newName = await askInput('Новое имя:', item.name)
    if (!newName || newName === item.name) return
    await window.api.sftp.rename(sftpId, remotePath(item.name), remotePath(newName))
    readdir(cwdRef.current)
  }

  const newFolder = async () => {
    const name = await askInput('Название новой папки:')
    if (!name) return
    await window.api.sftp.mkdir(sftpId, remotePath(name))
    readdir(cwdRef.current)
  }

  useImperativeHandle(ref, () => ({
    get cwd()      { return cwdRef.current },
    get sftpId()   { return sftpId },
    get selected() { return selected },
    get items()    { return itemsRef.current },
    refresh:       () => readdir(cwdRef.current),
    navigate:      (dir) => readdir(dir),
    setTransferring,
    newFolder,
    deleteSelected,
  }), [sftpId, selected, newFolder, deleteSelected])

  const newFile = async () => {
    const name = await askInput('Имя нового файла:')
    if (!name) return
    const rp = remotePath(name)
    await window.api.sftp.writeText(sftpId, rp, '')
    readdir(cwdRef.current)
    onOpenEditor?.(sftpId, rp, name)
  }

  // ─── Клавиатура ──────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (!active) return
    const focused = document.activeElement
    // Не перехватываем если фокус в инпуте/текстареа
    if (focused?.tagName === 'INPUT' || focused?.tagName === 'TEXTAREA') return

    if (e.key === 'Backspace' || e.key === 'ArrowLeft') { e.preventDefault(); goUp() }
    if (e.key === 'F7') { e.preventDefault(); newFolder() }
    if (e.key === 'F8' || e.key === 'Delete') { e.preventDefault(); deleteSelected() }
    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); selectAll() }
    if (e.key === 'Escape') { e.preventDefault(); clearSelection(); setFilter('') }

    // Стрелки вверх/вниз — навигация по списку
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (!visibleItems.length) return
      const sel = [...selected]
      const last = sel[sel.length - 1]
      const idx  = last ? visibleItems.findIndex((i) => i.name === last) : -1
      const next = e.key === 'ArrowDown'
        ? Math.min(idx + 1, visibleItems.length - 1)
        : Math.max(idx - 1, 0)
      toggleSelect(visibleItems[next].name, e.shiftKey ? { shiftKey: true } : null)
    }

    // Enter — войти в папку
    if (e.key === 'Enter' && selected.size === 1) {
      const item = items.find((x) => x.name === [...selected][0])
      if (item?.isDir) navigate(item)
      else if (item) onOpenEditor?.(sftpId, remotePath(item.name), item.name)
    }
  }, [active, selected, visibleItems, goUp, deleteSelected])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ─── Сортировка по колонке ───────────────────────────────────────────────
  const toggleSort = (col) => {
    if (sortBy === col) setSortDir((d) => -d)
    else { setSortBy(col); setSortDir(1) }
  }

  const sortArrow = (col) => sortBy === col ? (sortDir === 1 ? ' ▲' : ' ▼') : ''

  // ─── Рендер ──────────────────────────────────────────────────────────────

  // Пустая панель — экран выбора хоста
  if (isEmpty) {
    return (
      <div style={{ ...panelStyleFn(active), justifyContent: 'stretch' }} onClick={onActivate}>
        <PanelHeader label={label} host={null} cwd="" active={active} />
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, opacity: 0.25 }}>⇄</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
            Панель не подключена
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6, maxWidth: 200 }}>
            Нажмите <strong style={{ color: 'var(--text2)' }}>ПКМ</strong> на хосте в боковой панели и выберите{' '}
            <strong style={{ color: 'var(--accent)' }}>«В SFTP Commander»</strong>
            {label === 'Левая' ? ' → Левая' : ' → Правая'}
          </div>
        </div>
      </div>
    )
  }

  const panelBorder = active
    ? '2px solid var(--accent)'
    : '2px solid var(--border)'

  if (status === 'connecting') {
    return (
      <div style={panelStyleFn(active)}>
        <PanelHeader label={label} host={host} cwd="/" active={active} />
        <CenteredMsg>⏳ Подключение…</CenteredMsg>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div style={panelStyleFn(active)}>
        <PanelHeader label={label} host={host} cwd="/" active={active} />
        <CenteredMsg>⚠️ {error}</CenteredMsg>
      </div>
    )
  }

  const selectedArr = [...selected]

  return (
    <div
      style={panelStyleFn(active)}
      onClick={onActivate}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* ── Заголовок панели ── */}
      <PanelHeader label={label} host={host} cwd={cwd} active={active} />

      {/* ── Тулбар навигации ── */}
      <div style={toolbarStyle}>
        <NavBtn onClick={goUp} disabled={cwd === '/'} title="Вверх (Backspace)">↑</NavBtn>

        {/* Breadcrumbs — кликабельные */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 2,
          fontFamily: 'var(--font-mono)', fontSize: 11, overflow: 'hidden',
          background: 'var(--bg2)', borderRadius: 5, padding: '3px 8px',
          border: active ? '1px solid var(--accent)' : '1px solid var(--border2)',
          minWidth: 0,
        }}>
          {buildBreadcrumbs(cwd).map((crumb, i, arr) => (
            <React.Fragment key={crumb.path}>
              <span
                onClick={(e) => { e.stopPropagation(); readdir(crumb.path) }}
                style={{
                  cursor: 'pointer', color: i === arr.length - 1 ? 'var(--text0)' : 'var(--accent)',
                  whiteSpace: 'nowrap', flexShrink: i < arr.length - 1 ? 0 : 1,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}
                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
              >{crumb.label}</span>
              {i < arr.length - 1 && <span style={{ color: 'var(--text3)', flexShrink: 0 }}>/</span>}
            </React.Fragment>
          ))}
        </div>

        <NavBtn onClick={() => readdir(cwd)} title="Обновить (F5 в другом контексте)">↻</NavBtn>

        {/* Быстрый фильтр */}
        <input
          value={filter}
          onChange={(e) => { e.stopPropagation(); setFilter(e.target.value) }}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') setFilter('') }}
          onClick={(e) => e.stopPropagation()}
          placeholder="Фильтр…"
          style={{
            width: filter ? 110 : 70, fontSize: 11, padding: '3px 7px',
            borderRadius: 5, border: `1px solid ${filter ? 'var(--accent)' : 'var(--border2)'}`,
            background: 'var(--bg2)', color: 'var(--text0)', outline: 'none',
            fontFamily: 'var(--font-mono)', transition: 'width .2s',
          }}
        />
      </div>

      {/* ── Список файлов ── */}
      <div
        ref={listRef}
        style={{ flex: 1, overflowY: 'auto', fontSize: 12 }}
        onContextMenu={(e) => {
          if (!e.target.closest('[data-row]')) return
          e.preventDefault()
        }}
      >
        {loading ? (
          <CenteredMsg>⏳ Загрузка…</CenteredMsg>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{
                background: 'var(--bg2)', color: 'var(--text2)', fontSize: 10,
                position: 'sticky', top: 0, zIndex: 2,
                borderBottom: '1px solid var(--border)',
              }}>
                <Th onClick={() => toggleSort('name')} style={{ textAlign: 'left', paddingLeft: 10 }}>
                  Имя{sortArrow('name')}
                </Th>
                <Th onClick={() => toggleSort('size')} style={{ textAlign: 'right', width: 64 }}>
                  Размер{sortArrow('size')}
                </Th>
                <Th onClick={() => toggleSort('mtime')} style={{ textAlign: 'right', width: 110, paddingRight: 8 }}>
                  Изменён{sortArrow('mtime')}
                </Th>
              </tr>
            </thead>
            <tbody>
              {/* Строка ".." */}
              {cwd !== '/' && (
                <tr
                  onDoubleClick={goUp}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg2)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '4px 10px', color: 'var(--text2)' }} colSpan={3}>
                    📁 ..
                  </td>
                </tr>
              )}
              {visibleItems.map((item) => {
                const isSel = selected.has(item.name)
                return (
                  <tr
                    key={item.name}
                    data-row="1"
                    onClick={(e) => { e.stopPropagation(); onActivate?.(); toggleSelect(item.name, e) }}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      if (item.isDir) navigate(item)
                      else onOpenEditor?.(sftpId, remotePath(item.name), item.name)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      if (!selected.has(item.name)) toggleSelect(item.name, null)
                      setCtxMenu({ x: e.clientX, y: e.clientY, item })
                    }}
                    style={{
                      background: isSel
                        ? (active ? 'var(--accent)' : 'var(--bg4)')
                        : 'transparent',
                      color: isSel && active ? '#fff' : 'var(--text0)',
                      cursor: 'pointer',
                      opacity: transferring ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'var(--bg2)' }}
                    onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '4px 10px', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 0 }}>
                      <span style={{ marginRight: 6 }}>{fileIcon(item)}</span>
                      <span style={{
                        color: item.name.startsWith('.')
                          ? (isSel && active ? 'rgba(255,255,255,0.7)' : 'var(--text2)')
                          : 'inherit',
                      }}>{item.name}</span>
                    </td>
                    <td style={{
                      padding: '4px 6px', textAlign: 'right', whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                      color: isSel && active ? 'rgba(255,255,255,0.8)' : 'var(--text2)',
                    }}>
                      {item.isDir ? <span style={{ fontSize: 10 }}>DIR</span> : fmt(item.size)}
                    </td>
                    <td style={{
                      padding: '4px 8px', textAlign: 'right', whiteSpace: 'nowrap', fontSize: 11,
                      color: isSel && active ? 'rgba(255,255,255,0.8)' : 'var(--text3)',
                    }}>
                      {fmtDate(item.mtime)}
                    </td>
                  </tr>
                )
              })}
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)' }}>
                    {filter ? `Ничего по «${filter}»` : 'Папка пуста'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Строка статуса ── */}
      <div style={{
        padding: '3px 10px', fontSize: 10, color: 'var(--text3)',
        borderTop: '1px solid var(--border)', background: 'var(--bg2)',
        display: 'flex', gap: 12, flexShrink: 0,
      }}>
        <span>{visibleItems.length} объектов</span>
        {selected.size > 0 && (
          <span style={{ color: active ? 'var(--accent)' : 'var(--text1)', fontWeight: 600 }}>
            Выбрано: {selected.size}
            {' · '}{fmt(visibleItems.filter((i) => selected.has(i.name) && !i.isDir).reduce((s, i) => s + (i.size || 0), 0))}
          </span>
        )}
        {transferring && <span style={{ color: 'var(--amber)' }}>⏳ Копирование…</span>}
      </div>

      {inputModal}

      {/* ── Контекстное меню ── */}
      {ctxMenu && (
        <PanelCtxMenu
          x={ctxMenu.x} y={ctxMenu.y} item={ctxMenu.item}
          selectedCount={selected.size}
          onOpen={() => {
            const item = ctxMenu.item
            if (item.isDir) navigate(item)
            else onOpenEditor?.(sftpId, remotePath(item.name), item.name)
            setCtxMenu(null)
          }}
          onRename={() => { renameItem(ctxMenu.item); setCtxMenu(null) }}
          onDelete={() => { deleteSelected(); setCtxMenu(null) }}
          onCopyPath={() => {
            navigator.clipboard.writeText(remotePath(ctxMenu.item.name))
            setCtxMenu(null)
          }}
          onNewFolder={() => { setCtxMenu(null); newFolder() }}
          onNewFile={() => { setCtxMenu(null); newFile() }}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
})

export default React.memo(SftpPanel)
// ─── Вспомогательные компоненты ───────────────────────────────────────────────

function panelStyleFn(active) {
  return {
    display: 'flex', flexDirection: 'column', height: '100%',
    flex: 1, minWidth: 0,
    border: active ? '2px solid var(--accent)' : '2px solid var(--border2)',
    borderRadius: 6, overflow: 'hidden', background: 'var(--bg0)',
    transition: 'border-color .15s',
  }
}

const toolbarStyle = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '3px 6px', borderBottom: '1px solid var(--border)',
  background: 'var(--bg1)', flexShrink: 0,
}

function PanelHeader({ label, host, cwd, active }) {
  return (
    <div style={{
      padding: '3px 8px', fontSize: 10, fontWeight: 600,
      background: active ? 'var(--accent)' : 'var(--bg2)',
      color: active ? '#fff' : 'var(--text2)',
      display: 'flex', alignItems: 'center', gap: 6,
      flexShrink: 0, userSelect: 'none',
    }}>
      <span>{label}</span>
      {host && (
        <span style={{ fontWeight: 400, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {host.user ? `${host.user}@` : ''}{host.hostname || host.host}
        </span>
      )}
    </div>
  )
}

function NavBtn({ children, onClick, disabled, title }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick() }} disabled={disabled} title={title}
      style={{
        fontSize: 11, padding: '2px 5px', borderRadius: 3, flexShrink: 0,
        background: 'var(--bg3)', border: '1px solid var(--border2)',
        color: disabled ? 'var(--text3)' : 'var(--text1)', cursor: disabled ? 'default' : 'pointer',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--bg4)' }}
      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg3)'}
    >{children}</button>
  )
}

function Th({ children, onClick, style }) {
  return (
    <th onClick={onClick} style={{
      padding: '3px 5px', fontWeight: 600, cursor: 'pointer',
      userSelect: 'none', whiteSpace: 'nowrap', ...style,
    }}
      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text0)'}
      onMouseLeave={(e) => e.currentTarget.style.color = ''}
    >{children}</th>
  )
}

function CenteredMsg({ children }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text2)', fontSize: 13, gap: 8,
    }}>{children}</div>
  )
}

function buildBreadcrumbs(cwd) {
  if (cwd === '/') return [{ label: '/', path: '/' }]
  const parts = cwd.split('/').filter(Boolean)
  return [
    { label: '/', path: '/' },
    ...parts.map((p, i) => ({
      label: p,
      path: '/' + parts.slice(0, i + 1).join('/'),
    })),
  ]
}

function PanelCtxMenu({ x, y, item, selectedCount, onOpen, onRename, onDelete, onCopyPath, onNewFolder, onNewFile, onClose }) {
  useEffect(() => {
    const h = () => onClose()
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const left = Math.min(x, window.innerWidth - 220)
  const top  = Math.min(y, window.innerHeight - 240)

  return (
    <div
      style={{
        position: 'fixed', left, top, zIndex: 2000,
        background: 'var(--bg1)', border: '1px solid var(--border2)',
        borderRadius: 8, padding: '4px 0', minWidth: 200,
        boxShadow: '0 6px 24px rgba(0,0,0,.16)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <MI onClick={onOpen}>{item.isDir ? '📁  Открыть' : '✏️  Редактировать'}</MI>
      <MI onClick={onRename}>✎  Переименовать</MI>
      <MI onClick={onCopyPath}>📋  Копировать путь</MI>
      <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
      <MI onClick={onNewFolder}>📁  Новая папка</MI>
      <MI onClick={onNewFile}>📝  Новый файл</MI>
      <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
      <MI onClick={onDelete} danger>
        ✕  Удалить{selectedCount > 1 ? ` (${selectedCount})` : ''}
      </MI>
    </div>
  )
}

function MI({ children, onClick, danger }) {
  return (
    <div onClick={onClick}
      style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: danger ? 'var(--red)' : 'var(--text0)' }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg2)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >{children}</div>
  )
}
