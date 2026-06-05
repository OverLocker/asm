import React, { useState, useEffect, useRef, useCallback } from 'react'
import SftpPanel from './SftpPanel'

let _cid = 0
const newSftpId = (side) => `sftp-cmd-${side}-${++_cid}`

export default function SftpCommander({ tab, onUpdate, onOpenEditor }) {
  const { allHosts = [] } = tab

  const [leftHost,  setLeftHost]  = useState(tab.leftHost  || null)
  const [rightHost, setRightHost] = useState(tab.rightHost || null)

  // id сессий — пересоздаём при смене хоста через key на SftpPanel
  const [leftKey,  setLeftKey]  = useState(0)
  const [rightKey, setRightKey] = useState(0)
  const leftId  = useRef(newSftpId('L'))
  const rightId = useRef(newSftpId('R'))

  const [activePanel, setActivePanel] = useState('left')
  const [ops, setOps] = useState([])
  const leftRef  = useRef(null)
  const rightRef = useRef(null)

  // Обновляем title при смене хостов
  useEffect(() => {
    const l = leftHost?.host  || '—'
    const r = rightHost?.host || '—'
    onUpdate?.({ status: 'connected', title: `⇄ ${l} / ${r}` })
  }, [leftHost, rightHost])

  // Внешний вызов: подключить хост в панель
  // Вызывается через tab.pendingPanel когда пользователь выбирает из сайдбара
  useEffect(() => {
    if (!tab.pendingHost || !tab.pendingPanel) return
    connectPanel(tab.pendingPanel, tab.pendingHost)
    // Сигнализируем App что обработали
    onUpdate?.({ pendingHost: null, pendingPanel: null })
  }, [tab.pendingHost, tab.pendingPanel])

  const connectPanel = useCallback((side, host) => {
    if (side === 'left') {
      leftId.current = newSftpId('L')
      setLeftHost(host)
      setLeftKey((k) => k + 1)
      setActivePanel('left')
    } else {
      rightId.current = newSftpId('R')
      setRightHost(host)
      setRightKey((k) => k + 1)
      setActivePanel('right')
    }
  }, [])

  // Прогресс: автоочистка через 1.8s после завершения
  useEffect(() => {
    const done = ops.filter((o) => o.done)
    if (!done.length) return
    const t = setTimeout(() => {
      setOps([])
      leftRef.current?.refresh()
      rightRef.current?.refresh()
    }, 1800)
    return () => clearTimeout(t)
  }, [ops])

  // Прогресс — управляется из copyTo + realtime events для медленных соединений
  const [copyError, setCopyError] = useState(null)
  const [fileProgress, setFileProgress] = useState({}) // { fileName: { transferred, total } }

  useEffect(() => {
    const off = window.api.sftp.onCopyProgress?.((data) => {
      if (!data.done && data.total > 0) {
        setFileProgress((prev) => ({ ...prev, [data.name]: { transferred: data.transferred, total: data.total } }))
      } else if (data.done) {
        setFileProgress((prev) => { const n = { ...prev }; delete n[data.name]; return n })
      }
    })
    return () => off?.()
  }, [])

  const copyTo = useCallback(async (move = false) => {
    const srcRef = activePanel === 'left' ? leftRef : rightRef
    const dstRef = activePanel === 'left' ? rightRef : leftRef
    const src = srcRef.current
    const dst = dstRef.current
    if (!src || !dst) return
    const sel = [...(src.selected || [])]
    if (!sel.length) return

    setCopyError(null)
    const srcPaths = sel.map((n) => src.cwd === '/' ? `/${n}` : `${src.cwd}/${n}`)

    // Показываем все файлы как "в процессе"
    const names = sel.map((n) => n)
    setOps(names.map((name) => ({ name, done: false })))

    src.setTransferring(true)
    dst.setTransferring(true)

    let res
    try {
      res = await window.api.sftp.copyRemote({
        srcId: src.sftpId, dstId: dst.sftpId,
        srcPaths, dstDir: dst.cwd, move,
      })
    } catch (e) {
      res = { ok: false, error: e.message }
    } finally {
      src.setTransferring(false)
      dst.setTransferring(false)
    }

    if (res?.ok) {
      // Помечаем все как done — через 1.8s исчезнут (через useEffect ниже)
      setOps(names.map((name) => ({ name, done: true })))
      src.refresh()
      dst.refresh()
    } else {
      setOps([])
      setCopyError(res?.error || 'Ошибка копирования')
      setTimeout(() => setCopyError(null), 5000)
    }
  }, [activePanel])

  // Клавиатура
  const handleKeyDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
    if (e.key === 'Tab') { e.preventDefault(); setActivePanel((p) => p === 'left' ? 'right' : 'left') }
    if (e.key === 'F5')  { e.preventDefault(); copyTo(false) }
    if (e.key === 'F6')  { e.preventDefault(); copyTo(true)  }
    if (e.key === 'F7')  { e.preventDefault(); (activePanel === 'left' ? leftRef : rightRef).current?.newFolder?.() }
    if (e.key === 'F8' || e.key === 'Delete') { e.preventDefault(); (activePanel === 'left' ? leftRef : rightRef).current?.deleteSelected?.() }
  }, [copyTo, activePanel])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg0)' }}>

      {/* ── Панели ── */}
      <div style={{ flex: 1, display: 'flex', gap: 3, padding: '3px 3px 0', minHeight: 0 }}>
        <SftpPanel
          key={`L-${leftKey}`}
          ref={leftRef}
          host={leftHost}
          sftpId={leftId.current}
          label="Левая"
          active={activePanel === 'left'}
          onActivate={() => setActivePanel('left')}
          onOpenEditor={onOpenEditor}
          allHosts={allHosts}
          onChangeHost={(h) => connectPanel('left', h)}
        />
        <SftpPanel
          key={`R-${rightKey}`}
          ref={rightRef}
          host={rightHost}
          sftpId={rightId.current}
          label="Правая"
          active={activePanel === 'right'}
          onActivate={() => setActivePanel('right')}
          onOpenEditor={onOpenEditor}
          allHosts={allHosts}
          onChangeHost={(h) => connectPanel('right', h)}
        />
      </div>

      {/* ── Прогресс ── */}
      {(ops.length > 0 || Object.keys(fileProgress).length > 0) && (
        <div style={{ margin: '2px 3px 0', padding: '4px 10px', background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 5, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ops.map((o, i) => {
            const prog = fileProgress[o.name]
            const pct = prog && prog.total > 0 ? Math.round(prog.transferred / prog.total * 100) : null
            const fmt = (b) => b < 1024*1024 ? `${(b/1024).toFixed(0)}K` : `${(b/1024/1024).toFixed(1)}M`
            return (
              <div key={i}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: o.done ? 'var(--green)' : 'var(--amber)' }}>
                    {o.done ? '✓' : '⏳'}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                  {prog && !o.done && (
                    <span style={{ color: 'var(--text3)', flexShrink: 0 }}>
                      {fmt(prog.transferred)}{prog.total > 0 ? ` / ${fmt(prog.total)}` : ''}{pct != null ? ` ${pct}%` : ''}
                    </span>
                  )}
                </div>
                {prog && prog.total > 0 && !o.done && (
                  <div style={{ height: 3, background: 'var(--border2)', borderRadius: 2, marginTop: 2 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width .3s' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {copyError && (
        <div style={{ margin: '2px 3px 0', padding: '4px 10px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 5, fontSize: 11, color: 'var(--red)' }}>
          ✗ {copyError}
        </div>
      )}

      {/* ── Кнопки ── */}
      <div style={{ display: 'flex', gap: 3, padding: '3px 3px', background: 'var(--bg1)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <FnBtn label="F5" desc={activePanel === 'left' ? 'Копировать →' : '← Копировать'} onClick={() => copyTo(false)} accent />
        <FnBtn label="F6" desc={activePanel === 'left' ? 'Переместить →' : '← Переместить'} onClick={() => copyTo(true)} />
        <FnBtn label="F7" desc="Папку" onClick={() => (activePanel === 'left' ? leftRef : rightRef).current?.newFolder?.()} />
        <FnBtn label="F8" desc="Удалить" onClick={() => (activePanel === 'left' ? leftRef : rightRef).current?.deleteSelected?.()} danger />
        <div style={{ flex: 1 }} />
        <FnBtn label="=" desc="Синхр. путь" onClick={() => {
          const src = (activePanel === 'left' ? leftRef : rightRef).current
          const dst = (activePanel === 'left' ? rightRef : leftRef).current
          if (src && dst) dst.navigate(src.cwd)
        }} />
        <FnBtn label="Tab" desc="Сменить панель" onClick={() => setActivePanel((p) => p === 'left' ? 'right' : 'left')} />
      </div>
    </div>
  )
}

function FnBtn({ label, desc, onClick, accent, danger }) {
  const bg      = accent ? 'var(--accent)' : danger ? 'rgba(220,38,38,0.1)' : 'var(--bg3)'
  const color   = accent ? '#fff' : danger ? 'var(--red)' : 'var(--text1)'
  const hoverBg = accent ? '#1d4ed8' : danger ? 'rgba(220,38,38,0.2)' : 'var(--bg4)'
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 5,
      background: bg, color, border: `1px solid ${danger ? 'rgba(220,38,38,0.3)' : accent ? 'transparent' : 'var(--border2)'}`,
      fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer',
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = hoverBg}
      onMouseLeave={(e) => e.currentTarget.style.background = bg}
    >
      <span style={{ fontSize: 9, fontWeight: 700, background: accent ? 'rgba(255,255,255,0.2)' : 'var(--bg4)', color: accent ? '#fff' : 'var(--text2)', padding: '1px 4px', borderRadius: 3 }}>{label}</span>
      {desc}
    </button>
  )
}
