import { authRequest, publicRequest } from '../../lib/http.js'
import { loadSession, saveSession, clearSession } from '../../lib/session.js'
import { IS_MOCK } from '../../services/mode.js'
import * as mockAuth from '../../services/mock/auth.js'

/** POST /api/auth/login → SessionDto. Guarda la sesión localmente. */
export async function login(email, password) {
  const session = IS_MOCK
    ? await mockAuth.login(email, password)
    : await publicRequest('/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      })
  saveSession(session)
  return session
}

/** GET /api/auth/me → perfil y rol vigentes (verifica token, sesión y estado activo). */
export function fetchCurrentUser() {
  return IS_MOCK ? mockAuth.me() : authRequest('/auth/me')
}

/** POST /api/auth/logout (204). Siempre borra la sesión local, falle o no la API. */
export async function logout() {
  const session = loadSession()
  try {
    if (session && !IS_MOCK) await authRequest('/auth/logout', { method: 'POST' })
  } catch {
    /* si la API no responde igual cerramos localmente */
  } finally {
    clearSession()
  }
}
