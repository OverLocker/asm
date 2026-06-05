import React, { useState, useEffect, useRef } from 'react'

// Универсальный модал для ввода строки — замена prompt()
// Использование:
//   const { inputModal, askInput } = useInputModal()
//   ...
//   const name = await askInput('Название группы:', '')
//   ...
//   return <>{inputModal}</>

export function useInputModal() {
  const [state, setState] = useState(null) // { title, defaultValue, resolve }

  const askInput = (title, defaultValue = '') => {
    return new Promise((resolve) => {
      setState({ title, defaultValue, resolve })
    })
  }

  const handleOk = (value) => {
    state?.resolve(value.trim() || null)
    setState(null)
  }

  const handleCancel = () => {
    state?.resolve(null)
    setState(null)
  }

  const inputModal = state ? (
    <InputModalUI
      title={state.title}
      defaultValue={state.defaultValue}
      onOk={handleOk}
      onCancel={handleCancel}
    />
  ) : null

  return { inputModal, askInput }
}

function InputModalUI({ title, defaultValue, onOk, onCancel }) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = () => { if (value.trim()) onOk(value) }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 5000,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={onCancel}
    >
      <div
        style={{
          background: 'var(--bg1)', border: '1px solid var(--border2)',
          borderRadius: 10, padding: 20, minWidth: 280,
          boxShadow: '0 8px 32px rgba(0,0,0,.15)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text0)', marginBottom: 12 }}>
          {title}
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onCancel()
          }}
          style={{ width: '100%', marginBottom: 14 }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 16px', borderRadius: 6, fontSize: 12,
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              color: 'var(--text1)', cursor: 'pointer',
            }}
          >Отмена</button>
          <button
            onClick={submit}
            disabled={!value.trim()}
            style={{
              padding: '6px 16px', borderRadius: 6, fontSize: 12,
              background: 'var(--accent)', border: 'none',
              color: '#fff', fontWeight: 600,
              cursor: value.trim() ? 'pointer' : 'default',
              opacity: value.trim() ? 1 : 0.5,
            }}
          >OK</button>
        </div>
      </div>
    </div>
  )
}
