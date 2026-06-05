import React, { useState, useEffect } from 'react'

export default function TunnelPane({ tab, onUpdate }) {
  const [tunnels, setTunnels] = useState([]) // active tunnels for this host
  const [form, setForm] = useState({
    direction: 'local',
    localPort: '8080',
    remoteHost: 'localhost',
    remotePort: '80',
  })
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    onUpdate({ status: 'connected', title: `tunnels: ${tab.host.host}` })
  }, [])

  const start = async () => {
    setError('')
    setStarting(true)
    const id = `${tab.id}-${Date.now()}`
    const res = await window.api.tunnel.start({
      id,
      host: tab.host.hostname,
      user: tab.host.user,
      port: tab.host.port,
      identityFile: tab.host.identityFile,
      localPort: parseInt(form.localPort),
      remoteHost: form.remoteHost,
      remotePort: parseInt(form.remotePort),
      direction: form.direction,
    })
    setStarting(false)
    if (res.ok) {
      setTunnels((t) => [...t, { id, ...form, info: res.info, status: 'active' }])
    } else {
      setError(res.error)
    }
  }

  const stop = async (id) => {
    await window.api.tunnel.stop(id)
    setTunnels((t) => t.filter((x) => x.id !== id))
  }

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto', color: 'var(--text0)' }}>
      <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 20, color: 'var(--text0)' }}>
        Port Forwarding — <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{tab.host.host}</span>
      </h2>

      {/* Form */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: 18, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <Label>Direction</Label>
            <select
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
              style={{ width: '100%', background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text0)', padding: '6px 10px', fontSize: 12 }}
            >
              <option value="local">Local → Remote (L)</option>
              <option value="remote">Remote → Local (R)</option>
              <option value="socks">SOCKS5 Proxy (D)</option>
            </select>
          </div>
          <div>
            <Label>Local port</Label>
            <input value={form.localPort} onChange={(e) => setForm({ ...form, localPort: e.target.value })} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
          </div>
          {form.direction !== 'socks' && (<>
            <div>
              <Label>Remote host</Label>
              <input value={form.remoteHost} onChange={(e) => setForm({ ...form, remoteHost: e.target.value })} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
            </div>
            <div>
              <Label>Remote port</Label>
              <input value={form.remotePort} onChange={(e) => setForm({ ...form, remotePort: e.target.value })} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
            </div>
          </>)}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 12, fontFamily: 'var(--font-mono)', background: 'var(--bg3)', padding: '5px 8px', borderRadius: 5 }}>
          {form.direction === 'local' && `ssh -L ${form.localPort}:${form.remoteHost}:${form.remotePort} ${tab.host.user ? tab.host.user + '@' : ''}${tab.host.hostname}`}
          {form.direction === 'remote' && `ssh -R ${form.localPort}:${form.remoteHost}:${form.remotePort} ${tab.host.user ? tab.host.user + '@' : ''}${tab.host.hostname}`}
          {form.direction === 'socks' && `ssh -D ${form.localPort} ${tab.host.user ? tab.host.user + '@' : ''}${tab.host.hostname}  →  socks5://127.0.0.1:${form.localPort}`}
        </div>

        {error && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

        <button
          onClick={start}
          disabled={starting}
          style={{
            background: 'var(--accent)', color: '#fff', padding: '7px 18px',
            borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            opacity: starting ? 0.6 : 1,
          }}
        >
          {starting ? 'Connecting…' : '▶ Start tunnel'}
        </button>
      </div>

      {/* Active tunnels */}
      {tunnels.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Active Tunnels
          </div>
          {tunnels.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', marginBottom: 8,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', flex: 1 }}>
                {t.info}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                {t.direction === 'local' ? 'Local forward' : 'Remote forward'}
              </div>
              <button
                onClick={() => stop(t.id)}
                style={{ color: 'var(--red)', fontSize: 12, padding: '3px 8px', borderRadius: 4, background: 'rgba(255,95,95,0.12)' }}
              >
                Stop
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 5, fontWeight: 500 }}>{children}</div>
}
