import React, { useEffect, useRef, useState, useCallback } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, drawSelection, highlightSpecialChars, dropCursor } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { json } from '@codemirror/lang-json'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { StreamLanguage } from '@codemirror/language'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { nginx } from '@codemirror/legacy-modes/mode/nginx'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'

function getLang(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const name = fileName.toLowerCase()
  switch (ext) {
    case 'js': case 'jsx': case 'ts': case 'tsx': return javascript()
    case 'py': return python()
    case 'css': return css()
    case 'html': case 'htm': return html()
    case 'json': return json()
    case 'xml': case 'svg': case 'plist': return xml()
    case 'yaml': case 'yml': return yaml()
    case 'sh': case 'bash': case 'zsh': case 'fish': return StreamLanguage.define(shell)
    case 'conf': case 'nginx': return StreamLanguage.define(nginx)
    case 'ini': case 'cfg': case 'env': case 'properties': return StreamLanguage.define(properties)
    case 'toml': return StreamLanguage.define(toml)
  }
  if (name === 'dockerfile') return StreamLanguage.define(dockerFile)
  return null
}

export default function EditorPane({ tab, onUpdate }) {
  const containerRef = useRef(null)
  const viewRef      = useRef(null)
  const [status, setStatus]   = useState('loading') // loading | ready | error | saving
  const [error, setError]     = useState('')
  const [saved, setSaved]     = useState(null)       // null | true | false
  const [modified, setModified] = useState(false)
  const saveTimerRef = useRef(null)

  const { sftpId, remotePath, fileName } = tab

  const saveFile = useCallback(async (content) => {
    setSaved(null)
    setStatus('saving')
    const res = await window.api.sftp.writeText(sftpId, remotePath, content)
    setStatus('ready')
    setSaved(res.ok)
    setModified(false)
    if (!res.ok) setError(res.error)
    setTimeout(() => setSaved(null), 2500)
  }, [sftpId, remotePath])

  useEffect(() => {
    if (!containerRef.current) return

    window.api.sftp.readText(sftpId, remotePath).then((res) => {
      if (!res.ok) { setStatus('error'); setError(res.error); return }

      const lang = getLang(fileName)
      const isDark = document.documentElement.style.getPropertyValue('--bg0')?.trim().startsWith('#0')
        || document.documentElement.style.getPropertyValue('--bg0')?.trim().startsWith('#1')

      const extensions = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab,
          { key: 'Mod-s', run: (view) => { saveFile(view.state.doc.toString()); return true } },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setModified(true)
            clearTimeout(saveTimerRef.current)
            saveTimerRef.current = setTimeout(() => {
              saveFile(update.state.doc.toString())
            }, 2000) // автосохранение через 2 сек после последнего изменения
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono, monospace)' },
          '.cm-content': { padding: '8px 0' },
        }),
        ...(isDark ? [oneDark] : [syntaxHighlighting(defaultHighlightStyle)]),
        ...(lang ? [lang] : []),
      ]

      const state = EditorState.create({ doc: res.content, extensions })
      const view = new EditorView({ state, parent: containerRef.current })
      viewRef.current = view
      setStatus('ready')
      onUpdate?.({ title: fileName, status: 'connected' })
    })

    return () => {
      clearTimeout(saveTimerRef.current)
      viewRef.current?.destroy()
    }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg0)' }}>

      {/* Шапка */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 14px', background: 'var(--bg1)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>
          📝 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text0)' }}>{remotePath}</span>
        </span>
        <div style={{ flex: 1 }} />

        {/* Статус */}
        {status === 'saving' && (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Сохраняю…</span>
        )}
        {saved === true && (
          <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ Сохранено</span>
        )}
        {saved === false && (
          <span style={{ fontSize: 11, color: 'var(--red)' }}>✗ {error}</span>
        )}
        {modified && saved === null && status !== 'saving' && (
          <span style={{ fontSize: 11, color: 'var(--amber)' }}>● не сохранено</span>
        )}

        <button
          onClick={() => saveFile(viewRef.current?.state.doc.toString() ?? '')}
          disabled={status === 'saving' || status === 'loading'}
          style={{
            fontSize: 11, padding: '4px 12px', borderRadius: 5, cursor: 'pointer',
            background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600,
            opacity: status === 'saving' ? 0.6 : 1,
          }}
        >
          Сохранить <span style={{ opacity: 0.7, fontSize: 10 }}>Ctrl+S</span>
        </button>
      </div>

      {/* Редактор */}
      {status === 'loading' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontSize: 13 }}>
          ⏳ Загрузка…
        </div>
      )}
      {status === 'error' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}
      <div
        ref={containerRef}
        style={{ flex: 1, overflow: 'hidden', display: status === 'error' || status === 'loading' ? 'none' : 'flex', flexDirection: 'column' }}
      />
    </div>
  )
}
