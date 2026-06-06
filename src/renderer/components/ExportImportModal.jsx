import React, { useState, useEffect } from 'react'

function ExportImportModal({ hosts, groups, onClose, onImported }) {
  const [tab, setTab] = useState('export')
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={onClose}>
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 12, width: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}
        onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text0)' }}>📦 Экспорт / Импорт</span>
          <div style={{ display: 'flex', gap: 6, marginLeft: 20 }}>
            {['export','import'].map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '4px 14px', borderRadius: 6, fontSize: 12, fontWeight: tab===t ? 600 : 400, cursor: 'pointer', background: tab===t ? 'var(--accent)' : 'var(--bg2)', color: tab===t ? '#fff' : 'var(--text2)', border: tab===t ? 'none' : '1px solid var(--border2)' }}>
                {t==='export' ? '↑ Экспорт' : '↓ Импорт'}
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 18 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab==='export' ? <ExportPanel hosts={hosts} groups={groups} onClose={onClose}/> : <ImportPanel onClose={onClose} onImported={onImported}/>}
        </div>
      </div>
    </div>
  )
}

function ExportPanel({ hosts, groups, onClose }) {
  const [sel, setSel] = useState(() => new Set(hosts.map((h) => h.host)))
  const [incGroups, setIncGroups] = useState(true)
  const [incNotes,  setIncNotes]  = useState(true)
  const [incColors, setIncColors] = useState(true)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const toggle = (h) => setSel((s) => { const n=new Set(s); n.has(h)?n.delete(h):n.add(h); return n })
  const doExport = async () => {
    setSaving(true); setResult(null)
    const res = await window.api.asm.export({ hostNames: sel.size < hosts.length ? [...sel] : null, includeGroups: incGroups, includeNotes: incNotes, includeColors: incColors })
    setSaving(false); setResult(res)
  }
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Хосты ({sel.size}/{hosts.length})</span>
          <button onClick={() => setSel(new Set(hosts.map((h) => h.host)))} style={{ fontSize: 10, color: 'var(--accent)', cursor: 'pointer' }}>все</button>
          <button onClick={() => setSel(new Set())} style={{ fontSize: 10, color: 'var(--text3)', cursor: 'pointer' }}>снять</button>
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto', background: 'var(--bg2)', borderRadius: 7, border: '1px solid var(--border2)' }}>
          {hosts.map((h) => (
            <label key={h.host} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
              className="hov-bg3">
              <input type="checkbox" checked={sel.has(h.host)} onChange={() => toggle(h.host)} style={{ accentColor: 'var(--accent)' }}/>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text0)' }}>{h.host}</span>
              <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>{h.user ? h.user+'@' : ''}{h.hostname}{h.port!==22 ? ':'+h.port : ''}</span>
            </label>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Включить</span>
        {[[incGroups,setIncGroups,'Группы и иерархия'],[incNotes,setIncNotes,'Заметки к хостам'],[incColors,setIncColors,'Цвета меток']].map(([v,s,l],i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text0)' }}>
            <input type="checkbox" checked={v} onChange={(e) => s(e.target.checked)} style={{ accentColor: 'var(--accent)' }}/>{l}
          </label>
        ))}
      </div>
      {result && <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 6, background: result.ok ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.08)', color: result.ok ? 'var(--green)' : 'var(--red)' }}>
        {result.ok ? `✓ Экспортировано ${result.count} записей` : `✗ ${result.error}`}
      </div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ fontSize: 12, color: 'var(--text1)', padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg2)', cursor: 'pointer' }}>Закрыть</button>
        <button onClick={doExport} disabled={saving || sel.size===0} style={{ fontSize: 12, fontWeight: 600, color: '#fff', padding: '6px 20px', borderRadius: 6, background: 'var(--accent)', border: 'none', cursor: 'pointer', opacity: (saving||sel.size===0) ? 0.6 : 1 }}>
          {saving ? 'Сохраняю…' : `↑ Экспортировать (${sel.size})`}
        </button>
      </div>
    </div>
  )
}

function ImportPanel({ onClose, onImported }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [sel, setSel] = useState(new Set())
  const [targetFile, setTargetFile] = useState('')
  const [files, setFiles] = useState([])
  const [incGroups, setIncGroups] = useState(true)
  const [incNotes, setIncNotes] = useState(true)
  const [incColors, setIncColors] = useState(true)

  useEffect(() => { window.api.sshConfig.listFiles().then((l) => { setFiles(l); if (l.length) setTargetFile(l[0].path) }) }, [])

  const doLoad = async () => {
    setLoading(true); setError('')
    const res = await window.api.asm.import()
    setLoading(false)
    if (res.canceled) return
    if (!res.ok) { setError(res.error || 'Ошибка'); return }
    setData(res.data); setSel(new Set(res.data.hosts.map((h) => h.name)))
  }
  const toggle = (n) => setSel((s) => { const x=new Set(s); x.has(n)?x.delete(n):x.add(n); return x })
  const doApply = async () => {
    setApplying(true); setError('')
    const res = await window.api.asm.applyImport(
      { hosts: data.hosts.filter((h) => sel.has(h.name)), sessions: data.sessions, groups: incGroups ? data.groups : null, notes: incNotes ? data.notes : null, hostSettings: incColors ? data.hostSettings : null },
      { targetFile }
    )
    setApplying(false)
    if (res.ok) { setDone(true); onImported?.() }
    else setError(res.error || 'Ошибка импорта')
  }

  if (done) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--green)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Импорт завершён</div>
      <button onClick={onClose} style={{ marginTop: 20, padding: '7px 20px', borderRadius: 7, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Закрыть</button>
    </div>
  )

  if (!data) return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>Выберите файл экспорта ASM (.json)</div>
      {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ fontSize: 12, color: 'var(--text1)', padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg2)', cursor: 'pointer' }}>Отмена</button>
        <button onClick={doLoad} disabled={loading} style={{ fontSize: 12, fontWeight: 600, color: '#fff', padding: '6px 20px', borderRadius: 6, background: 'var(--accent)', border: 'none', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Загружаю…' : '↓ Выбрать файл'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
        {new Date(data.exportedAt).toLocaleString('ru-RU')} · {data.hosts.length} SSH · {data.sessions?.length || 0} других
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 6 }}>Хосты ({sel.size})</div>
        <div style={{ maxHeight: 180, overflowY: 'auto', background: 'var(--bg2)', borderRadius: 7, border: '1px solid var(--border2)' }}>
          {data.hosts.map((h) => (
            <label key={h.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
              className="hov-bg3">
              <input type="checkbox" checked={sel.has(h.name)} onChange={() => toggle(h.name)} style={{ accentColor: 'var(--accent)' }}/>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text0)' }}>{h.name}</span>
              <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>{h.user ? h.user+'@' : ''}{h.hostname}</span>
            </label>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.groups && <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text0)' }}><input type="checkbox" checked={incGroups} onChange={(e) => setIncGroups(e.target.checked)} style={{ accentColor: 'var(--accent)' }}/>Группы</label>}
        {data.notes  && <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text0)' }}><input type="checkbox" checked={incNotes}  onChange={(e) => setIncNotes(e.target.checked)}  style={{ accentColor: 'var(--accent)' }}/>Заметки</label>}
        {data.hostSettings && <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text0)' }}><input type="checkbox" checked={incColors} onChange={(e) => setIncColors(e.target.checked)} style={{ accentColor: 'var(--accent)' }}/>Цвета</label>}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 6 }}>Записать в файл</div>
        <select value={targetFile} onChange={(e) => setTargetFile(e.target.value)} style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text0)', padding: '6px 10px' }}>
          {files.map((f) => <option key={f.path} value={f.path}>{f.label}</option>)}
        </select>
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => setData(null)} style={{ fontSize: 12, color: 'var(--text1)', padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg2)', cursor: 'pointer' }}>← Назад</button>
        <button onClick={doApply} disabled={applying || sel.size===0} style={{ fontSize: 12, fontWeight: 600, color: '#fff', padding: '6px 20px', borderRadius: 6, background: 'var(--accent)', border: 'none', cursor: 'pointer', opacity: (applying||sel.size===0) ? 0.6 : 1 }}>
          {applying ? 'Импортирую…' : `↓ Импортировать (${sel.size})`}
        </button>
      </div>
    </div>
  )
}

export default React.memo(ExportImportModal)
