import React, { createContext, useReducer, useCallback } from 'react'

export const UIContext = createContext()

const initialUIState = {
  // Вкладки
  tabs: [],
  activeTab: null,
  
  // UI состояние
  sidebarWidth: 240,
  sidebarHidden: false,
  compact: false,
  uiFullscreen: false,
  x11: false,
  monitorEnabled: false,
  
  // Модали
  showSettings: false,
  showTunnels: false,
  showAddHost: false,
  showExportImport: false,
  showHelp: false,
  editingHost: null,
}

function uiReducer(state, action) {
  switch (action.type) {
    case 'OPEN_TAB': {
      const newTab = action.payload
      return {
        ...state,
        tabs: [...state.tabs, newTab],
        activeTab: newTab.id,
      }
    }
    
    case 'CLOSE_TAB': {
      const remaining = state.tabs.filter(t => t.id !== action.payload)
      return {
        ...state,
        tabs: remaining,
        activeTab: remaining.length === 0 ? null : state.activeTab,
      }
    }
    
    case 'SELECT_TAB':
      return { ...state, activeTab: action.payload }
    
    case 'UPDATE_TAB': {
      const { tabId, updates } = action.payload
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === tabId ? { ...t, ...updates } : t
        ),
      }
    }
    
    case 'SET_TAB_COLOR': {
      const { tabId, color } = action.payload
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === tabId ? { ...t, color } : t
        ),
      }
    }
    
    case 'SET_SIDEBAR_WIDTH':
      return { ...state, sidebarWidth: action.payload }
    
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarHidden: !state.sidebarHidden }
    
    case 'SET_COMPACT':
      return { ...state, compact: action.payload }
    
    case 'SET_FULLSCREEN':
      return { ...state, uiFullscreen: action.payload }
    
    case 'TOGGLE_FULLSCREEN':
      return { ...state, uiFullscreen: !state.uiFullscreen }
    
    case 'SET_X11':
      return { ...state, x11: action.payload }
    
    case 'TOGGLE_X11':
      return { ...state, x11: !state.x11 }
    
    case 'TOGGLE_MONITOR':
      return { ...state, monitorEnabled: !state.monitorEnabled }
    
    case 'TOGGLE_SETTINGS':
      return { ...state, showSettings: !state.showSettings }
    
    case 'TOGGLE_TUNNELS':
      return { ...state, showTunnels: !state.showTunnels }
    
    case 'TOGGLE_ADD_HOST':
      return { ...state, showAddHost: !state.showAddHost }
    
    case 'TOGGLE_EXPORT_IMPORT':
      return { ...state, showExportImport: !state.showExportImport }
    
    case 'TOGGLE_HELP':
      return { ...state, showHelp: !state.showHelp }
    
    case 'SET_EDITING_HOST':
      return { ...state, editingHost: action.payload, showAddHost: action.payload ? true : false }
    
    case 'CLOSE_ALL_MODALS':
      return {
        ...state,
        showSettings: false,
        showTunnels: false,
        showAddHost: false,
        showExportImport: false,
        showHelp: false,
        editingHost: null,
      }
    
    default:
      return state
  }
}

export function UIProvider({ children }) {
  const [state, dispatch] = useReducer(uiReducer, initialUIState)
  
  // ✅ Все actions обёрнуты в useCallback для стабильности ссылок
  const actions = {
    openTab: useCallback(tab => dispatch({ type: 'OPEN_TAB', payload: tab }), []),
    closeTab: useCallback(tabId => dispatch({ type: 'CLOSE_TAB', payload: tabId }), []),
    selectTab: useCallback(tabId => dispatch({ type: 'SELECT_TAB', payload: tabId }), []),
    updateTab: useCallback((tabId, updates) => dispatch({ type: 'UPDATE_TAB', payload: { tabId, updates } }), []),
    setTabColor: useCallback((tabId, color) => dispatch({ type: 'SET_TAB_COLOR', payload: { tabId, color } }), []),
    setSidebarWidth: useCallback(width => dispatch({ type: 'SET_SIDEBAR_WIDTH', payload: width }), []),
    toggleSidebar: useCallback(() => dispatch({ type: 'TOGGLE_SIDEBAR' }), []),
    setCompact: useCallback(v => dispatch({ type: 'SET_COMPACT', payload: v }), []),
    setFullscreen: useCallback(v => dispatch({ type: 'SET_FULLSCREEN', payload: v }), []),
    toggleFullscreen: useCallback(() => dispatch({ type: 'TOGGLE_FULLSCREEN' }), []),
    setX11: useCallback(v => dispatch({ type: 'SET_X11', payload: v }), []),
    toggleX11: useCallback(() => dispatch({ type: 'TOGGLE_X11' }), []),
    toggleMonitor: useCallback(() => dispatch({ type: 'TOGGLE_MONITOR' }), []),
    toggleSettings: useCallback(() => dispatch({ type: 'TOGGLE_SETTINGS' }), []),
    toggleTunnels: useCallback(() => dispatch({ type: 'TOGGLE_TUNNELS' }), []),
    toggleAddHost: useCallback(() => dispatch({ type: 'TOGGLE_ADD_HOST' }), []),
    toggleExportImport: useCallback(() => dispatch({ type: 'TOGGLE_EXPORT_IMPORT' }), []),
    toggleHelp: useCallback(() => dispatch({ type: 'TOGGLE_HELP' }), []),
    setEditingHost: useCallback(host => dispatch({ type: 'SET_EDITING_HOST', payload: host }), []),
    closeAllModals: useCallback(() => dispatch({ type: 'CLOSE_ALL_MODALS' }), []),
  }

  const value = { state, actions, dispatch }
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const ctx = React.useContext(UIContext)
  if (!ctx) throw new Error('useUI должен использоваться внутри UIProvider')
  return ctx
}
