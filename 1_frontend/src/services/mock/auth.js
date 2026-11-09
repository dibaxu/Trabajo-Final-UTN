import { ApiError } from '../../lib/ApiError.js'
import { loadSession, isExpired } from '../../lib/session.js'
import './registry.js' // configura la base simulada antes de usarla
import { getState } from './db.js'
import { userOf } from './ops/common.js'

const SESSION_SECONDS = 8 * 60 * 60

export async function login(email, password) {
  const p = getState().profiles.find((x) => x.email === String(email).trim().toLowerCase())
  // Mismo error si falla el correo o la contraseña.
  if (!p || p.password !== password) throw new ApiError(401, 'Credenciales inválidas.')
  if (!p.isActive) throw new ApiError(403, 'Acceso deshabilitado.')
  return {
    accessToken: `mock-${p.id}`,
    refreshToken: `mock-refresh-${p.id}`,
    expiresIn: SESSION_SECONDS,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    tokenType: 'bearer',
    user: userOf(p),
  }
}

export async function me() {
  const session = loadSession()
  if (!session || isExpired(session)) throw new ApiError(401, 'Se requiere una sesión válida.')
  const p = getState().profiles.find((x) => x.id === session.user.id)
  if (!p) throw new ApiError(401, 'Se requiere una sesión válida.')
  if (!p.isActive) throw new ApiError(403, 'Acceso deshabilitado.')
  return userOf(p)
}
