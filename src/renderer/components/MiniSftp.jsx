import React, { useState, useEffect, useCallback, useRef } from 'react'

function fmt(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)}K`
  if (bytes < 1073741824) return `${(bytes/1048576).toFixed(1)}M`
  return `${(bytes/1073741824).toFixed(1)}G`
}

const TEXT_EXTS = new Set(['txt','md','json','yaml','yml','toml','ini','conf','config','cfg','env',
  'sh','bash','zsh','py','js','ts','jsx','tsx','css','html','xml','log','sql'])
function isText(name) { return TEXT_EXTS.has(name.split('.').pop()?.toLowerCase()) || !name.includes('.') }

let miniSftpCounter = 0

export default function MiniSftp({ activeTab, onOpenEditor }) {
  const [status, setStatus]   = useState('idle')  // idle | connecting | connected | error
  const [cwd, setCwd]         = useState('/')
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [selected, setSelected] = useState(null)
  const [transferring, setTransferring] = useState(null)
  const sessionRef = useRef(null) // { id, host }

  // Реконнект при смене активной SSH-сессии
  useEffect(() => {
    if (!activeTab || activeTab.type !== 'terminal' || activeTab.status !== 'connected') {
      // Закрываем текущую сессию если была
      if (sessionRef.current) {
        window.api.sftp.disconnect(sessionRef.current.id).catch(() => {})
        sessionRef.current = null
      }
      setStatus('idle')
      setItems([])
      return
    }

    const host = activeTab.host
    // Если уже подключены к тому же хосту — не переподключаемся
    if (sessionRef.current?.hostKey === host.host) return

    // Отключаем старую сессию
    if (sessionRef.current) {
      window.api.sftp.disconnect(sessionRef.current.id).catch(() => {})
      sessionRef.current = null
    }

    const id = `mini-sftp-${++miniSftpCounter}`
    setStatus('connecting')
    setItems([])
    setCwd('/')

    window.api.sftp.connect({ id, host: host.hostname, user: host.user, port: host.port, identityFile: host.identityFile })
      .then((res) => {
        if (res.ok) {
          sessionRef.current = { id, hostKey: host.host }
          setStatus('connected')
          readdir(id, '/')
        } else {
          setStatus('error')
          setError(res.error || 'Ошибка подключения')
        }
      })

    return () => {
      if (sessionRef.current?.id === id) {
        window.api.sftp.disconnect(id).catch(() => {})
        sessionRef.current = null
      }
    }
  }, [activeTab?.id, activeTab?.status])

  const readdir = useCallback(async (idOverride, dir) => {
    const id = idOverride || sessionRef.current?.id
    if (!id) return
    setLoading(true)
    const res = await window.api.sftp.readdir(id, dir)
    setLoading(false)
    if (res.ok) {
      setCwd(dir)
      setItems(res.items
        .filter((x) => x.name !== '.')
        .sort((a, b) => { if (a.isDir !== b.isDir) return a.isDir ? -1 : 1; return a.name.localeCompare(b.name) })
      )
      setSelected(null)
    }
  }, [])

  const navigate = (item) => {
    if (!item.isDir) return
    const next = cwd === '/' ? `/${item.name}` : `${cwd}/${item.name}`
    readdir(null, next)
  }

  const goUp = () => {
    if (cwd === '/') return
    const parts = cwd.split('/').filter(Boolean)
    parts.pop()
    readdir(null, '/' + parts.join('/') || '/')
  }

  const remotePath = (name) => cwd === '/' ? `/${name}` : `${cwd}/${name}`

  const openEdit = (item) => {
    if (item.isDir) { navigate(item); return }
    const id = sessionRef.current?.id
    if (!id) return
    onOpenEditor?.(id, remotePath(item.name), item.name)
  }

  const download = async (item) => {
    const id = sessionRef.current?.id
    if (!id) return
    const localPath = await window.api.dialog.savePath(item.name)
    if (!localPath) return
    setTransferring(item.name)
    await window.api.sftp.download(id, remotePath(item.name), localPath)
    setTransferring(null)
  }

  if (status === 'idle') return (
    <div style={styles.empty}>Откройте SSH-сессию для SFTP</div>
  )

  if (status === 'connecting') return (
    <div style={styles.empty}>⏳ Подключение...</div>
  )

  if (status === 'error') return (
    <div style={{ ...styles.empty, color: 'var(--red)', fontSize: 10 }}>⚠ {error}</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Тулбар */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
        borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg1)',
      }}>
        <button onClick={goUp} disabled={cwd === '/'} title="Вверх"
          style={{ fontSize: 12, padding: '1px 5px', color: cwd === '/' ? 'var(--text3)' : 'var(--accent)', borderRadius: 3 }}>↑</button>
        <div style={{
          flex: 1, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text2)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          background: 'var(--bg2)', padding: '2px 6px', borderRadius: 3,
        }}>{cwd}</div>
        <button onClick={() => readdir(null, cwd)} title="Обновить"
          style={{ fontSize: 12, padding: '1px 5px', color: 'var(--text2)', borderRadius: 3 }}>↻</button>
      </div>

      {/* Список файлов */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={styles.empty}>⏳</div>}
        {!loading && items.map((item) => (
          <div
            key={item.name}
            onClick={() => setSelected(item.name)}
            onDoubleClick={() => openEdit(item)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 8px', cursor: 'pointer', fontSize: 11,
              background: selected === item.name ? 'var(--bg3)' : 'transparent',
              opacity: transferring === item.name ? 0.5 : 1,
            }}
            className={selected === item.name ? '' : 'hov-bg'}
            onContextMenu={(e) => { e.preventDefault(); setSelected(item.name) }}
          >
            <span style={{ flexShrink: 0 }}>
              {item.isDir ? '📁' : isText(item.name) ? '📝' : '📄'}
            </span>
            <span style={{
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: item.name.startsWith('.') ? 'var(--text3)' : 'var(--text1)',
            }}>{item.name}</span>
            {!item.isDir && (
              <span style={{ fontSize: 9, color: 'var(--text3)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                {fmt(item.size)}
              </span>
            )}
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div style={styles.empty}>Пусто</div>
        )}
      </div>

      {/* Кнопки действий для выбранного */}
      {selected && (() => {
        const item = items.find((x) => x.name === selected)
        if (!item) return null
        return (
          <div style={{
            display: 'flex', gap: 4, padding: '4px 8px',
            borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg1)',
          }}>
            <ActionBtn onClick={() => openEdit(item)}>{item.isDir ? '→ Открыть' : '✏ Ред.'}</ActionBtn>
            {!item.isDir && <ActionBtn onClick={() => download(item)}>↓</ActionBtn>}
          </div>
        )
      })()}
    </div>
  )
}

function ActionBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, fontSize: 10, padding: '3px 6px', borderRadius: 4, cursor: 'pointer',
      background: 'var(--bg3)', color: 'var(--text1)', border: '1px solid var(--border2)',
    }}
      className="hov-bg4"
    >{children}</button>
  )
}

const styles = {
  empty: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', fontSize: 11, color: 'var(--text3)', padding: 8, textAlign: 'center',
  }
}
