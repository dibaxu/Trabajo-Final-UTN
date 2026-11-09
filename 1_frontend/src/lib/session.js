// Persistencia local de la sesión (token + perfil).
// El backend entrega { accessToken, refreshToken, expiresAt (segundos), user }.
export const SESSION_KEY = 'costos3d.session'

// Respaldo en memoria si localStorage no está disponible.
let memorySession = null

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s?.accessToken || !s?.refreshToken || !s?.user) return null
    return s
  } catch {
    return memorySession
  }
}

export function saveSession(session) {
  memorySession = {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    user: session.user,
  }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(memorySession))
  } catch {
    /* solo memoria */
  }
}

export function clearSession() {
  memorySession = null
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* nada que limpiar */
  }
}

/** ¿El access token sigue vigente? (con 30 s de margen) */
export function isExpired(session, now = Date.now()) {
  return !session?.expiresAt || session.expiresAt * 1000 - 30_000 <= now
}
