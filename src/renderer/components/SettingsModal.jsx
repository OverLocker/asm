import React, { useState, useCallback } from 'react'
import {
  TERM_THEMES,
  PRESET_BACKGROUNDS,
  FONT_OPTIONS,
  DEFAULT_SETTINGS,
  UI_THEMES,
  applyUITheme,
  buildXtermTheme,
} from '../termSettings'

const SECTIONS = [
  { id: 'theme',      label: 'Тема' },
  { id: 'terminal',   label: 'Терминал' },
  { id: 'background', label: 'Фон' },
  { id: 'font',       label: 'Шрифт' },
  { id: 'cursor',     label: 'Курсор' },
  { id: 'interface',  label: 'Интерфейс' },
  { id: 'connection', label: 'Подключение' },
  { id: 'browser',    label: 'Браузер' },
]

export default function SettingsModal({ settings, onSave, onClose }) {
  const [draft,   setDraft]   = useState({ ...settings })
  const [section, setSection] = useState('terminal')

  const set = useCallback((key, value) => {
    setDraft((d) => ({ ...d, [key]: value }))
    // Живой превью темы
    if (key === 'uiTheme') applyUITheme(value)
  }, [])

  const preview = buildXtermTheme(draft)

  const handleSave  = () => { onSave(draft); onClose() }
  const handleReset = () => {
    setDraft({ ...DEFAULT_SETTINGS })
    applyUITheme(DEFAULT_SETTINGS.uiTheme)
  }
  const handleClose = () => {
    // Восстановить исходную тему если не сохранили
    applyUITheme(settings.uiTheme || 'Light')
    onClose()
  }

  const pickImage = async () => {
    const result = await window.api.dialog.openImage()
    if (!result) return
    // Сохраняем data URL — он работает в renderer без file:// ограничений
    set('bgImage', result.dataUrl)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={onClose}
    >
      <div
        style={{ background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 12, width: 640, height: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '15px 20px 13px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text0)' }}>Настройки</span>
          <button onClick={handleClose} style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 18, lineHeight: 1 }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text0)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text3)'}
          >×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Левая панель — секции */}
          <div style={{ width: 148, flexShrink: 0, borderRight: '1px solid var(--border)', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => setSection(s.id)} style={{
                textAlign: 'left', padding: '7px 16px', fontSize: 12,
                fontWeight: section === s.id ? 600 : 400,
                color:      section === s.id ? 'var(--accent)' : 'var(--text1)',
                background: section === s.id ? 'rgba(37,99,235,0.08)' : 'transparent',
                borderLeft: section === s.id ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
              }}>{s.label}</button>
            ))}
          </div>

          {/* Правая панель */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

            {/* ── Тема интерфейса ──────────────────────────────────────── */}
            {section === 'theme' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field label="Тема интерфейса">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[...Object.keys(UI_THEMES), 'System'].map((name) => {
                      const active = draft.uiTheme === name
                      const colors = UI_THEMES[name] || UI_THEMES['Light']
                      return (
                        <button
                          key={name}
                          onClick={() => set('uiTheme', name)}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: 6,
                            padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                            border: active ? '2px solid var(--accent)' : '1px solid var(--border2)',
                            background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)',
                          }}
                        >
                          {/* Мини-превью палитры */}
                          <div style={{ display: 'flex', gap: 3, height: 20, borderRadius: 4, overflow: 'hidden' }}>
                            {[colors['--bg1'] || '#fff', colors['--bg2'] || '#eee', colors['--accent'] || '#2563eb', colors['--text0'] || '#111'].map((c, i) => (
                              <div key={i} style={{ flex: 1, background: c }} />
                            ))}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? 'var(--accent)' : 'var(--text0)' }}>
                            {name === 'System' ? '⚙ Системная' : name}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </Field>
              </div>
            )}

            {/* ── Терминал ─────────────────────────────────────────────── */}
            {section === 'terminal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                <Field label="Цветовая схема">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {Object.keys(TERM_THEMES).map((name) => {
                      const t = TERM_THEMES[name]
                      const active = draft.themeName === name
                      return (
                        <button key={name} onClick={() => set('themeName', name)} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7,
                          border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                          background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)', cursor: 'pointer', textAlign: 'left',
                        }}>
                          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                            {[t.red, t.green, t.yellow, t.blue, t.magenta, t.cyan].map((c, i) => (
                              <div key={i} style={{ width: 7, height: 14, borderRadius: 2, background: c }} />
                            ))}
                          </div>
                          <span style={{ fontSize: 11, color: active ? 'var(--accent)' : 'var(--text1)', fontWeight: active ? 600 : 400 }}>{name}</span>
                        </button>
                      )
                    })}
                  </div>
                </Field>

              </div>
            )}

            {/* ── Фон ──────────────────────────────────────────────────── */}
            {section === 'background' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                <Field label="Цвет фона">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {PRESET_BACKGROUNDS.map((p) => {
                      const active = draft.background === p.value
                      return (
                        <button key={p.value} onClick={() => set('background', p.value)} title={p.label} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6,
                          border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                          background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)', cursor: 'pointer',
                        }}>
                          <div style={{ width: 14, height: 14, borderRadius: 3, background: p.value, border: '1px solid var(--border2)' }} />
                          <span style={{ fontSize: 11, color: active ? 'var(--accent)' : 'var(--text1)' }}>{p.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="color" value={draft.background} onChange={(e) => set('background', e.target.value)}
                      style={{ width: 32, height: 28, padding: 2, cursor: 'pointer', border: '1px solid var(--border2)', borderRadius: 5, background: 'var(--bg2)' }}
                    />
                    <input value={draft.background}
                      onChange={(e) => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) set('background', v) }}
                      style={{ width: 90, fontFamily: 'var(--font-mono)', fontSize: 12 }} placeholder="#1e1e2e"
                    />
                  </div>
                </Field>

                <Field label={`Прозрачность цвета — ${Math.round(draft.opacity * 100)}%`}>
                  <input type="range" min="20" max="100" step="1"
                    value={Math.round(draft.opacity * 100)}
                    onChange={(e) => set('opacity', parseInt(e.target.value) / 100)}
                    style={{ width: '100%' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>Прозрачный</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>Непрозрачный</span>
                  </div>
                  {draft.opacity < 1 && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--amber)' }}>
                      ⚠ Требует compositor (Picom, KWin, Mutter)
                    </div>
                  )}
                </Field>

                {/* Разделитель */}
                <div style={{ height: 1, background: 'var(--border)' }} />

                <Field label="Фоновое изображение">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    {/* Превью картинки */}
                    <div style={{
                      width: 80, height: 56, borderRadius: 6, flexShrink: 0,
                      border: '1px solid var(--border2)', background: 'var(--bg2)',
                      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {draft.bgImage
                        ? <img src={draft.bgImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="bg" />
                        : <span style={{ fontSize: 20, color: 'var(--text3)' }}>🖼</span>
                      }
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button onClick={pickImage} style={{
                        padding: '7px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                        border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text0)',
                        textAlign: 'left',
                      }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg3)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg2)'}
                      >
                        📂 Выбрать файл…
                      </button>
                      {draft.bgImage && (
                        <button onClick={() => set('bgImage', '')} style={{
                          padding: '5px 14px', borderRadius: 7, fontSize: 11, cursor: 'pointer',
                          border: '1px solid var(--border2)', background: 'transparent', color: 'var(--red)',
                        }}>Убрать картинку</button>
                      )}
                    </div>
                  </div>
                </Field>

                {draft.bgImage && (
                  <Field label={`Яркость картинки — ${Math.round(draft.bgImageOpacity * 100)}%`}>
                    <input type="range" min="5" max="100" step="1"
                      value={Math.round(draft.bgImageOpacity * 100)}
                      onChange={(e) => set('bgImageOpacity', parseInt(e.target.value) / 100)}
                      style={{ width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>Едва видна</span>
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>Полная яркость</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text2)' }}>
                      💡 Для лучшего эффекта: яркость 10–25% + прозрачность цвета 70–90%
                    </div>
                  </Field>
                )}

              </div>
            )}

            {/* ── Шрифт ────────────────────────────────────────────────── */}
            {section === 'font' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                <Field label="Шрифт">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {FONT_OPTIONS.map((f) => {
                      const active = draft.fontFamily === f
                      return (
                        <button key={f} onClick={() => set('fontFamily', f)} style={{
                          textAlign: 'left', padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                          border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                          background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)',
                          fontFamily: `'${f}', monospace`, fontSize: 12,
                          color: active ? 'var(--accent)' : 'var(--text0)',
                        }}>
                          {f} — <span style={{ opacity: 0.6 }}>ls -la ~/projects</span>
                        </button>
                      )
                    })}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Свой:</span>
                      <input
                        value={FONT_OPTIONS.includes(draft.fontFamily) ? '' : draft.fontFamily}
                        onChange={(e) => set('fontFamily', e.target.value)}
                        placeholder="Название шрифта..."
                        style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  </div>
                </Field>

                <Field label={`Размер — ${draft.fontSize}px`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="range" min="10" max="20" step="1" value={draft.fontSize}
                      onChange={(e) => set('fontSize', parseInt(e.target.value))} style={{ flex: 1 }} />
                    <input type="number" min="10" max="20" step="1" value={draft.fontSize}
                      onChange={(e) => set('fontSize', Math.max(10, Math.min(20, parseInt(e.target.value) || 13)))}
                      style={{ width: 54, textAlign: 'center', fontFamily: 'var(--font-mono)' }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text2)' }}>
                    💡 Ctrl+колесо мыши — быстрый масштаб прямо в терминале
                  </div>
                </Field>

                <Field label={`Межстрочный интервал — ${draft.lineHeight.toFixed(1)}`}>
                  <input type="range" min="10" max="20" step="1"
                    value={Math.round(draft.lineHeight * 10)}
                    onChange={(e) => set('lineHeight', parseInt(e.target.value) / 10)}
                    style={{ width: '100%' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>1.0 — плотно</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>2.0 — просторно</span>
                  </div>
                </Field>

              </div>
            )}

            {/* ── Курсор ───────────────────────────────────────────────── */}
            {section === 'cursor' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                <Field label="Вид курсора">
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { value: 'bar',       label: '│ Черта' },
                      { value: 'block',     label: '█ Блок' },
                      { value: 'underline', label: '_ Подчёркивание' },
                    ].map((opt) => {
                      const active = draft.cursorStyle === opt.value
                      return (
                        <button key={opt.value} onClick={() => set('cursorStyle', opt.value)} style={{
                          flex: 1, padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
                          border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                          background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)',
                          fontSize: 12, fontFamily: 'var(--font-mono)',
                          color: active ? 'var(--accent)' : 'var(--text1)', fontWeight: active ? 600 : 400,
                        }}>{opt.label}</button>
                      )
                    })}
                  </div>
                </Field>

                <Field label="Мигание">
                  <Toggle value={draft.cursorBlink} onChange={(v) => set('cursorBlink', v)}
                    label={draft.cursorBlink ? 'Мигает' : 'Статичный'} />
                </Field>

              </div>
            )}

            {/* ── Интерфейс ────────────────────────────────────────────── */}
            {section === 'interface' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                <Field label={`Масштаб интерфейса — ${Math.round(draft.uiScale * 100)}%`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <input type="range" min="70" max="150" step="5"
                      value={Math.round(draft.uiScale * 100)}
                      onChange={(e) => set('uiScale', parseInt(e.target.value) / 100)}
                      style={{ flex: 1 }} />
                    <input type="number" min="70" max="150" step="5"
                      value={Math.round(draft.uiScale * 100)}
                      onChange={(e) => set('uiScale', Math.max(0.7, Math.min(1.5, parseInt(e.target.value) / 100 || 1)))}
                      style={{ width: 60, textAlign: 'center', fontFamily: 'var(--font-mono)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>%</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[70, 80, 90, 100, 110, 125, 150].map((v) => {
                      const active = Math.round(draft.uiScale * 100) === v
                      return (
                        <button key={v} onClick={() => set('uiScale', v / 100)} style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                          border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                          background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)',
                          color: active ? 'var(--accent)' : 'var(--text1)', fontWeight: active ? 600 : 400,
                        }}>{v}%</button>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text2)' }}>
                    Масштабирует весь интерфейс: сайдбар, вкладки, панели.<br />
                    Терминал масштабируется отдельно через размер шрифта или Ctrl+колесо.
                  </div>
                </Field>

                <Field label="Внешний терминал (кнопка +)">
                  <input
                    value={draft.externalTerminal || ''}
                    onChange={(e) => set('externalTerminal', e.target.value)}
                    placeholder="konsole -e"
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                  />
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text2)' }}>
                    Команда запуска. Примеры: <span style={{fontFamily:'var(--font-mono)'}}>konsole -e</span>,{' '}
                    <span style={{fontFamily:'var(--font-mono)'}}>gnome-terminal --</span>,{' '}
                    <span style={{fontFamily:'var(--font-mono)'}}>xterm -e</span>
                  </div>
                </Field>

                <Field label={`Толщина разделителя сплита — ${draft.splitBorderSize ?? 2}px`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="range" min="1" max="8" step="1"
                      value={draft.splitBorderSize ?? 2}
                      onChange={(e) => set('splitBorderSize', parseInt(e.target.value))}
                      style={{ flex: 1 }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 24 }}>{draft.splitBorderSize ?? 2}px</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {[1,2,3,4,6,8].map((v) => {
                      const active = (draft.splitBorderSize ?? 2) === v
                      return (
                        <button key={v} onClick={() => set('splitBorderSize', v)} style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                          border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                          background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)',
                          color: active ? 'var(--accent)' : 'var(--text1)', fontWeight: active ? 600 : 400,
                        }}>{v}</button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5 }}>
                    Применяется к разделителям между панелями терминала (со всех сторон)
                  </div>
                </Field>

                <Field label="Мини-SFTP браузер">
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[{ v: true, l: 'Включён' }, { v: false, l: 'Выключен' }].map(({ v, l }) => {
                      const active = draft.miniSftp === v
                      return (
                        <button key={String(v)} onClick={() => set('miniSftp', v)} style={{
                          flex: 1, padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                          border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                          background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)',
                          fontSize: 12, color: active ? 'var(--accent)' : 'var(--text1)',
                          fontWeight: active ? 600 : 400,
                        }}>{l}</button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
                    Панель SFTP под сайдбаром, синхронизирована с активной SSH-сессией
                  </div>
                </Field>

                <Field label={`Последние хосты на главном экране — ${draft.historyLimit ?? 5}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="range" min="3" max="20" step="1"
                      value={draft.historyLimit ?? 5}
                      onChange={(e) => set('historyLimit', parseInt(e.target.value))}
                      style={{ flex: 1 }} />
                    <input type="number" min="3" max="20"
                      value={draft.historyLimit ?? 5}
                      onChange={(e) => set('historyLimit', Math.max(3, Math.min(20, parseInt(e.target.value) || 5)))}
                      style={{ width: 50, textAlign: 'center', fontFamily: 'var(--font-mono)' }} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {[3, 5, 8, 10, 15, 20].map((v) => {
                      const active = (draft.historyLimit ?? 5) === v
                      return (
                        <button key={v} onClick={() => set('historyLimit', v)} style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                          border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                          background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)',
                          color: active ? 'var(--accent)' : 'var(--text1)', fontWeight: active ? 600 : 400,
                        }}>{v}</button>
                      )
                    })}
                  </div>
                </Field>

              </div>
            )}

            {/* ── Подключение ──────────────────────────────────────────────── */}
            {section === 'connection' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                <Field label={`Таймаут подключения — ${draft.connectionTimeout ?? 15} сек`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <input type="range" min="5" max="120" step="5"
                      value={draft.connectionTimeout ?? 15}
                      onChange={(e) => set('connectionTimeout', parseInt(e.target.value))}
                      style={{ flex: 1 }} />
                    <input type="number" min="5" max="120" step="5"
                      value={draft.connectionTimeout ?? 15}
                      onChange={(e) => set('connectionTimeout', Math.max(5, Math.min(120, parseInt(e.target.value) || 15)))}
                      style={{ width: 60, textAlign: 'center', fontFamily: 'var(--font-mono)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>сек</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[5, 10, 15, 30, 60, 120].map((v) => {
                      const active = (draft.connectionTimeout ?? 15) === v
                      return (
                        <button key={v} onClick={() => set('connectionTimeout', v)} style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                          border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                          background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)',
                          color: active ? 'var(--accent)' : 'var(--text1)', fontWeight: active ? 600 : 400,
                        }}>{v}с</button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
                    Через сколько секунд ожидания показывать кнопку «Переподключиться» если соединение не установилось
                  </div>
                </Field>

                <Field label="Кнопка «Подключиться заново»">
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[{ v: true, l: 'Включена' }, { v: false, l: 'Выключена' }].map(({ v, l }) => {
                      const active = (draft.showReconnectButton ?? false) === v
                      return (
                        <button key={String(v)} onClick={() => set('showReconnectButton', v)} style={{
                          flex: 1, padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                          border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                          background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)',
                          fontSize: 12, color: active ? 'var(--accent)' : 'var(--text1)',
                          fontWeight: active ? 600 : 400,
                        }}>{l}</button>
                      )
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
                    Показывать оверлей с кнопкой при обрыве сессии или таймауте. По умолчанию выключена.
                  </div>
                </Field>

              </div>
            )}

            {/* ── Браузер ──────────────────────────────────────────────── */}
            {section === 'browser' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                <Field label={`Масштаб браузера — ${Math.round(draft.browserZoom * 100)}%`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <input type="range" min="50" max="200" step="5"
                      value={Math.round(draft.browserZoom * 100)}
                      onChange={(e) => set('browserZoom', parseInt(e.target.value) / 100)}
                      style={{ flex: 1 }} />
                    <input type="number" min="50" max="200" step="5"
                      value={Math.round(draft.browserZoom * 100)}
                      onChange={(e) => set('browserZoom', Math.max(0.5, Math.min(2.0, parseInt(e.target.value) / 100 || 1)))}
                      style={{ width: 60, textAlign: 'center', fontFamily: 'var(--font-mono)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>%</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[50, 75, 90, 100, 110, 125, 150, 200].map((v) => {
                      const active = Math.round(draft.browserZoom * 100) === v
                      return (
                        <button key={v} onClick={() => set('browserZoom', v / 100)} style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                          border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                          background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)',
                          color: active ? 'var(--accent)' : 'var(--text1)', fontWeight: active ? 600 : 400,
                        }}>{v}%</button>
                      )
                    })}
                  </div>
                </Field>

                <Field label="Открытие вкладок">
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { value: true,  label: 'Новая вкладка',   desc: 'Каждый URL в отдельной вкладке SSHM' },
                      { value: false, label: 'Текущая вкладка', desc: 'Переиспользовать открытый браузер' },
                    ].map((opt) => {
                      const active = draft.browserNewTab === opt.value
                      return (
                        <button key={String(opt.value)} onClick={() => set('browserNewTab', opt.value)} style={{
                          flex: 1, padding: '8px 10px', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                          border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                          background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text0)' }}>{opt.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>{opt.desc}</div>
                        </button>
                      )
                    })}
                  </div>
                </Field>

                <Field label="Стартовая страница">
                  <input
                    value={draft.browserHomePage || ''}
                    onChange={(e) => set('browserHomePage', e.target.value)}
                    placeholder="https://example.com  (пусто = URL из туннеля)"
                    style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12 }}
                  />
                  <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 5 }}>
                    Открывается при нажатии 🏠 или при открытии нового браузера без URL
                  </div>
                </Field>

              </div>
            )}

          </div>
        </div>

        {/* Превью терминала */}
        <TermPreview settings={draft} theme={preview} />

        {/* Подвал */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={handleReset} style={{ fontSize: 12, color: 'var(--text3)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border2)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text1)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text3)'}
          >Сбросить</button>
          <div style={{ flex: 1 }} />
          <button onClick={handleClose} style={{ fontSize: 12, color: 'var(--text1)', padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg2)' }}>
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

// ─── Превью ───────────────────────────────────────────────────────────────────

function TermPreview({ settings, theme }) {
  const lines = [
    [{ t: '❯ ', c: theme.green }, { t: 'ssh ', c: theme.foreground }, { t: 'prod-server', c: theme.blue }],
    [{ t: 'Welcome to Ubuntu 22.04', c: theme.foreground }],
    [{ t: 'user@prod', c: theme.green }, { t: ':~$ ', c: theme.foreground }, { t: 'ls -la', c: theme.yellow }],
    [{ t: 'drwxr-xr-x', c: theme.cyan }, { t: '  projects/', c: theme.blue }],
    [{ t: '-rw-r--r--', c: theme.foreground }, { t: '  .bashrc', c: theme.magenta }],
  ]

  return (
    <div style={{ margin: '0 20px 14px', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border2)', flexShrink: 0, position: 'relative' }}>
      <div style={{ background: '#2a2a2a', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {['#ff5f57','#ffbd2e','#28c840'].map((c) => (
          <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
        ))}
        <span style={{ marginLeft: 6, fontSize: 10, color: '#888', fontFamily: 'var(--font-mono)' }}>preview</span>
      </div>

      {/* Фоновая картинка в превью */}
      {settings.bgImage && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, top: 28,
          backgroundImage: `url(${settings.bgImage})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: settings.bgImageOpacity,
          pointerEvents: 'none',
        }} />
      )}

      <div style={{
        background: theme.background, padding: '8px 14px',
        fontFamily: `'${settings.fontFamily}', monospace`,
        fontSize: settings.fontSize - 1,
        lineHeight: settings.lineHeight,
        minHeight: 96,
        position: 'relative', zIndex: 1,
      }}>
        {lines.map((line, li) => (
          <div key={li}>{line.map((p, pi) => <span key={pi} style={{ color: p.c }}>{p.t}</span>)}</div>
        ))}
      </div>
    </div>
  )
}

// ─── Вспомогательные ─────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.4px' }}>
        {label}
      </div>
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
