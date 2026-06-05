import React, { useState, useEffect } from 'react'

const SESSION_TYPES = [
  { id: 'ssh',    label: 'SSH',    icon: '⌨',  desc: 'Secure Shell' },
  { id: 'vnc',    label: 'VNC',    icon: '🖥',  desc: 'Virtual Network Computing' },
  { id: 'rdp',    label: 'RDP',    icon: '🪟',  desc: 'Remote Desktop Protocol' },
  { id: 'telnet', label: 'Telnet', icon: '📡', desc: 'Telnet (нешифрованный)' },
  { id: 'mosh',   label: 'Mosh',   icon: '⚡', desc: 'Mobile Shell (UDP)' },
  { id: 'ipmi',   label: 'IPMI',   icon: '🔧', desc: 'Baseboard Management Controller' },
  { id: 'custom', label: 'Custom', icon: '⚙',  desc: 'Произвольная команда' },
]

const DEFAULT_PORTS = { ssh: 22, vnc: 5900, rdp: 3389, telnet: 23, mosh: 60001, ipmi: 623, custom: '' }

const EMPTY = {
  type: 'ssh',
  name: '', hostname: '', user: '', port: '',
  authType: 'key',
  identityFile: '',
  password: '',
  proxyJump: '',
  // VNC
  vncPassword: '',
  vncDisplay: '',
  // RDP
  rdpDomain: '',
  rdpWidth: '1920',
  rdpHeight: '1080',
  // Custom
  customCmd: '',
}

export default function AddHostModal({ onClose, onAdded, initialHost = null }) {
  const initForm = () => {
    if (!initialHost) return { ...EMPTY }
    const authType = initialHost.identityFile ? 'key' : 'ask'
    return {
      ...EMPTY,
      type:         initialHost.type || 'ssh',
      name:         initialHost.host || initialHost.name || '',
      hostname:     initialHost.hostname || '',
      user:         initialHost.user || '',
      port:         initialHost.port && initialHost.port !== DEFAULT_PORTS[initialHost.type || 'ssh'] ? String(initialHost.port) : '',
      identityFile: initialHost.identityFile || '',
      proxyJump:    initialHost.proxyJump || '',
      authType,
      vncPassword:  initialHost.vncPassword || '',
      vncDisplay:   initialHost.vncDisplay != null ? String(initialHost.vncDisplay) : '',
      rdpDomain:    initialHost.rdpDomain || '',
      rdpWidth:     initialHost.rdpWidth ? String(initialHost.rdpWidth) : '1920',
      rdpHeight:    initialHost.rdpHeight ? String(initialHost.rdpHeight) : '1080',
      customCmd:    initialHost.customCmd || '',
    }
  }

  const [form, setForm]             = useState(initForm)
  const [files, setFiles]           = useState([])
  const [targetFile, setTargetFile] = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [errors, setErrors]         = useState({})

  useEffect(() => {
    window.api.sshConfig.listFiles().then((list) => {
      setFiles(list)
      // При редактировании — выбираем файл-источник хоста, иначе первый в списке
      const sourceFile = initialHost?._sourceFile
      if (sourceFile) {
        // Ищем в списке файлов совпадение по пути (resolved)
        const match = list.find((f) => f.path === sourceFile || f.path.replace('~', '') === sourceFile.replace(require('os').homedir(), ''))
        setTargetFile(match ? match.path : (list[0]?.path || sourceFile))
      } else if (list.length > 0) {
        setTargetFile(list[0].path)
      }
    })
  }, [])

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => { const n = { ...e }; delete n[k]; return n })
  }
  const errStyle = (k) => errors[k] ? { border: '1.5px solid var(--red)' } : {}

  const handleSave = async () => {
    const errs = {}
    if (!form.name.trim())     errs.name     = true
    if (!form.hostname.trim()) errs.hostname = true
    if (Object.keys(errs).length > 0) { setErrors(errs); setError('Заполните обязательные поля'); return }
    setErrors({})
    if (!targetFile && form.type === 'ssh') return setError('Выберите файл')

    setSaving(true); setError('')

    // Не-SSH типы сохраняются через sessions API
    if (form.type !== 'ssh') {
      const session = {
        type:     form.type,
        name:     form.name.trim(),
        hostname: form.hostname.trim(),
        user:     form.user.trim(),
        port:     parseInt(form.port) || DEFAULT_PORTS[form.type] || undefined,
        // VNC
        ...(form.type === 'vnc' && { vncPassword: form.vncPassword, vncDisplay: parseInt(form.vncDisplay) || 0 }),
        // RDP
        ...(form.type === 'rdp' && { rdpDomain: form.rdpDomain, rdpWidth: parseInt(form.rdpWidth) || 1920, rdpHeight: parseInt(form.rdpHeight) || 1080 }),
        // Custom
        ...(form.type === 'custom' && { customCmd: form.customCmd }),
      }
      const isEditing = !!initialHost?.id
      let res
      if (isEditing) {
        res = await window.api.sessions.update(initialHost.id, session)
      } else {
        res = await window.api.sessions.add(session)
      }
      setSaving(false)
      if (res?.ok) {
        const updated = await window.api.sessions.load()
        onAdded(updated, 'sessions')
        onClose()
      } else {
        setError(res?.error || 'Ошибка сохранения')
      }
      return
    }

    // SSH — сохраняем в конфиг файл
    if (form.authType === 'password' && form.password) {
      await window.api.sshConfig.savePassword(form.name.trim(), form.password)
    }

    const isEditing = !!initialHost
    const hostData = {
      name:         form.name.trim(),
      hostname:     form.hostname.trim(),
      user:         form.user.trim(),
      port:         parseInt(form.port) || 22,
      identityFile: form.authType === 'key' ? form.identityFile.trim() : '',
      proxyJump:    form.proxyJump.trim(),
    }
    const res = isEditing
      ? await window.api.sshConfig.updateHost({ filePath: targetFile, oldName: initialHost.host, host: hostData })
      : await window.api.sshConfig.addHost({ filePath: targetFile, host: hostData })

    setSaving(false)
    if (res.ok) {
      const hosts = await window.api.sshConfig.reload()
      onAdded(hosts, 'ssh')
      onClose()
    } else {
      setError(res.error || 'Ошибка записи')
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={onClose}
    >
      <div
        style={{ background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 12, width: 500, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '15px 20px 13px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text0)' }}>{initialHost ? '✎ Редактировать хост' : '+ Добавить хост'}</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 18 }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text0)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text3)'}
          >×</button>
        </div>

        {/* Форма */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>

          {/* ── Тип сессии ── */}
          <Row label="Тип сессии">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {SESSION_TYPES.map((t) => {
                const active = form.type === t.id
                return (
                  <button key={t.id} onClick={() => set('type', t.id)} title={t.desc} style={{
                    padding: '4px 9px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: active ? 600 : 400,
                    border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                    background: active ? 'rgba(37,99,235,0.07)' : 'var(--bg2)',
                    color: active ? 'var(--accent)' : 'var(--text1)',
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    {t.icon} {t.label}
                  </button>
                )
              })}
            </div>
          </Row>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 12 }}>
            <Row label="Имя (псевдоним) *">
              <input value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="my-server" style={{ width: '100%', fontFamily: 'var(--font-mono)', ...errStyle('name') }} autoFocus />
            </Row>
            <Row label="Порт">
              <input value={form.port} onChange={(e) => set('port', e.target.value.replace(/\D/g, ''))}
                placeholder={String(DEFAULT_PORTS[form.type] || '')} style={{ width: '100%', fontFamily: 'var(--font-mono)', textAlign: 'center' }} />
            </Row>
          </div>

          <Row label="Адрес (hostname) *">
            <input value={form.hostname} onChange={(e) => set('hostname', e.target.value)}
              placeholder="192.168.1.1 или server.example.com" style={{ width: '100%', fontFamily: 'var(--font-mono)', ...errStyle('hostname') }} />
          </Row>

          <Row label="Пользователь">
            <input value={form.user} onChange={(e) => set('user', e.target.value)}
              placeholder="" style={{ width: '100%' }} />
          </Row>

          {/* ── SSH-специфичные поля ── */}
          {form.type === 'ssh' && (<>
          {/* Аутентификация */}
          <Row label="Аутентификация">
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { value: 'key',      label: '🔑 Ключ' },
                { value: 'password', label: '🔒 Пароль' },
                { value: 'ask',      label: '💬 Спрашивать' },
              ].map((opt) => {
                const active = form.authType === opt.value
                return (
                  <button key={opt.value} onClick={() => set('authType', opt.value)} style={{
                    flex: 1, padding: '7px 8px', borderRadius: 7, cursor: 'pointer',
                    border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
                    background: active ? 'rgba(37,99,235,0.06)' : 'var(--bg2)',
                    fontSize: 12, color: active ? 'var(--accent)' : 'var(--text1)',
                    fontWeight: active ? 600 : 400,
                  }}>{opt.label}</button>
                )
              })}
            </div>
          </Row>

          {form.authType === 'key' && (
            <Row label="Identity File (SSH-ключ)">
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={form.identityFile} onChange={(e) => set('identityFile', e.target.value)}
                  placeholder="~/.ssh/id_rsa" style={{ flex: 1, fontFamily: 'var(--font-mono)', ...errStyle('identityFile') }} />
                <button
                  onClick={async () => {
                    const file = await window.api.dialog?.openFile({
                      title: 'Выбрать SSH-ключ',
                      defaultPath: '~/.ssh',
                    })
                    if (file) set('identityFile', file)
                  }}
                  title="Выбрать файл"
                  style={{
                    padding: '0 10px', borderRadius: 6, border: '1px solid var(--border2)',
                    background: 'var(--bg2)', color: 'var(--text1)', cursor: 'pointer',
                    fontSize: 13, flexShrink: 0,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border2)'}
                >📂</button>
              </div>
            </Row>
          )}

          {form.authType === 'password' && (
            <Row label="Пароль (сохраняется зашифрованным)">
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Введите пароль"
                  style={{ width: '100%', paddingRight: 32 }}
                />
                <button
                  onClick={() => setShowPass((v) => !v)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text3)' }}
                >{showPass ? '🙈' : '👁'}</button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                Хранится в ~/.config/asm/passwords.json (AES-256). Требует sshpass.
              </div>
            </Row>
          )}

          {form.authType === 'ask' && (
            <div style={{ fontSize: 11, color: 'var(--text2)', padding: '8px 12px', background: 'var(--bg2)', borderRadius: 6 }}>
              💬 Пароль будет запрошен при каждом подключении в терминале.
            </div>
          )}

          <Row label="ProxyJump (jump host)">
            <input value={form.proxyJump} onChange={(e) => set('proxyJump', e.target.value)}
              placeholder="bastion-host" style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
          </Row>
          </>)}  {/* конец SSH-специфичных полей */}

          {/* ── VNC ── */}
          {form.type === 'vnc' && (<>
            <Row label="VNC Пароль"><input type="password" value={form.vncPassword} onChange={(e) => set('vncPassword', e.target.value)} placeholder="VNC password" style={{ width: '100%' }} /></Row>
            <Row label="Display (экран)"><input value={form.vncDisplay} onChange={(e) => set('vncDisplay', e.target.value.replace(/\D/g,''))} placeholder="0" style={{ width: '100%', fontFamily: 'var(--font-mono)' }} /></Row>
            <div style={{ fontSize: 11, color: 'var(--text2)', padding: '6px 10px', background: 'var(--bg2)', borderRadius: 6 }}>🖥 Запуск: vncviewer / xtigervnc / Remmina</div>
          </>)}

          {/* ── RDP ── */}
          {form.type === 'rdp' && (<>
            <Row label="Домен (опционально)"><input value={form.rdpDomain} onChange={(e) => set('rdpDomain', e.target.value)} placeholder="CORP" style={{ width: '100%' }} /></Row>
            <Row label="Разрешение">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input value={form.rdpWidth} onChange={(e) => set('rdpWidth', e.target.value.replace(/\D/g,''))} placeholder="1920" style={{ width: 80, fontFamily: 'var(--font-mono)', textAlign: 'center' }} />
                <span style={{ color: 'var(--text3)' }}>×</span>
                <input value={form.rdpHeight} onChange={(e) => set('rdpHeight', e.target.value.replace(/\D/g,''))} placeholder="1080" style={{ width: 80, fontFamily: 'var(--font-mono)', textAlign: 'center' }} />
              </div>
            </Row>
            <div style={{ fontSize: 11, color: 'var(--text2)', padding: '6px 10px', background: 'var(--bg2)', borderRadius: 6 }}>🪟 Запуск: xfreerdp / rdesktop / Remmina</div>
          </>)}

          {/* ── IPMI ── */}
          {form.type === 'ipmi' && <div style={{ fontSize: 11, color: 'var(--text2)', padding: '8px 12px', background: 'var(--bg2)', borderRadius: 6 }}>🔧 Web BMC откроется во встроенном браузере. Для CLI используйте ipmitool в SSH-сессии.</div>}

          {/* ── Mosh ── */}
          {form.type === 'mosh' && <div style={{ fontSize: 11, color: 'var(--text2)', padding: '8px 12px', background: 'var(--bg2)', borderRadius: 6 }}>⚡ Требует mosh на клиенте и сервере. Порт — UDP начало диапазона (по умолчанию 60001+).</div>}

          {/* ── Custom ── */}
          {form.type === 'custom' && (
            <Row label="Команда запуска">
              <input value={form.customCmd} onChange={(e) => set('customCmd', e.target.value)}
                placeholder="ssh -o StrictHostKeyChecking=no {user}@{hostname}" style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Переменные: {'{hostname}'}, {'{port}'}, {'{user}'}</div>
            </Row>
          )}

          {/* Превью конфига */}
          {form.name && form.hostname && (
            <div style={{ padding: '8px 12px', background: 'var(--bg2)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', lineHeight: 1.8 }}>
              <div>Host {form.name}</div>
              <div>{'    '}HostName {form.hostname}</div>
              {form.user && <div>{'    '}User {form.user}</div>}
              {form.port !== '22' && <div>{'    '}Port {form.port}</div>}
              {form.authType === 'key' && form.identityFile && <div>{'    '}IdentityFile {form.identityFile}</div>}
              {form.authType === 'password' && <div style={{ color: 'var(--text3)' }}>{'    '}# пароль хранится отдельно</div>}
              {form.proxyJump && <div>{'    '}ProxyJump {form.proxyJump}</div>}
            </div>
          )}

          {/* Файл — только для SSH */}
          {form.type === 'ssh' && (
            <Row label="Записать в файл">
              <select value={targetFile} onChange={(e) => setTargetFile(e.target.value)}
                style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {files.map((f) => <option key={f.path} value={f.path}>{f.label}</option>)}
              </select>
            </Row>
          )}

          {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
        </div>

        {/* Подвал */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ fontSize: 12, color: 'var(--text1)', padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg2)' }}>
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            fontSize: 12, fontWeight: 600, color: '#fff', padding: '6px 20px', borderRadius: 6,
            background: 'var(--accent)', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>
            {saving ? (initialHost ? 'Сохраняю...' : 'Добавляю...') : (initialHost ? 'Сохранить' : 'Добавить')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
      {children}
    </div>
  )
}
