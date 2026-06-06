import React, { useEffect, useRef, useState, useCallback } from 'react'

// ─── Форматирование ────────────────────────────────────────────────────────────

function fmtBytes(b) {
  if (b === 0 || !b) return '0 B'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function fmtRate(bps) {
  if (!bps) return '0 B/s'
  if (bps < 1024) return `${Math.round(bps)} B/s`
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`
  if (bps < 1024 * 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`
  return `${(bps / 1024 / 1024 / 1024).toFixed(2)} GB/s`
}

function fmtUptime(secs) {
  if (!secs) return '?'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function cpuColor(pct) {
  if (pct >= 90) return 'var(--red)'
  if (pct >= 70) return 'var(--amber)'
  return 'var(--green)'
}

function diskColor(pct) {
  if (pct >= 90) return 'var(--red)'
  if (pct >= 75) return 'var(--amber)'
  return 'var(--text2)'
}

// ─── Маленький прогресс-бар ────────────────────────────────────────────────────
function MiniBar({ pct, color }) {
  return (
    <div style={{
      width: 36, height: 5, borderRadius: 3,
      background: 'var(--bg4)', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{
        width: `${Math.min(100, pct)}%`, height: '100%',
        background: color, borderRadius: 3,
        transition: 'width 0.5s ease',
      }} />
    </div>
  )
}

// ─── Разделитель ────────────────────────────────────────────────────────────────
function Sep() {
  return <div style={{ width: 1, height: 12, background: 'var(--border2)', flexShrink: 0 }} />
}

// ─── Одна метрика ───────────────────────────────────────────────────────────────
function Metric({ icon, label, value, color, bar, barPct, barColor, title }) {
  return (
    <div
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
        padding: '0 8px', height: '100%',
      }}
    >
      <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{icon}</span>
      {bar && <MiniBar pct={barPct} color={barColor} />}
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: color || 'var(--text1)', whiteSpace: 'nowrap' }}>
        {value}
      </span>
      {label && <span style={{ fontSize: 9, color: 'var(--text3)', flexShrink: 0 }}>{label}</span>}
    </div>
  )
}

// ─── Главный компонент ─────────────────────────────────────────────────────────
function HostMonitorBar({ tabId, host }) {
  const [stats, setStats]       = useState(null)
  const [status, setStatus]     = useState('connecting') // connecting | ok | error
  const [error, setError]       = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    setStatus('connecting')
    setStats(null)

    // Подписка на stats события
    const off = window.api.monitor.onStats(tabId, ({ stats: s }) => {
      if (!mountedRef.current) return
      setStats(s)
      setStatus('ok')
    })

    // Запуск мониторинга
    window.api.monitor.start(tabId, {
      host:         host.hostname || host.host,
      user:         host.user,
      port:         host.port,
      identityFile: host.identityFile,
    }).then((res) => {
      if (!mountedRef.current) return
      if (!res.ok) { setStatus('error'); setError(res.error || 'Ошибка подключения') }
    })

    return () => {
      mountedRef.current = false
      off?.()
      window.api.monitor.stop(tabId)
    }
  }, [tabId])

  // ── Состояние подключения ─────────────────────────────────────────────────
  if (status === 'connecting') {
    return (
      <div style={barStyle}>
        <span style={{ fontSize: 10, color: 'var(--text3)', padding: '0 12px' }}>
          ⏳ Подключение мониторинга…
        </span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={barStyle}>
        <span style={{ fontSize: 10, color: 'var(--red)', padding: '0 12px' }}>
          ⚠ {error}
        </span>
      </div>
    )
  }

  if (!stats) return <div style={barStyle} />

  const { cpu, memUsed, memTotal, txRate, rxRate, uptimeSecs, hostname, username, disks } = stats
  const memPct  = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0

  return (
    <div style={barStyle}>
      {/* Hostname */}
      <Metric
        icon="🖥"
        value={hostname || host.hostname || host.host}
        title={`Сервер: ${hostname}`}
      />
      <Sep />

      {/* CPU */}
      <Metric
        icon="⚙"
        bar barPct={cpu} barColor={cpuColor(cpu)}
        value={`${cpu}%`}
        color={cpuColor(cpu)}
        title={`CPU: ${cpu}%`}
      />
      <Sep />

      {/* RAM */}
      <Metric
        icon="▣"
        bar barPct={memPct} barColor={memPct >= 85 ? 'var(--red)' : memPct >= 65 ? 'var(--amber)' : 'var(--accent)'}
        value={`${fmtBytes(memUsed)} / ${fmtBytes(memTotal)}`}
        title={`Память: ${memPct}% (${fmtBytes(memUsed)} / ${fmtBytes(memTotal)})`}
      />
      <Sep />

      {/* Network TX */}
      <Metric
        icon="↑"
        value={fmtRate(txRate)}
        color={txRate > 1024 * 1024 ? 'var(--green)' : 'var(--text2)'}
        title={`Отправка: ${fmtRate(txRate)}`}
      />

      {/* Network RX */}
      <Metric
        icon="↓"
        value={fmtRate(rxRate)}
        color={rxRate > 1024 * 1024 ? 'var(--accent)' : 'var(--text2)'}
        title={`Получение: ${fmtRate(rxRate)}`}
      />
      <Sep />

      {/* Uptime */}
      <Metric
        icon="⏱"
        value={fmtUptime(uptimeSecs)}
        title={`Аптайм: ${fmtUptime(uptimeSecs)}`}
      />
      <Sep />

      {/* User */}
      <Metric
        icon="👤"
        value={username}
        color={username === 'root' ? 'var(--red)' : 'var(--text1)'}
        title={`Пользователь: ${username}`}
      />

      {/* Диски */}
      {disks && disks.length > 0 && (
        <>
          <Sep />
          {disks.map((d) => (
            <Metric
              key={d.mount}
              icon="💾"
              value={`${d.mount}: ${d.pct}%`}
              color={diskColor(d.pct)}
              title={`Диск ${d.mount}: ${d.pct}%`}
            />
          ))}
        </>
      )}
    </div>
  )
}

const barStyle = {
  display: 'flex',
  alignItems: 'center',
  height: 22,
  flexShrink: 0,
  background: 'var(--bg0)',
  borderTop: '1px solid var(--border)',
  overflow: 'hidden',
  contain: 'layout style',
}

export default React.memo(HostMonitorBar)
