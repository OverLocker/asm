import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useInputModal } from './InputModal'

function fmt(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}K`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)}M`
  return `${(bytes / 1073741824).toFixed(1)}G`
}

function fmtDate(ms) {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

export default function SftpPane({ tab, onUpdate, onOpenEditor }) {
  const [copyStatus, setCopyStatus] = useState(null)
  // Копируем путь во внутрь и отслеживаем прогресс
  const doCopy = async (item) => {
    setTransferring(item.name)
    const rp = remotePath(item.name)
    const localPath = await window.api.sftp.download(id, rp, `__asm_temp__${rp.split('/').pop()}`)

    if (localPath.ok) {
      setTransferring(null)
      setCopyStatus('Путь скопирован: ' + rp)
      setTimeout(() => setCopyStatus(null), 3000)
    }
  }
  const [status, setStatus]         = useState('connecting')
  const [error, setError]           = useState('')
  const [cwd, setCwd]               = useState('/')
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [selected, setSelected]     = useState(null)
  const [transferring, setTransferring] = useState(null)
  const [transferProgress, setTransferProgress] = useState(null) // { file, percent, type: 'download'|'upload' }
  const [ctxMenu, setCtxMenu]       = useState(null)
  const [bgCtxMenu, setBgCtxMenu]   = useState(null) // ПКМ по пустому месту
  const [dragOver, setDragOver]     = useState(false)
  const [uploads, setUploads]       = useState([])
  const [filter, setFilter]         = useState('')
  const { inputModal, askInput }    = useInputModal()

  const id = tab.id

  useEffect(() => {
    const { hostname, user, port, identityFile } = tab.host
    window.api.sftp.connect({ id, host: hostname, user, port, identityFile }).then((res) => {
      if (res.ok) {
        setStatus('connected')
        onUpdate({ status: 'connected' })
        readdir('/')
      } else {
        setStatus('error')
        setError(res.error)
        onUpdate({ status: 'error' })
      }
    })
    // Слушаем автосохранения
    const offSave = window.api.sftp.onEditSaved(({ remotePath, ok }) => {
      const fileName = remotePath.split('/').pop()
      // setEditStatus можно добавить, если нужно, пока просто логируем или игнорируем если не используется в UI
    })
    // Слушаем прогресс передачи
    const offProgress = window.api.sftp.onProgress((data) => {
      if (data.finished) {
        setTransferProgress(null)
        return
      }
      if (data.total > 0) {
        const percent = Math.round((data.transferred / data.total) * 100)
        setTransferProgress({ file: data.remotePath.split('/').pop(), percent, type: data.type })
      }
    })
    return () => { 
      window.api.sftp.disconnect(id)
      offSave?.()
      offProgress?.()
    }
  }, [])

  const readdir = useCallback(async (dir) => {
    setLoading(true)
    const res = await window.api.sftp.readdir(id, dir)
    setLoading(false)
    if (res.ok) {
      setCwd(dir)
      const sorted = res.items.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      }).filter((x) => x.name !== '.')
      setItems(sorted)
      setSelected(null)
      setFilter('')
    }
  }, [id])

  const navigate = (item) => {
    if (!item.isDir) return
    const next = cwd === '/' ? `/${item.name}` : `${cwd}/${item.name}`
    readdir(next)
  }

  const goUp = () => {
    if (cwd === '/') return
    const parts = cwd.split('/').filter(Boolean)
    parts.pop()
    readdir('/' + parts.join('/') || '/')
  }

  const remotePath = (name) => cwd === '/' ? `/${name}` : `${cwd}/${name}`

  const openEdit = async (item) => {
    if (item.isDir) { navigate(item); return }
    const rp = remotePath(item.name)
    
    // Сначала проверяем через API, является ли файл бинарным
    const res = await window.api.sftp.openEdit(id, rp, item.name)
    
    if (res.ok) {
      if (res.isBinary) {
        // Файл уже открыт системной программой, закрываем модалку если была и не открываем редактор
        return
      }
      // Открываем во встроенном редакторе только для текстовых файлов
      onOpenEditor?.(id, rp, item.name)
    } else {
      alert(res.error || 'Не удалось открыть файл')
    }
  }

  const deleteItem = async (item) => {
    if (!confirm(`Delete ${item.name}?`)) return
    await window.api.sftp.delete(id, remotePath(item.name), item.isDir)
    readdir(cwd)
  }

  const renameItem = async (item) => {
    const newName = await askInput('Новое имя:', item.name)
    if (!newName || newName === item.name) return
    const oldPath = remotePath(item.name)
    const newPath = remotePath(newName)
    await window.api.sftp.rename(id, oldPath, newPath)
    readdir(cwd)
  }

  // ─── Drag-out (из SFTP → файловый менеджер) ──────────────────────────────
  const handleDragStart = async (e, item) => {
    if (item.isDir) { e.preventDefault(); return }
    e.preventDefault() // предотвращаем дефолт, используем Electron startDrag
    await window.api.sftp.prepareDrag(id, remotePath(item.name), item.name)
  }

  // ─── Drop-in (файлы → SFTP) ───────────────────────────────────────────────
  const handleDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return
    const queue = files.map((f) => ({ name: f.name, path: f.path, done: false, error: null }))
    setUploads(queue)
    for (let i = 0; i < queue.length; i++) {
      const f = queue[i]
      const rp = remotePath(f.name)
      const res = await window.api.sftp.upload(id, f.path, rp)
      setUploads((prev) => prev.map((u, idx) => idx === i ? { ...u, done: true, error: res.ok ? null : res.error } : u))
    }
    setTimeout(() => { setUploads([]); readdir(cwd) }, 1500)
  }

  if (status === 'connecting') return <StatusMsg icon="⏳" text="Connecting via SFTP..." />
  if (status === 'error') return <StatusMsg icon="⚠️" text={`SFTP error: ${error}`} />

  const download = async (item) => {
    const rp = remotePath(item.name)
    if (item.isDir) {
      const paths = await window.api.dialog.pickUpload('folder')
      if (!paths?.length) return
      const localDir = paths[0] + '/' + item.name
      // Проверяем локально
      if (await window.api.sftp.existsLocal(localDir)) {
        if (!confirm(`Папка «${item.name}» уже существует в выбранном месте.\nПерезаписать содержимое?`)) return
      }
      setTransferring(item.name)
      await window.api.sftp.downloadDir(id, rp, localDir)
      setTransferring(null)
    } else {
      const localPath = await window.api.dialog.savePath(item.name)
      if (!localPath) return
      // showSaveDialog уже спрашивает про перезапись — дополнительно не проверяем
      setTransferring(item.name)
      await window.api.sftp.download(id, rp, localPath)
      setTransferring(null)
    }
  }

  const uploadFiles = async () => {
    const paths = await window.api.dialog.pickUpload('files')
    if (!paths?.length) return
    const queue = []
    for (const p of paths) {
      const name = p.split('/').pop()
      const rp = remotePath(name)
      const exists = await window.api.sftp.existsRemote(id, rp)
      if (exists) {
        if (!confirm(`Файл «${name}» уже существует на сервере.\nПерезаписать?`)) continue
      }
      queue.push({ name, path: p, done: false, error: null })
    }
    if (!queue.length) return
    setUploads(queue)
    for (let i = 0; i < queue.length; i++) {
      const f = queue[i]
      const rp = remotePath(f.name)
      const res = await window.api.sftp.upload(id, f.path, rp)
      setUploads((prev) => prev.map((u, idx) => idx === i ? { ...u, done: true, error: res.ok ? null : res.error } : u))
    }
    setTimeout(() => { setUploads([]); readdir(cwd) }, 1500)
  }

  const uploadFolder = async () => {
    const paths = await window.api.dialog.pickUpload('folder')
    if (!paths?.length) return
    const localDir = paths[0]
    const dirName = localDir.split('/').pop()
    const rp = remotePath(dirName)
    const exists = await window.api.sftp.existsRemote(id, rp)
    if (exists) {
      if (!confirm(`Папка «${dirName}» уже существует на сервере.\nОбъединить содержимое (файлы будут перезаписаны)?`)) return
    }
    setUploads([{ name: dirName + '/', path: localDir, done: false, error: null }])
    const res = await window.api.sftp.uploadDir(id, localDir, cwd)
    setUploads([{ name: dirName + '/', done: true, error: res.ok ? null : res.error }])
    setTimeout(() => { setUploads([]); readdir(cwd) }, 1500)
  }

  const downloadSelected = async () => {
    const item = items.find((x) => x.name === selected)
    if (!item) return
    await download(item)
  }

  const visibleItems = filter
    ? items.filter((x) => x.name.toLowerCase().includes(filter.toLowerCase()))
    : items

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg0)', position: 'relative' }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }}
      onDrop={handleDrop}
    >
      {/* Drag-in overlay */}
      {dragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(37,99,235,0.10)',
          border: '2px dashed var(--accent)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
            📁 Отпустите для загрузки в {cwd}
          </div>
        </div>
      )}

      {/* Transfer progress */}
      {transferProgress && (
        <div style={{
          position: 'absolute', bottom: 12, right: 12, zIndex: 40,
          background: 'var(--bg1)', border: '1px solid var(--border2)',
          borderRadius: 8, padding: '10px 14px', minWidth: 240,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text1)', marginBottom: 6 }}>
            {transferProgress.type === 'download' ? 'Скачивание' : 'Загрузка'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {transferProgress.file}
          </div>
          <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              width: `${transferProgress.percent}%`, 
              background: 'var(--accent)', 
              transition: 'width 0.2s ease' 
            }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'right', marginTop: 4 }}>
            {transferProgress.percent}%
          </div>
        </div>
      )}

      {/* Batch upload queue */}
      {uploads.length > 0 && (
        <div style={{
          position: 'absolute', bottom: transferProgress ? 120 : 12, right: 12, zIndex: 40,
          background: 'var(--bg1)', border: '1px solid var(--border2)',
          borderRadius: 8, padding: '8px 12px', minWidth: 220,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text1)', marginBottom: 6 }}>Очередь загрузки</div>
          {uploads.map((u, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>
              <span>{u.error ? '❌' : u.done ? '✅' : '⏳'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
              {u.error && <span style={{ color: 'var(--red)', fontSize: 10 }}>{u.error}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Breadcrumb toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px',
        background: 'var(--bg1)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button onClick={goUp} disabled={cwd === '/'}
          style={{ color: cwd === '/' ? 'var(--text3)' : 'var(--accent)', fontSize: 14, padding: '2px 6px', borderRadius: 4 }} title="Вверх">↑</button>
        <div style={{
          flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--text1)', background: 'var(--bg2)',
          padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border2)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{cwd}</div>
        <button onClick={() => readdir(cwd)}
          style={{ color: 'var(--text1)', fontSize: 14, padding: '2px 6px', borderRadius: 4 }} title="Обновить">↻</button>

        {/* Поиск по имени */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setFilter('')}
            placeholder="Фильтр..."
            style={{
              width: filter ? 130 : 80, fontSize: 11, padding: '3px 22px 3px 7px',
              borderRadius: 5, border: `1px solid ${filter ? 'var(--accent)' : 'var(--border2)'}`,
              background: 'var(--bg2)', color: 'var(--text0)', outline: 'none',
              transition: 'width .2s, border-color .15s', fontFamily: 'var(--font-mono)',
            }}
          />
          {filter && (
            <span onClick={() => setFilter('')} style={{
              position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
              cursor: 'pointer', fontSize: 12, color: 'var(--text3)',
              lineHeight: 1,
            }}>✕</span>
          )}
        </div>

        <div style={{ width: 1, height: 18, background: 'var(--border2)', margin: '0 2px' }} />

        {/* Скачать выбранный */}
        <TBtn onClick={downloadSelected} disabled={!selected} title="Скачать выбранный файл">↓ Скачать</TBtn>

        {/* Загрузить файлы */}
        <TBtn onClick={uploadFiles} title="Загрузить файлы на сервер">↑ Файлы</TBtn>

        {/* Загрузить папку */}
        <TBtn onClick={uploadFolder} title="Загрузить папку на сервер">↑ Папку</TBtn>

        <div style={{ width: 1, height: 18, background: 'var(--border2)', margin: '0 2px' }} />

        {/* Новая папка */}
        <TBtn onClick={async () => {
          const name = await askInput('Название новой папки:')
          if (!name) return
          const rp = remotePath(name)
          if (await window.api.sftp.existsRemote(id, rp)) {
            if (!confirm(`Папка «${name}» уже существует.`)) return
          }
          await window.api.sftp.mkdir(id, rp)
          readdir(cwd)
        }} title="Создать папку">+ Папка</TBtn>

        {/* Новый файл */}
        <TBtn onClick={async () => {
          const name = await askInput('Имя нового файла:')
          if (!name) return
          const rp = remotePath(name)
          if (await window.api.sftp.existsRemote(id, rp)) {
            if (!confirm(`Файл «${name}» уже существует.\nПерезаписать?`)) return
          }
          await window.api.sftp.writeText(id, rp, '')
          readdir(cwd)
          onOpenEditor?.(id, rp, name)
        }} title="Создать файл">+ Файл</TBtn>
      </div>

      {/* File list */}
      <div
        style={{ flex: 1, overflowY: 'auto' }}
        onContextMenu={(e) => {
          // ПКМ по пустому месту (не по строке файла)
          if (e.target.closest('tr[data-file]')) return
          e.preventDefault()
          setBgCtxMenu({ x: e.clientX, y: e.clientY })
        }}
        onClick={() => { setBgCtxMenu(null) }}
      >
        {loading && <StatusMsg icon="⏳" text="Loading..." />}
        {!loading && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--text2)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 14px', fontWeight: 500 }}>Name</th>
                <th style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 500 }}>Size</th>
                <th style={{ textAlign: 'right', padding: '6px 14px', fontWeight: 500 }}>Modified</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr
                  key={item.name}
                  data-file="1"
                  draggable={!item.isDir}
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => setSelected(item.name)}
                  onDoubleClick={() => openEdit(item)}
                  onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, item }) }}
      
                  style={{
                    background: selected === item.name ? 'var(--bg3)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background .1s',
                    opacity: transferring === item.name ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => { if (selected !== item.name) e.currentTarget.style.background = 'var(--bg2)' }}
                  onMouseLeave={(e) => { if (selected !== item.name) e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ padding: '5px 14px', fontSize: 12, color: 'var(--text0)' }}>
                    <span style={{ marginRight: 8 }}>
                      {item.isDir ? '📁' : isText(item.name) ? '📝' : '📄'}
                    </span>
                    <span style={{ color: item.name.startsWith('.') ? 'var(--text2)' : 'var(--text0)' }}>
                      {item.name}
                    </span>
                    {transferring === item.name && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--accent)' }}>…</span>
                    )}
                  </td>
                  <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--text2)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {item.isDir ? '' : fmt(item.size)}
                  </td>
                  <td style={{ padding: '5px 14px', fontSize: 11, color: 'var(--text2)', textAlign: 'right' }}>
                    {fmtDate(item.mtime)}
                  </td>
                </tr>
              ))}
              {visibleItems.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '20px 14px', color: 'var(--text2)', textAlign: 'center', fontSize: 12 }}>
                  {filter ? `Ничего не найдено по «${filter}»` : 'Empty directory'}
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      {inputModal}

      {ctxMenu && (
        <SftpCtxMenu
          x={ctxMenu.x} y={ctxMenu.y} item={ctxMenu.item}
          onOpen={() => { openEdit(ctxMenu.item); setCtxMenu(null) }}
          onDownload={() => { download(ctxMenu.item); setCtxMenu(null) }}
          onRename={() => { renameItem(ctxMenu.item); setCtxMenu(null) }}
          onCopyPath={() => {
            navigator.clipboard.writeText(remotePath(ctxMenu.item.name))
            setCtxMenu(null)
          }}
          onDelete={() => { deleteItem(ctxMenu.item); setCtxMenu(null) }}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {bgCtxMenu && (
        <BgCtxMenu
          x={bgCtxMenu.x} y={bgCtxMenu.y}
          onNewFile={async () => {
            setBgCtxMenu(null)
            const name = await askInput('Имя нового файла:')
            if (!name) return
            const rp = remotePath(name)
            if (await window.api.sftp.existsRemote(id, rp)) {
              if (!confirm(`Файл «${name}» уже существует.\nПерезаписать?`)) return
            }
            await window.api.sftp.writeText(id, rp, '')
            readdir(cwd)
            onOpenEditor?.(id, rp, name)
          }}
          onNewFolder={async () => {
            setBgCtxMenu(null)
            const name = await askInput('Название новой папки:')
            if (!name) return
            const rp = remotePath(name)
            if (await window.api.sftp.existsRemote(id, rp)) {
              if (!confirm(`Папка «${name}» уже существует.`)) return
            }
            await window.api.sftp.mkdir(id, rp)
            readdir(cwd)
          }}
          onUploadFiles={() => { setBgCtxMenu(null); uploadFiles() }}
          onUploadFolder={() => { setBgCtxMenu(null); uploadFolder() }}
          onRefresh={() => { setBgCtxMenu(null); readdir(cwd) }}
          onCopyPath={() => { navigator.clipboard.writeText(cwd); setBgCtxMenu(null) }}
          onClose={() => setBgCtxMenu(null)}
        />
      )}
    </div>
  )
}

function SftpCtxMenu({ x, y, item, onOpen, onDownload, onRename, onCopyPath, onDelete, onClose }) {
  useEffect(() => {
    const dismiss = () => onClose()
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
  }, [])

  const menuW = 210
  const left = Math.min(x, window.innerWidth - menuW - 4)
  const top  = Math.min(y, window.innerHeight - 200)

  return (
    <div
      style={{
        position: 'fixed', left, top, zIndex: 1000,
        background: 'var(--bg1)', border: '1px solid var(--border2)',
        borderRadius: 8, padding: '4px 0', minWidth: menuW,
        boxShadow: '0 4px 20px rgba(0,0,0,.12)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {item.isDir
        ? <CtxItem onClick={onOpen}>📁  Открыть</CtxItem>
        : <>
            <CtxItem onClick={onOpen}>✏️  Открыть / Редактировать</CtxItem>
            <CtxItem onClick={async () => {
              setTransferring(item.name)
              const localPath = await window.api.sftp.download(id, remotePath, `__asm_temp__${item.name}`)
              setTransferring(null)
              if (localPath.ok) setCopyStatus(`✅ «${item.name}» copied to clipboard`)
              else setCopyStatus(`❌ Error copying «${item.name}»`)
            }}>📋  Копировать содержимое</CtxItem>
            <CtxItem onClick={async () => { try {
              const item = items.find(x => x.name === selected)
              if (!item || item.isDir) return

              setTransferring(item.name)
              const progressId = item.name
              const progressCb = window.api.sftp.onProgress((data) => {
                if (data.file === progressId) setTransferProgress(data)
              })

              const result = await window.api.sftp.download(id, remotePath(item.name), `__asm_temp__${item.name}`)

              progressCb.off()
              setTransferProgress(null)
              setTransferring(null)

              if (result.ok) {
                try {
                  const textRes = await window.api.sftp.readText(id, remotePath(item.name))
                  await navigator.clipboard.writeText(textRes.content)
                  setCopyStatus(`✅ File copied: ${item.name}`)
                } catch {
                  setCopyStatus(`❌ Clipboard error`) 
                }
              } else {
                setCopyStatus(`❌ Copy failed`) 
              }
              setTimeout(() => setCopyStatus(null), 3000)
            } catch (err) {
              console.error(err)
              setTransferProgress(null)
              setTransferring(null)
              setCopyStatus('❌ Copy failed')
            }
            }}>📋 Copy content</CtxItem>
            <CtxItem onClick={onDownload}>↓ Download</CtxItem>
          </>
      }
      {item.isDir && <CtxItem onClick={onDownload}>↓  Скачать папку</CtxItem>}
      <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
      <CtxItem onClick={onRename}>✎  Переименовать</CtxItem>
      <CtxItem onClick={onCopyPath}>📋  Копировать путь</CtxItem>
      <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
      <CtxItem onClick={onDelete} danger>✕  Удалить{item.isDir ? ' папку' : ' файл'}</CtxItem>
    </div>
  )
}

function BgCtxMenu({ x, y, onNewFile, onNewFolder, onUploadFiles, onUploadFolder, onRefresh, onCopyPath, onClose }) {
  useEffect(() => {
    const dismiss = () => onClose()
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
  }, [])

  const menuW = 220
  const left = Math.min(x, window.innerWidth - menuW - 4)
  const top  = Math.min(y, window.innerHeight - 220)

  return (
    <div
      style={{
        position: 'fixed', left, top, zIndex: 1000,
        background: 'var(--bg1)', border: '1px solid var(--border2)',
        borderRadius: 8, padding: '4px 0', minWidth: menuW,
        boxShadow: '0 4px 20px rgba(0,0,0,.12)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <CtxItem onClick={onNewFile}>📝  Новый файл</CtxItem>
      <CtxItem onClick={onNewFolder}>📁  Новая папка</CtxItem>
      <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
      <CtxItem onClick={onUploadFiles}>↑  Загрузить файлы...</CtxItem>
      <CtxItem onClick={onUploadFolder}>↑  Загрузить папку...</CtxItem>
      <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
      <CtxItem onClick={onCopyPath}>📋  Копировать путь</CtxItem>
      <CtxItem onClick={onRefresh}>↻  Обновить</CtxItem>
    </div>
  )
}

function CtxItem({ children, onClick, danger, disabled }) {
  return (
    <div onClick={disabled ? undefined : onClick}
      style={{ padding: '7px 14px', fontSize: 12, cursor: disabled ? 'default' : 'pointer',
        color: danger ? 'var(--red)' : disabled ? 'var(--text3)' : 'var(--text0)' }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--bg2)' }}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >{children}</div>
  )
}

function TBtn({ children, onClick, disabled, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        fontSize: 11, padding: '4px 9px', borderRadius: 5, cursor: disabled ? 'default' : 'pointer',
        background: 'var(--bg3)', color: disabled ? 'var(--text3)' : 'var(--text1)',
        border: '1px solid var(--border2)', fontWeight: 500, whiteSpace: 'nowrap',
        transition: 'background .1s',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--bg4)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg3)' }}
    >{children}</button>
  )
}

function StatusMsg({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--text2)', fontSize: 13 }}>
      <span>{icon}</span><span>{text}</span>
    </div>
  )
}
