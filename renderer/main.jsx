import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import './styles/global.css'
import { applyUITheme, DEFAULT_SETTINGS } from './termSettings'

// Применяем тему синхронно до первого рендера — убирает белый флеш
;(function () {
  try {
    const cache = JSON.parse(localStorage.getItem('asm-theme-cache') || '{}')
    applyUITheme(cache.uiTheme || DEFAULT_SETTINGS.uiTheme)
  } catch {
    applyUITheme(DEFAULT_SETTINGS.uiTheme)
  }
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
