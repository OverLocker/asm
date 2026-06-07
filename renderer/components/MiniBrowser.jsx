import React, { useState, useEffect, useCallback, useRef } from 'react'

const PANEL_HEIGHT = 220

function fmt(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}K`
  return `${(bytes / 1048576).toFixed(1)}M`
}

export default function MiniBrowser({ host }) {
  const [cwd, setCwd]           = useState('~')
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [selected, setSelected] = useState(null)
  const [transferring, setTransferring] = useState(false)
  const idRef = useRef(`mini-${host?.host}-${Date.now()}`)
  const connectedRef = useRef(false)

  // Guard — если host неполный, не рендерим (после хуков!)
  if (!host?.hostname || !host?.host) return null

  // ─── Подключение ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = idRef.current
    connectedRef.current = false
    setError('')
    setItems([])
    setCwd('~')

    window.api.sftp.connect({
      id,
      host: host.hostname,
      user: host.user,
      port: host.port,
      identityFile: host.identityFile,
    }).then((res) => {
      if (res.ok) {
        connectedRef.current = true
        readdir('/')
      } else {
        setError(res.error || 'SFTP error')
      }
    })

    return () => {
      window.api.sftp.disconnect(id)
      connectedRef.current = false
    }
  }, [host.host])

  // ─── Чтение директории ───────────────────────────────────────────────
  const readdir = useCallback(async (dir) => {
    if (!connectedRef.current) return
    setLoading(true)
    setSelected(null)
    const res = await window.api.sftp.readdir(idRef.current, dir)
    setLoading(false)
    if (res.ok) {
      setCwd(dir)
      const sorted = res.items
        .filter(x => x.name !== '.')
        .sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      setItems(sorted)
    }
  }, [])

  const goUp = () => {
    if (cwd === '/') return
    const parts = cwd.split('/').filter(Boolean)
    parts.pop()
    readdir('/' + parts.join('/') || '/')
  }

  const navigate = (item) => {
    if (!item.isDir) return
    const next = cwd === '/' ? `/${item.name}` : `${cwd}/${item.name}`
    readdir(next)
  }

  // ─── Скачать файл ────────────────────────────────────────────────────
  const download = async (item) => {
    if (item.isDir || transferring) return
    const remotePath = cwd === '/' ? `/${item.name}` : `${cwd}/${item.name}`
    const localPath  = `/tmp/${item.name}`
    setTransferring(true)
    await window.api.sftp.download(idRef.current, remotePath, localPath)
    setTransferring(false)
  }

  // ─── Загрузить файл ──────────────────────────────────────────────────
  const upload = async () => {
    const result = await window.api.dialog.openImage() // переиспользуем dialog
    if (!result) return
    // result.path — путь к файлу
    const name       = result.path.split('/').pop()
    const remotePath = cwd === '/' ? `/${name}` : `${cwd}/${name}`
    setTransferring(true)
    await window.api.sftp.upload(idRef.current, result.path, remotePath)
    setTransferring(false)
    readdir(cwd)
  }

  // ─── Рендер ──────────────────────────────────────────────────────────
  return (
    <div style={{
      height: PANEL_HEIGHT,
      borderTop: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg0)',
      flexShrink: 0,
    }}>
      {/* Заголовок */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 8px',
        background: 'var(--bg1)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>📁</span>
        <span
          style={{ fontSize: 10, color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}
          title={cwd}
        >{cwd}</span>
        <Btn onClick={goUp} disabled={cwd === '/'} title="Вверх">↑</Btn>
        <Btn onClick={() => readdir(cwd)} title="Обновить">↺</Btn>
        <Btn onClick={upload} disabled={transferring} title="Загрузить файл на сервер">↑📄</Btn>
      </div>

      {/* Список файлов */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
        {error && (
          <div style={{ padding: '8px', fontSize: 11, color: 'var(--red)', textAlign: 'center' }}>
            {error}
          </div>
        )}
        {loading && (
          <div style={{ padding: '8px', fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>⏳</div>
        )}
        {!loading && !error && items.map((item) => (
          <div
            key={item.name}
            onClick={() => setSelected(item.name)}
            onDoubleClick={() => item.isDir ? navigate(item) : download(item)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '2px 8px',
              background: selected === item.name ? 'var(--bg3)' : 'transparent',
              cursor: 'pointer',
              transition: 'background .1s',
            }}
            className={selected === item.name ? '' : 'hov-bg'}
          >
            <span style={{ fontSize: 10, flexShrink: 0 }}>{item.isDir ? '📁' : '📄'}</span>
            <span style={{
              fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: item.name.startsWith('.') ? 'var(--text3)' : 'var(--text0)',
            }}>{item.name}</span>
            {!item.isDir && (
              <span style={{ fontSize: 9, color: 'var(--text3)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                {fmt(item.size)}
              </span>
            )}
          </div>
        ))}
        {!loading && !error && items.length === 0 && (
          <div style={{ padding: '8px', fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>Пусто</div>
        )}
      </div>

      {/* Статус загрузки */}
      {transferring && (
        <div style={{ padding: '3px 8px', fontSize: 10, color: 'var(--amber)', background: 'var(--bg1)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          ⏳ Передача...
        </div>
      )}
    </div>
  )
}

function Btn({ children, onClick, disabled, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        fontSize: 11, padding: '1px 5px', borderRadius: 3,
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        color: disabled ? 'var(--text3)' : 'var(--text1)',
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
      }}
    >{children}</button>
  )
}
