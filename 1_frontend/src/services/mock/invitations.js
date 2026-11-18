import { ApiError } from '../../lib/ApiError.js'
import { getState, write } from './db.js'
import { userOf } from './ops/common.js'

const SESSION_SECONDS = 8 * 60 * 60

// Enlaces de correo simulados: en modo demo, el único token válido es "demo"
// (abrir /auth/accept-invitation#token_hash=demo). Entra como el administrador de ejemplo.
function sessionFor(p) {
  return {
    accessToken: `mock-${p.id}`,
    refreshToken: `mock-refresh-${p.id}`,
    expiresIn: SESSION_SECONDS,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    tokenType: 'bearer',
    user: userOf(p),
  }
}

export async function verifyLink(tokenHash) {
  const p = getState().profiles.find((x) => x.role === 'ADMINISTRADOR' && x.isActive)
  if (tokenHash !== 'demo' || !p) throw new ApiError(401, 'Enlace inválido o vencido.')
  return sessionFor(p)
}

export async function setPassword(verifiedSession, password) {
  write((s) => {
    const p = s.profiles.find((x) => x.id === verifiedSession.user.id)
    if (!p) throw new ApiError(401, 'Se requiere una sesión válida.')
    p.password = password
    p.emailConfirmed = true
  })
  return verifiedSession
}

export async function requestPasswordReset() {
  return { message: 'Si el correo corresponde a una cuenta con acceso, recibirás un enlace.' }
}
