import React, { useState, useCallback, useMemo, useDeferredValue } from 'react'
import {
  TERM_THEMES,
  PRESET_BACKGROUNDS,
  FONT_OPTIONS,
  DEFAULT_SETTINGS,
  UI_THEMES,
  applyUITheme,
  buildXtermTheme,
} from '../termSettings'
import './SettingsModal.css'

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

function SettingsModal({ settings, onSave, onClose }) {
  const [draft,   setDraft]   = useState({ ...settings })
  const [section, setSection] = useState('terminal')

  const set = useCallback((key, value) => {
    setDraft((d) => ({ ...d, [key]: value }))
    // Живой превью темы
    if (key === 'uiTheme') applyUITheme(value)
  }, [])

  const preview = useMemo(() => buildXtermTheme(draft), [draft])

  // TermPreview обновляется с пониженным приоритетом — слайдеры не лагают
  const deferredDraft = useDeferredValue(draft)
  const deferredPreview = useMemo(() => buildXtermTheme(deferredDraft), [deferredDraft])

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
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Шапка */}
        <div className="settings-modal-header">
          <span>Настройки</span>
          <button onClick={handleClose} className="settings-modal-close">×</button>
        </div>

        <div className="settings-modal-body">

          {/* Левая панель — секции */}
          <div className="settings-modal-sidebar">
            {SECTIONS.map((s) => (
              <button 
                key={s.id} 
                onClick={() => setSection(s.id)} 
                className={`settings-section-btn ${section === s.id ? 'active' : ''}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Правая панель */}
          <div className="settings-modal-panels">

            {/* ── Тема интерфейса ──────────────────────────────────────── */}
            {section === 'theme' && (
              <div className="settings-section">
                <Field label="Тема интерфейса">
                  <div className="theme-grid">
                    {[...Object.keys(UI_THEMES), 'System'].map((name) => {
                      const active = draft.uiTheme === name
                      const colors = UI_THEMES[name] || UI_THEMES['Light']
                      return (
                        <button
                          key={name}
                          onClick={() => set('uiTheme', name)}
                          className={`theme-button ${active ? 'active' : ''}`}
                        >
                          {/* Мини-превью палитры */}
                          <div className="theme-preview">
                            {[colors['--bg1'] || '#fff', colors['--bg2'] || '#eee', colors['--accent'] || '#2563eb', colors['--text0'] || '#111'].map((c, i) => (
                              <div key={i} style={{ flex: 1, background: c }} />
                            ))}
                          </div>
                          <div className={`theme-label ${active ? 'active' : ''}`}>
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
              <div className="settings-section">

                <Field label="Цветовая схема">
                  <div className="color-scheme-grid">
                    {Object.keys(TERM_THEMES).map((name) => {
                      const t = TERM_THEMES[name]
                      const active = draft.themeName === name
                      return (
                        <button 
                          key={name} 
                          onClick={() => set('themeName', name)} 
                          className={`color-scheme-btn ${active ? 'active' : ''}`}
                        >
                          <div className="color-preview">
                            {[t.red, t.green, t.yellow, t.blue, t.magenta, t.cyan].map((c, i) => (
                              <div key={i} style={{ width: 7, height: 14, borderRadius: 2, background: c }} />
                            ))}
                          </div>
                          <span className={`scheme-label ${active ? 'active' : ''}`}>{name}</span>
                        </button>
                      )
                    })}
                  </div>
                </Field>

              </div>
            )}

            {/* ── Фон ──────────────────────────────────────────────────── */}
            {section === 'background' && (
              <div className="settings-section background-section">

                <Field label="Цвет фона">
                  <div className="bg-color-list">
                    {PRESET_BACKGROUNDS.map((p) => (
                      <BackgroundColorButton 
                        key={p.value}
                        preset={p}
                        active={draft.background === p.value}
                        onClick={() => set('background', p.value)}
                      />
                    ))}
                  </div>
                  <div className="color-input-group">
                    <input 
                      type="color" 
                      value={draft.background} 
                      onChange={(e) => set('background', e.target.value)}
                      className="color-picker"
                    />
                    <input 
                      value={draft.background}
                      onChange={(e) => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) set('background', v) }}
                      placeholder="#1e1e2e"
                      className="color-input"
                    />
                  </div>
                </Field>

                <Field label={`Прозрачность цвета — ${Math.round(draft.opacity * 100)}%`}>
                  <input 
                    type="range" 
                    min="20" 
                    max="100" 
                    step="1"
                    value={Math.round(draft.opacity * 100)}
                    onChange={(e) => set('opacity', parseInt(e.target.value) / 100)}
                    className="range-input"
                  />
                  <div className="range-labels">
                    <span>Прозрачный</span>
                    <span>Непрозрачный</span>
                  </div>
                  {draft.opacity < 1 && (
                    <div className="warning-notice">
                      ⚠ Требует compositor (Picom, KWin, Mutter)
                    </div>
                  )}
                </Field>

                {/* Разделитель */}
                <div className="divider" />

                <Field label="Фоновое изображение">
                  <div className="bg-image-container">
                    {/* Превью картинки */}
                    <div className="bg-image-preview">
                      {draft.bgImage
                        ? <img src={draft.bgImage} alt="bg" />
                        : <span>🖼</span>
                      }
                    </div>

                    <div className="bg-image-controls">
                      <button onClick={pickImage} className="btn-primary">
                        📁 Выбрать
                      </button>
                      {draft.bgImage && (
                        <button onClick={() => set('bgImage', null)} className="btn-secondary">
                          ✕ Убрать
                        </button>
                      )}
                    </div>
                  </div>
                </Field>

                <Field label={`Прозрачность изображения — ${Math.round(draft.bgImageOpacity * 100)}%`}>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="1"
                    value={Math.round(draft.bgImageOpacity * 100)}
                    onChange={(e) => set('bgImageOpacity', parseInt(e.target.value) / 100)}
                    className="range-input"
                  />
                  <div className="range-labels">
                    <span>Прозрачное</span>
                    <span>Видимое</span>
                  </div>
                </Field>

              </div>
            )}

            {/* ── Шрифт ─────────────────────────────────────────────────── */}
            {section === 'font' && (
              <div className="settings-section">

                <Field label="Гарнитура">
                  <div className="font-grid">
                    {FONT_OPTIONS.map((f) => {
                      const active = draft.fontFamily === f.name
                      return (
                        <button 
                          key={f.name} 
                          onClick={() => set('fontFamily', f.name)}
                          className={`font-btn ${active ? 'active' : ''}`}
                          style={{ fontFamily: f.name }}
                        >
                          {f.label}
                        </button>
                      )
                    })}
                  </div>
                </Field>

                <Field label="Размер шрифта">
                  <div className="font-size-input-group">
                    <input 
                      type="range" 
                      min="9" 
                      max="24" 
                      step="1"
                      value={draft.fontSize}
                      onChange={(e) => set('fontSize', parseInt(e.target.value))}
                      className="range-input"
                    />
                    <input 
                      type="number" 
                      min="9" 
                      max="24" 
                      step="1"
                      value={draft.fontSize}
                      onChange={(e) => set('fontSize', Math.max(9, Math.min(24, parseInt(e.target.value) || 12)))}
                      className="font-size-input"
                    />
                    <span>px</span>
                  </div>
                </Field>

                <Field label="Высота строки">
                  <div className="line-height-input-group">
                    <input 
                      type="range" 
                      min="1.2" 
                      max="2.0" 
                      step="0.1"
                      value={draft.lineHeight}
                      onChange={(e) => set('lineHeight', parseFloat(e.target.value))}
                      className="range-input"
                    />
                    <input 
                      type="number" 
                      min="1.2" 
                      max="2.0" 
                      step="0.1"
                      value={draft.lineHeight}
                      onChange={(e) => set('lineHeight', Math.max(1.2, Math.min(2.0, parseFloat(e.target.value) || 1.5)))}
                      className="line-height-input"
                    />
                  </div>
                </Field>

              </div>
            )}

            {/* ── Курсор ────────────────────────────────────────────────── */}
            {section === 'cursor' && (
              <div className="settings-section">

                <Field label="Стиль курсора">
                  <div className="cursor-style-group">
                    {['block', 'underline', 'bar'].map((style) => {
                      const active = draft.cursorStyle === style
                      const label = { block: 'Блок', underline: 'Подчеркивание', bar: 'Палочка' }[style]
                      return (
                        <button 
                          key={style} 
                          onClick={() => set('cursorStyle', style)}
                          className={`cursor-btn ${active ? 'active' : ''}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </Field>

                <Field label="Мигание курсора">
                  <Toggle 
                    value={draft.cursorBlink}
                    onChange={(v) => set('cursorBlink', v)}
                    label="Включить мигание"
                  />
                </Field>

              </div>
            )}

            {/* ── Интерфейс ─────────────────────────────────────────────── */}
            {section === 'interface' && (
              <div className="settings-section">

                <Field label="Компактный вид">
                  <Toggle 
                    value={draft.compactUI}
                    onChange={(v) => set('compactUI', v)}
                    label="Меньше отступов и размеров"
                  />
                </Field>

                <Field label="Сворачиваемые панели">
                  <Toggle 
                    value={draft.collapseablePanels}
                    onChange={(v) => set('collapseablePanels', v)}
                    label="Показать кнопки сворачивания"
                  />
                </Field>

                <Field label="Показывать подсказки">
                  <Toggle 
                    value={draft.showTooltips}
                    onChange={(v) => set('showTooltips', v)}
                    label="Подсказки при наведении"
                  />
                </Field>

              </div>
            )}

            {/* ── Подключение ────────────────────────────────────────────── */}
            {section === 'connection' && (
              <div className="settings-section">

                <Field label="Таймаут подключения (сек)">
                  <div className="timeout-input-group">
                    <input 
                      type="range" 
                      min="5" 
                      max="60" 
                      step="1"
                      value={draft.connectionTimeout || 30}
                      onChange={(e) => set('connectionTimeout', parseInt(e.target.value))}
                      className="range-input"
                    />
                    <input 
                      type="number" 
                      min="5" 
                      max="60"
                      value={draft.connectionTimeout || 30}
                      onChange={(e) => set('connectionTimeout', Math.max(5, Math.min(60, parseInt(e.target.value) || 30)))}
                      className="timeout-input"
                    />
                  </div>
                </Field>

                <Field label="Переподключение">
                  <Toggle 
                    value={draft.autoReconnect}
                    onChange={(v) => set('autoReconnect', v)}
                    label="Переподключаться при разрыве"
                  />
                </Field>

                <Field label="Хранение пароля">
                  <div className="password-storage-group">
                    {[
                      { value: 'never',  label: 'Никогда',     desc: 'Вводить каждый раз' },
                      { value: 'session', label: 'Сеанс',      desc: 'В памяти, при закрытии забывается' },
                      { value: 'always',  label: 'Всегда',     desc: '⚠ Сохраняется в конфиге' },
                    ].map((opt) => {
                      const active = (draft.passwordStorage || 'never') === opt.value
                      return (
                        <button 
                          key={opt.value} 
                          onClick={() => set('passwordStorage', opt.value)}
                          className={`password-btn ${active ? 'active' : ''}`}
                        >
                          <div className="password-label">{opt.label}</div>
                          <div className="password-desc">{opt.desc}</div>
                        </button>
                      )
                    })}
                  </div>
                </Field>

              </div>
            )}

            {/* ── Браузер ────────────────────────────────────────────────── */}
            {section === 'browser' && (
              <div className="settings-section">

                <Field label="Масштаб браузера">
                  <div className="zoom-input-group">
                    <input 
                      type="range" 
                      min="50" 
                      max="200" 
                      step="5"
                      value={Math.round(draft.browserZoom * 100)}
                      onChange={(e) => set('browserZoom', Math.max(0.5, Math.min(2.0, parseInt(e.target.value) / 100 || 1)))}
                      className="range-input"
                    />
                    <input 
                      type="number" 
                      min="50" 
                      max="200" 
                      step="5"
                      value={Math.round(draft.browserZoom * 100)}
                      onChange={(e) => set('browserZoom', Math.max(0.5, Math.min(2.0, parseInt(e.target.value) / 100 || 1)))}
                      className="zoom-input"
                    />
                    <span>%</span>
                  </div>
                  <div className="zoom-presets">
                    {[50, 75, 90, 100, 110, 125, 150, 200].map((v) => {
                      const active = Math.round(draft.browserZoom * 100) === v
                      return (
                        <button 
                          key={v} 
                          onClick={() => set('browserZoom', v / 100)}
                          className={`zoom-preset ${active ? 'active' : ''}`}
                        >
                          {v}%
                        </button>
                      )
                    })}
                  </div>
                </Field>

                <Field label="Открытие вкладок">
                  <div className="browser-tab-group">
                    {[
                      { value: true,  label: 'Новая вкладка',   desc: 'Каждый URL в отдельной вкладке SSHM' },
                      { value: false, label: 'Текущая вкладка', desc: 'Переиспользовать открытый браузер' },
                    ].map((opt) => {
                      const active = draft.browserNewTab === opt.value
                      return (
                        <button 
                          key={String(opt.value)} 
                          onClick={() => set('browserNewTab', opt.value)}
                          className={`browser-tab-btn ${active ? 'active' : ''}`}
                        >
                          <div className="browser-label">{opt.label}</div>
                          <div className="browser-desc">{opt.desc}</div>
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
                    className="browser-url-input"
                  />
                  <div className="browser-url-hint">
                    Открывается при нажатии 🏠 или при открытии нового браузера без URL
                  </div>
                </Field>

              </div>
            )}

          </div>
        </div>

        {/* Превью терминала */}
        {/* TermPreview получает точечные пропсы — React.memo пропускает рендер когда нет изменений */}
        <TermPreview
          bgImage={deferredDraft.bgImage}
          bgImageOpacity={deferredDraft.bgImageOpacity}
          fontFamily={deferredDraft.fontFamily}
          fontSize={deferredDraft.fontSize}
          lineHeight={deferredDraft.lineHeight}
          theme={deferredPreview}
        />

        {/* Подвал */}
        <div className="settings-modal-footer">
          <button onClick={handleReset} className="btn-reset">Сбросить</button>
          <div style={{ flex: 1 }} />
          <button onClick={handleClose} className="btn-cancel">Отмена</button>
          <button onClick={handleSave} className="btn-save">Сохранить</button>
        </div>

      </div>
    </div>
  )
}

// ─── Компоненты ──────────────────────────────────────────────────────────────

const BackgroundColorButton = React.memo(({ preset, active, onClick }) => {
  return (
    <button 
      className={`bg-color-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      title={preset.label}
    >
      <div className="bg-color-swatch" style={{ background: preset.value }} />
      <span className={`bg-color-label ${active ? 'active' : ''}`}>{preset.label}</span>
    </button>
  )
})

const TermPreview = React.memo(function TermPreview({ bgImage, bgImageOpacity, fontFamily, fontSize, lineHeight, theme }) {
  const lines = [
    [{ t: '❯ ', c: theme.green }, { t: 'ssh ', c: theme.foreground }, { t: 'prod-server', c: theme.blue }],
    [{ t: 'Welcome to Ubuntu 22.04', c: theme.foreground }],
    [{ t: 'user@prod', c: theme.green }, { t: ':~$ ', c: theme.foreground }, { t: 'ls -la', c: theme.yellow }],
    [{ t: 'drwxr-xr-x', c: theme.cyan }, { t: '  projects/', c: theme.blue }],
    [{ t: '-rw-r--r--', c: theme.foreground }, { t: '  .bashrc', c: theme.magenta }],
  ]

  return (
    <div className="term-preview-container">
      <div className="term-preview-header">
        {['#ff5f57','#ffbd2e','#28c840'].map((c) => (
          <div key={c} className="term-preview-dot" style={{ background: c }} />
        ))}
        <span>preview</span>
      </div>

      {/* Фоновая картинка — GPU слой через will-change */}
      {bgImage && (
        <div 
          className="term-preview-bg"
          style={{
            backgroundImage: `url(${bgImage})`,
            opacity: bgImageOpacity,
          }}
        />
      )}

      <div 
        className="term-preview-content"
        style={{
          background: theme.background,
          fontFamily: `'${fontFamily}', monospace`,
          fontSize: fontSize - 1,
          lineHeight: lineHeight,
        }}
      >
        {lines.map((line, li) => (
          <div key={li}>{line.map((p, pi) => <span key={pi} style={{ color: p.c }}>{p.t}</span>)}</div>
        ))}
      </div>
    </div>
  )
})

// ─── Вспомогательные ──────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      {children}
    </div>
  )
}

function Toggle({ value, onChange, label }) {
  return (
    <div className="toggle-group">
      <div 
        className={`toggle-switch ${value ? 'on' : 'off'}`}
        onClick={() => onChange(!value)}
      >
        <div className="toggle-thumb" />
      </div>
      <span>{label}</span>
    </div>
  )
}

export default React.memo(SettingsModal)
