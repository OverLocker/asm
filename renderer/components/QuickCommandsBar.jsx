import React, { useState, useEffect, useCallback } from 'react'

const COLORS = ['#6366f1', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0d9488']
const uid = () => Math.random().toString(36).slice(2, 8)

// ─── Модал добавления / редактирования ────────────────────────────────────
function CmdModal({ cmd, onSave, onDelete, onClose }) {
  const [name,    setName]    = useState(cmd?.name    || '')
  const [command, setCommand] = useState(cmd?.command || '')
  const [color,   setColor]   = useState(cmd?.color   || COLORS[0])
  const isNew = !cmd?.id
  const ok = name.trim() && command.trim()

  const doSave = () => ok && onSave({ id: cmd?.id || uid(), name: name.trim(), command: command.trim(), color })

  return (
    <div style={{ position:'fixed', inset:0, zIndex:4000, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--bg1)', border:'1px solid var(--border2)', borderRadius:10, padding:20, width:380, boxShadow:'0 8px 32px rgba(0,0,0,0.2)', display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ fontWeight:600, fontSize:14, color:'var(--text0)' }}>
          {isNew ? '+ Новая команда' : '✎ Редактировать команду'}
        </div>
        <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:11, color:'var(--text2)' }}>
          Название (текст кнопки)
          <input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="напр. Restart nginx" style={inp} />
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:11, color:'var(--text2)' }}>
          Команда
          <input value={command} onChange={e=>setCommand(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSave()} placeholder="напр. systemctl restart nginx" style={{ ...inp, fontFamily:'var(--font-mono)' }} />
        </label>
        <label style={{ display:'flex', flexDirection:'column', gap:6, fontSize:11, color:'var(--text2)' }}>
          Цвет
          <div style={{ display:'flex', gap:6 }}>
            {COLORS.map(c => (
              <div key={c} onClick={()=>setColor(c)} style={{ width:22, height:22, borderRadius:4, background:c, cursor:'pointer', boxSizing:'border-box', border:c===color?'2px solid var(--text0)':'2px solid transparent' }} />
            ))}
          </div>
          <button style={{ alignSelf:'flex-start', fontSize:11, padding:'2px 12px', borderRadius:4, background:color+'22', color, border:`1px solid ${color}55`, fontWeight:500, cursor:'default' }}>
            {name || 'Название'}
          </button>
        </label>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', paddingTop:4, borderTop:'1px solid var(--border)' }}>
          {!isNew && <button onClick={()=>onDelete(cmd.id)} style={{ ...btn, color:'var(--red)', marginRight:'auto' }}>Удалить</button>}
          <button onClick={onClose} style={btn}>Отмена</button>
          <button onClick={doSave} style={{ ...btn, background:ok?'var(--accent)':'var(--bg3)', color:ok?'#fff':'var(--text3)', border:'none' }}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}

// ─── Модал управления списком ──────────────────────────────────────────────
function ManageModal({ cmds, onEdit, onDelete, onAdd, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:4000, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--bg1)', border:'1px solid var(--border2)', borderRadius:10, width:420, maxHeight:'70vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 32px rgba(0,0,0,0.2)', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', padding:'14px 18px 12px', borderBottom:'1px solid var(--border)' }}>
          <span style={{ fontWeight:600, fontSize:14, color:'var(--text0)' }}>⚡ Быстрые команды</span>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'none', border:'none', fontSize:18, color:'var(--text3)', cursor:'pointer' }}>×</button>
        </div>
        <div style={{ overflowY:'auto', flex:1 }}>
          {cmds.length === 0
            ? <div style={{ padding:'24px 18px', fontSize:13, color:'var(--text3)', textAlign:'center' }}>Список пуст — добавьте первую команду</div>
            : cmds.map(cmd => (
              <div key={cmd.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 18px', borderBottom:'1px solid var(--border)' }}
                className="hov-bg"
              >
                <div style={{ width:10, height:10, borderRadius:2, background:cmd.color, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text0)' }}>{cmd.name}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--font-mono)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cmd.command}</div>
                </div>
                <button onClick={()=>onEdit(cmd)} style={{ ...btn, fontSize:11, padding:'2px 10px' }}>✎</button>
                <button onClick={()=>onDelete(cmd.id)} style={{ ...btn, fontSize:11, padding:'2px 10px', color:'var(--red)' }}>✕</button>
              </div>
            ))
          }
        </div>
        <div style={{ padding:'10px 18px', borderTop:'1px solid var(--border)' }}>
          <button onClick={onAdd} style={{ ...btn, background:'var(--accent)', color:'#fff', border:'none', width:'100%', padding:'6px' }}>+ Добавить команду</button>
        </div>
      </div>
    </div>
  )
}

const inp = { fontSize:12, padding:'6px 10px', borderRadius:6, outline:'none', border:'1px solid var(--border2)', background:'var(--bg2)', color:'var(--text0)', width:'100%', boxSizing:'border-box' }
const btn = { fontSize:12, padding:'5px 14px', borderRadius:6, cursor:'pointer', background:'var(--bg2)', color:'var(--text1)', border:'1px solid var(--border2)' }

// ─── Полоска ───────────────────────────────────────────────────────────────
function QuickCommandsBar({ onSend }) {
  const [cmds,  setCmds]  = useState([])
  const [modal, setModal] = useState(null) // null | 'manage' | 'new' | cmd-object

  // Загружаем из файла при монтировании
  useEffect(() => {
    window.api.quickCommands.load().then(data => {
      if (Array.isArray(data)) setCmds(data)
    })
  }, [])

  const persist = useCallback((next) => {
    setCmds(next)
    window.api.quickCommands.save(next)
  }, [])

  const handleSave = useCallback((cmd) => {
    persist(cmds.find(c=>c.id===cmd.id) ? cmds.map(c=>c.id===cmd.id?cmd:c) : [...cmds, cmd])
    setModal(prev => prev === 'new' ? null : 'manage')
  }, [cmds, persist])

  const handleDelete = useCallback((id) => {
    persist(cmds.filter(c=>c.id!==id))
    setModal(prev => prev?.id ? 'manage' : null)
  }, [cmds, persist])

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', flexShrink:0, borderTop:'1px solid var(--border)', background:'var(--bg0)', minHeight:26 }}>
        <span style={{ fontSize:9, fontWeight:700, color:'var(--text3)', flexShrink:0 }}>⚡</span>
        <div style={{ display:'flex', gap:5, flex:1, overflow:'hidden', alignItems:'center' }}>
          {cmds.length === 0
            ? <span style={{ fontSize:11, color:'var(--text3)', fontStyle:'italic' }}>Нет команд — нажмите +</span>
            : cmds.map(cmd => (
              <button key={cmd.id} onClick={()=>onSend(cmd.command+'\n')} title={cmd.command}
                style={{ fontSize:11, padding:'1px 10px', borderRadius:4, cursor:'pointer', background:cmd.color+'22', color:cmd.color, border:`1px solid ${cmd.color}55`, fontWeight:500, whiteSpace:'nowrap', flexShrink:0 }}
              >{cmd.name}</button>
            ))
          }
        </div>
        <button onClick={()=>setModal('manage')} title="Управление командами"
          style={{ fontSize:11, padding:'1px 8px', borderRadius:4, flexShrink:0, background:'transparent', color:'var(--text3)', border:'1px solid var(--border2)', cursor:'pointer' }}
          className="hov-border-accent"
        >✎</button>
        <button onClick={()=>setModal('new')} title="Добавить команду"
          style={{ fontSize:14, width:20, height:20, borderRadius:4, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', color:'var(--text3)', border:'1px solid var(--border2)', cursor:'pointer', lineHeight:1, padding:0 }}
          className="hov-border-accent"
        >+</button>
      </div>

      {modal === 'manage' && <ManageModal cmds={cmds} onEdit={cmd=>setModal(cmd)} onDelete={handleDelete} onAdd={()=>setModal('new')} onClose={()=>setModal(null)} />}
      {(modal === 'new' || (modal && modal !== 'manage')) && (
        <CmdModal cmd={modal==='new'?null:modal} onSave={handleSave} onDelete={handleDelete} onClose={()=>setModal(modal==='new'?null:'manage')} />
      )}
    </>
  )
}

export default React.memo(QuickCommandsBar)
