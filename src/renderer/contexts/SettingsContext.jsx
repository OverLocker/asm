import React, { createContext, useReducer, useCallback } from 'react'
import { DEFAULT_SETTINGS } from '../termSettings'

export const SettingsContext = createContext()

// ✅ Синхронно читаем кеш настроек из localStorage —
//    это даёт правильную тему ДО загрузки с диска
function loadCachedSettings() {
  try {
    const raw = localStorage.getItem('asm-settings-cache-full')
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

const cached = loadCachedSettings()

const initialSettingsState = {
  // Если кеш есть — стартуем сразу с правильными настройками
  termSettings: cached ? { ...DEFAULT_SETTINGS, ...cached } : DEFAULT_SETTINGS,
  pendingSettings: null,
}

function settingsReducer(state, action) {
  switch (action.type) {
    case 'SET_SETTINGS':
      return { ...state, termSettings: action.payload }
    
    case 'UPDATE_SETTING': {
      const { key, value } = action.payload
      return {
        ...state,
        termSettings: { ...state.termSettings, [key]: value },
      }
    }
    
    case 'BATCH_UPDATE_SETTINGS': {
      return {
        ...state,
        termSettings: { ...state.termSettings, ...action.payload },
      }
    }
    
    case 'SET_PENDING_SETTINGS':
      return { ...state, pendingSettings: action.payload }
    
    default:
      return state
  }
}

export function SettingsProvider({ children }) {
  const [state, dispatch] = useReducer(settingsReducer, initialSettingsState)
  
  const actions = {
    setSettings: useCallback(settings => dispatch({ type: 'SET_SETTINGS', payload: settings }), []),
    updateSetting: useCallback((key, value) => dispatch({ type: 'UPDATE_SETTING', payload: { key, value } }), []),
    batchUpdateSettings: useCallback(updates => dispatch({ type: 'BATCH_UPDATE_SETTINGS', payload: updates }), []),
    setPendingSettings: useCallback(settings => dispatch({ type: 'SET_PENDING_SETTINGS', payload: settings }), []),
  }

  const value = { state, actions, dispatch }
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = React.useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings должен использоваться внутри SettingsProvider')
  return ctx
}
