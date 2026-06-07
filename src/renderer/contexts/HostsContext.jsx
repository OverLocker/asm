import React, { createContext, useReducer, useCallback } from 'react'

export const HostsContext = createContext()

const initialHostsState = {
  hosts: [],
  customGroups: [],
  notes: {},
  favorites: [],
  hostSettings: {},
  search: '',
  autoTunnels: {},
  history: [],
  tunnelRules: [],
}

function hostsReducer(state, action) {
  switch (action.type) {
    case 'SET_HOSTS':
      return { ...state, hosts: action.payload }
    
    case 'ADD_HOST':
      return { ...state, hosts: [...state.hosts, action.payload] }
    
    case 'UPDATE_HOST': {
      const { hostId, updates } = action.payload
      return {
        ...state,
        hosts: state.hosts.map(h =>
          h.host === hostId ? { ...h, ...updates } : h
        ),
      }
    }
    
    case 'DELETE_HOST':
      return { ...state, hosts: state.hosts.filter(h => h.host !== action.payload) }
    
    case 'SET_GROUPS':
      return { ...state, customGroups: action.payload }
    
    case 'SET_NOTES':
      return { ...state, notes: action.payload }
    
    case 'UPDATE_NOTE': {
      const { hostId, text } = action.payload
      return {
        ...state,
        notes: { ...state.notes, [hostId]: text },
      }
    }
    
    case 'TOGGLE_FAVORITE': {
      const hostId = action.payload
      const isFav = state.favorites.includes(hostId)
      return {
        ...state,
        favorites: isFav
          ? state.favorites.filter(h => h !== hostId)
          : [...state.favorites, hostId],
      }
    }
    
    case 'SET_FAVORITES':
      return { ...state, favorites: action.payload }
    
    case 'SET_SEARCH':
      return { ...state, search: action.payload }
    
    case 'UPDATE_HOST_SETTINGS': {
      const { hostId, settings } = action.payload
      return {
        ...state,
        hostSettings: {
          ...state.hostSettings,
          [hostId]: { ...state.hostSettings[hostId], ...settings },
        },
      }
    }
    
    case 'SET_HOST_SETTINGS':
      return { ...state, hostSettings: action.payload }
    
    case 'SET_AUTO_TUNNELS':
      return { ...state, autoTunnels: action.payload }
    
    case 'ADD_AUTO_TUNNEL': {
      const { hostId, tunnels } = action.payload
      return {
        ...state,
        autoTunnels: { ...state.autoTunnels, [hostId]: tunnels },
      }
    }
    
    case 'REMOVE_AUTO_TUNNEL': {
      const hostId = action.payload
      const { [hostId]: _, ...rest } = state.autoTunnels
      return { ...state, autoTunnels: rest }
    }
    
    case 'SET_HISTORY':
      return { ...state, history: action.payload }
    
    case 'SET_TUNNEL_RULES':
      return { ...state, tunnelRules: action.payload }
    
    case 'UPDATE_TUNNEL_RULES': {
      const rules = action.payload
      return { ...state, tunnelRules: rules }
    }
    
    default:
      return state
  }
}

export function HostsProvider({ children }) {
  const [state, dispatch] = useReducer(hostsReducer, initialHostsState)
  
  const actions = {
    setHosts: useCallback(hosts => dispatch({ type: 'SET_HOSTS', payload: hosts }), []),
    addHost: useCallback(host => dispatch({ type: 'ADD_HOST', payload: host }), []),
    updateHost: useCallback((hostId, updates) => dispatch({ type: 'UPDATE_HOST', payload: { hostId, updates } }), []),
    deleteHost: useCallback(hostId => dispatch({ type: 'DELETE_HOST', payload: hostId }), []),
    
    setGroups: useCallback(groups => dispatch({ type: 'SET_GROUPS', payload: groups }), []),
    
    setNotes: useCallback(notes => dispatch({ type: 'SET_NOTES', payload: notes }), []),
    updateNote: useCallback((hostId, text) => dispatch({ type: 'UPDATE_NOTE', payload: { hostId, text } }), []),
    
    toggleFavorite: useCallback(hostId => dispatch({ type: 'TOGGLE_FAVORITE', payload: hostId }), []),
    setFavorites: useCallback(favs => dispatch({ type: 'SET_FAVORITES', payload: favs }), []),
    
    setSearch: useCallback(search => dispatch({ type: 'SET_SEARCH', payload: search }), []),
    
    updateHostSettings: useCallback((hostId, settings) => dispatch({ type: 'UPDATE_HOST_SETTINGS', payload: { hostId, settings } }), []),
    setHostSettings: useCallback(hs => dispatch({ type: 'SET_HOST_SETTINGS', payload: hs }), []),
    
    setAutoTunnels: useCallback(tunnels => dispatch({ type: 'SET_AUTO_TUNNELS', payload: tunnels }), []),
    addAutoTunnel: useCallback((hostId, tunnels) => dispatch({ type: 'ADD_AUTO_TUNNEL', payload: { hostId, tunnels } }), []),
    removeAutoTunnel: useCallback(hostId => dispatch({ type: 'REMOVE_AUTO_TUNNEL', payload: hostId }), []),
    
    setHistory: useCallback(hist => dispatch({ type: 'SET_HISTORY', payload: hist }), []),
    
    setTunnelRules: useCallback(rules => dispatch({ type: 'SET_TUNNEL_RULES', payload: rules }), []),
    updateTunnelRules: useCallback(rules => dispatch({ type: 'UPDATE_TUNNEL_RULES', payload: rules }), []),
  }

  const value = { state, actions, dispatch }
  return <HostsContext.Provider value={value}>{children}</HostsContext.Provider>
}

export function useHosts() {
  const ctx = React.useContext(HostsContext)
  if (!ctx) throw new Error('useHosts должен использоваться внутри HostsProvider')
  return ctx
}
