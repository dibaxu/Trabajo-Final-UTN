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

/**
 * POST /api/auth/verify → SessionDto. Consume el enlace del correo (de un solo uso).
 * NO guarda la sesión: queda en memoria hasta que la persona define su contraseña.
 */
export function verifyLink(tokenHash, type) {
  return IS_MOCK
    ? mockAuth.verifyLink(tokenHash, type)
    : publicRequest('/auth/verify', { method: 'POST', body: { tokenHash, type } })
}

/**
 * PATCH /api/auth/password → SessionDto. Define la contraseña con la sesión devuelta
 * por `verifyLink` y guarda la sesión vigente que responde el servidor.
 * Si la contraseña es rechazada (400) la sesión verificada sigue siendo válida.
 */
export async function setPassword(verifiedSession, password) {
  const session = IS_MOCK
    ? await mockAuth.setPassword(verifiedSession, password)
    : await publicRequest('/auth/password', {
        method: 'PATCH',
        token: verifiedSession.accessToken,
        body: { password, refreshToken: verifiedSession.refreshToken },
      })
  saveSession(session)
  return session
}

/** POST /api/auth/forgot-password (202). Respuesta genérica: no revela si el correo existe. */
export function requestPasswordReset(email) {
  return IS_MOCK
    ? mockAuth.requestPasswordReset(email)
    : publicRequest('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } })
}
