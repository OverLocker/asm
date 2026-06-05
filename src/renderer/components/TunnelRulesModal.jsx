import React, { useState } from 'react'

// Правило: { id, name, direction: 'local'|'remote', localPort, remoteHost, remotePort, enabled }

const EMPTY_RULE = { name: '', direction: 'local', localPort: '', remoteHost: 'localhost', remotePort: '', enabled: true }

export default function TunnelRulesModal({ rules, onSave, onClose }) {
  const [draft, setDraft] = useState(rules.map((r) => ({ ...r })))
  const [editId, setEditId] = useState(null) // id редактируемого правила

  const editingRule = draft.find((r) => r.id === editId) || null

  const setRule = (id, patch) =>
    setDraft((d) => d.map((r) => r.id === id ? { ...r, ...patch } : r))

  const addRule = () => {
    const id = `tr-${Date.now()}`
    const r  = { ...EMPTY_RULE, id }
    setDraft((d) => [...d, r])
    setEditId(id)
  }

  const deleteRule = (id) => {
    setDraft((d) => d.filter((r) => r.id !== id))
    if (editId === id) setEditId(null)
  }

  const toggleEnabled = (id) =>
    setRule(id, { enabled: !draft.find((r) => r.id === id).enabled })

  const handleSave = () => { onSave(draft); onClose() }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={onClose}
    >
      <div
        style={{ background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 12, width: 660, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '15px 20px 13px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text0)' }}>🔌 Глобальные туннели</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 18 }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text0)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text3)'}
          >×</button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

          {/* Левая колонка — список правил */}
          <div style={{ width: 240, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {draft.length === 0 && (
                <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                  Нет правил.<br />Нажмите + чтобы добавить.
                </div>
              )}
              {draft.map((rule) => (
                <div
                  key={rule.id}
                  onClick={() => setEditId(rule.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', cursor: 'pointer',
                    background: editId === rule.id ? 'var(--bg2)' : 'transparent',
                    borderLeft: editId === rule.id ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                  onMouseEnter={(e) => { if (editId !== rule.id) e.currentTarget.style.background = 'var(--bg2)' }}
                  onMouseLeave={(e) => { if (editId !== rule.id) e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Тоггл включён/выключен */}
                  <div
                    onClick={(e) => { e.stopPropagation(); toggleEnabled(rule.id) }}
                    style={{
                      width: 28, height: 16, borderRadius: 8, flexShrink: 0,
                      background: rule.enabled ? 'var(--accent)' : 'var(--bg4)',
                      position: 'relative', cursor: 'pointer',
                      border: '1px solid var(--border2)', transition: 'background .2s',
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 1,
                      left: rule.enabled ? 13 : 1,
                      width: 12, height: 12, borderRadius: '50%',
                      background: '#fff', transition: 'left .2s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: rule.enabled ? 'var(--text0)' : 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rule.name || `Правило ${rule.id.slice(-4)}`}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                      {rule.direction === 'local' ? 'L' : 'R'} :{rule.localPort} → {rule.remoteHost}:{rule.remotePort}
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); deleteRule(rule.id) }}
                    style={{ color: 'var(--text3)', fontSize: 14, padding: '0 2px', flexShrink: 0 }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--red)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text3)'}
                  >×</button>
                </div>
              ))}
            </div>
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <button
                onClick={addRule}
                style={{
                  width: '100%', padding: '6px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg2)'}
              >
                <span style={{ fontSize: 14 }}>+</span> Новое правило
              </button>
            </div>
          </div>

          {/* Правая колонка — редактор */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
            {!editingRule && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 12 }}>
                Выберите правило или создайте новое
              </div>
            )}
            {editingRule && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                <Field label="Название">
                  <input
                    value={editingRule.name}
                    onChange={(e) => setRule(editingRule.id, { name: e.target.value })}
                    placeholder="Например: Database tunnel"
                    style={{ width: '100%' }}
                    autoFocus
                  />
                </Field>

                <Field label="Направление">
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { value: 'local',  label: 'Local (-L)',   desc: 'Ты → удалённая сеть' },
                      { value: 'remote', label: 'Remote (-R)',  desc: 'Удалённая машина → ты' },
                      { value: 'socks',  label: 'SOCKS5 (-D)', desc: 'Динамический прокси' },
                    ].map((opt) => {
                      const active = editingRule.direction === opt.value
                      return (
                        <button key={opt.value} onClick={() => setRule(editingRule.id, { direction: opt.value })} style={{
                          flex: 1, padding: '8px 10px', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                          border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                          background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text0)', fontFamily: 'var(--font-mono)' }}>{opt.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>{opt.desc}</div>
                        </button>
                      )
                    })}
                  </div>
                </Field>

                {/* Схема портов */}
                <Field label="Порты">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>
                        {editingRule.direction === 'socks' ? 'Локальный SOCKS-порт' : editingRule.direction === 'local' ? 'Локальный порт' : 'Порт на сервере'}
                      </div>
                      <input
                        value={editingRule.localPort}
                        onChange={(e) => setRule(editingRule.id, { localPort: e.target.value.replace(/\D/g, '') })}
                        placeholder={editingRule.direction === 'socks' ? '1080' : '8080'}
                        style={{ width: 80, fontFamily: 'var(--font-mono)', textAlign: 'center' }}
                      />
                    </div>
                    {editingRule.direction !== 'socks' && (
                      <>
                        <div style={{ color: 'var(--text3)', fontSize: 18, marginTop: 16 }}>→</div>
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>
                            {editingRule.direction === 'local' ? 'Хост в сети сервера' : 'Локальный хост'}
                          </div>
                          <input
                            value={editingRule.remoteHost}
                            onChange={(e) => setRule(editingRule.id, { remoteHost: e.target.value })}
                            placeholder="localhost"
                            style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Порт</div>
                          <input
                            value={editingRule.remotePort}
                            onChange={(e) => setRule(editingRule.id, { remotePort: e.target.value.replace(/\D/g, '') })}
                            placeholder="5432"
                            style={{ width: 80, fontFamily: 'var(--font-mono)', textAlign: 'center' }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  {/* SSH команда для наглядности */}
                  <div style={{ marginTop: 10, padding: '6px 10px', background: 'var(--bg2)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>
                    {editingRule.direction === 'socks'
                      ? `ssh -D ${editingRule.localPort || '1080'} [host]`
                      : editingRule.localPort && editingRule.remotePort
                        ? `ssh -${editingRule.direction === 'local' ? 'L' : 'R'} ${editingRule.localPort}:${editingRule.remoteHost}:${editingRule.remotePort} [host]`
                        : '—'
                    }
                  </div>
                </Field>

                <Field label="Включено">
                  <Toggle
                    value={editingRule.enabled}
                    onChange={(v) => setRule(editingRule.id, { enabled: v })}
                    label={editingRule.enabled ? 'Применять при подключении' : 'Отключено'}
                  />
                </Field>

              </div>
            )}
          </div>
        </div>

        {/* Подвал */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            Применяются к хостам с признаком «Проброс» (ПКМ на хосте)
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ fontSize: 12, color: 'var(--text1)', padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg2)' }}>
            Отмена
          </button>
          <button onClick={handleSave} style={{ fontSize: 12, fontWeight: 600, color: '#fff', padding: '6px 20px', borderRadius: 6, background: 'var(--accent)', border: 'none', cursor: 'pointer' }}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
      {children}
    </div>
  )
}

function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div onClick={() => onChange(!value)} style={{
        width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
        background: value ? 'var(--accent)' : 'var(--bg4)',
        position: 'relative', transition: 'background .2s',
        border: '1px solid var(--border2)',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: value ? 17 : 2,
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      <span style={{ fontSize: 12, color: 'var(--text1)' }}>{label}</span>
    </div>
  )
}
