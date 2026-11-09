import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './AuthContext.js'
import * as authApi from './authApi.js'
import { ApiError, configureHttp } from '../../lib/http.js'
import {
  SESSION_KEY,
  clearSession,
  isExpired,
  loadSession,
} from '../../lib/session.js'

// status: 'loading' (recuperando sesión) | 'authenticated' | 'anonymous'
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null })

  const setAnonymous = useCallback(
    () => setState({ status: 'anonymous', user: null }),
    [],
  )

  useEffect(() => {
    // Si la API descarta la sesión (401/403 irrecuperable) volvemos al login.
    configureHttp({
      onSessionLost: setAnonymous,
      onSessionRefreshed: (s) =>
        setState((prev) =>
          prev.status === 'authenticated' ? { ...prev, user: s.user } : prev,
        ),
    })

    // Recuperación de sesión al recargar la página.
    let cancelled = false
    ;(async () => {
      const stored = loadSession()
      if (!stored) return !cancelled && setAnonymous()
      try {
        // fetchCurrentUser renueva el token si hace falta y valida estado/rol actuales.
        const user = await authApi.fetchCurrentUser()
        if (!cancelled) setState({ status: 'authenticated', user })
      } catch (error) {
        if (cancelled) return
        const offline = error instanceof ApiError && error.status === 0
        if (offline && !isExpired(stored)) {
          // Sin red pero con token vigente: se conserva la sesión; la API
          // volverá a validarla en la siguiente petición.
          setState({ status: 'authenticated', user: stored.user })
        } else {
          clearSession()
          setAnonymous()
        }
      }
    })()

    // Cierre de sesión en otra pestaña.
    const onStorage = (e) => {
      if (e.key === SESSION_KEY && !e.newValue) setAnonymous()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      cancelled = true
      window.removeEventListener('storage', onStorage)
    }
  }, [setAnonymous])

  const login = useCallback(async (email, password) => {
    const session = await authApi.login(email, password)
    setState({ status: 'authenticated', user: session.user })
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout()
    setAnonymous()
  }, [setAnonymous])

  const value = useMemo(
    () => ({ ...state, login, logout }),
    [state, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
