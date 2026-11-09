import { ApiError } from './ApiError.js'
import { clearSession, isExpired, loadSession, saveSession } from './session.js'

const BASE_URL = (import.meta.env?.VITE_API_URL ?? '/api').replace(/\/$/, '')

export { ApiError }

let onSessionLost = () => {}
let onSessionRefreshed = () => {}

/** El AuthProvider se engancha acá para enterarse de cambios de sesión. */
export function configureHttp(handlers) {
  onSessionLost = handlers.onSessionLost ?? onSessionLost
  onSessionRefreshed = handlers.onSessionRefreshed ?? onSessionRefreshed
}

async function rawFetch(path, { method = 'GET', body, token } = {}) {
  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor.')
  }

  if (res.status === 204) return null

  let data = null
  try {
    data = await res.json()
  } catch {
    /* respuesta sin JSON (p. ej. error de infraestructura) */
  }

  if (!res.ok) {
    const msg = data?.message
    const details = Array.isArray(msg) ? msg : []
    const message = typeof msg === 'string' ? msg : 'Error inesperado.'
    throw new ApiError(res.status, message, details)
  }
  return data
}

// Renovación única: si varias peticiones fallan a la vez comparten la misma promesa.
let refreshing = null

export function refreshSession() {
  if (refreshing) return refreshing
  refreshing = (async () => {
    const current = loadSession()
    if (!current) throw new ApiError(401, 'Sin sesión.')
    const fresh = await rawFetch('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: current.refreshToken },
    })
    saveSession(fresh)
    onSessionRefreshed(fresh)
    return fresh
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

function loseSession() {
  clearSession()
  onSessionLost()
}

/** Petición pública (login, etc.). */
export const publicRequest = rawFetch

/**
 * Petición autenticada: renueva el token si está por vencer y reintenta una
 * vez ante un 401. Si no se puede recuperar la sesión, la descarta.
 */
export async function authRequest(path, options = {}) {
  let session = loadSession()
  if (!session) {
    loseSession()
    throw new ApiError(401, 'Se requiere una sesión válida.')
  }

  try {
    if (isExpired(session)) session = await refreshSession()
    return await rawFetch(path, { ...options, token: session.accessToken })
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      if (error instanceof ApiError && error.status === 403) loseSession()
      throw error
    }
  }

  // 401: un intento de renovación y reintento.
  try {
    const fresh = await refreshSession()
    return await rawFetch(path, { ...options, token: fresh.accessToken })
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      loseSession()
    }
    throw error
  }
}
