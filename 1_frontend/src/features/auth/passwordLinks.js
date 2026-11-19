// Lógica pura del flujo "aceptar invitación" y "recuperar contraseña".
// Sin dependencias de React ni del navegador para poder probarla con `node --test`.

export const PASSWORD_MIN = 12
export const PASSWORD_MAX = 128

/**
 * Extrae `token_hash` del fragmento de la URL (lo que sigue al `#`).
 * Los enlaces de los correos tienen la forma `/auth/accept-invitation#token_hash=...`.
 * El fragmento no viaja al servidor; el token se envía luego por POST.
 */
export function readHashToken(hash) {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''))
  const token = params.get('token_hash')?.trim()
  return token || null
}

/**
 * Acepta el retorno estándar de Supabase o las plantillas propias con token_hash.
 * Un error o retorno incompleto es distinto de una URL sin enlace de acceso.
 * El tipo y vencimiento son controles del formato; la API valida la sesión real.
 */
export function readPasswordLink(hash, expectedType, now = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''))
  if (['error', 'error_code', 'error_description'].some((key) => params.has(key))) {
    return { kind: 'invalid' }
  }

  if (params.has('type') && params.get('type') !== expectedType) return { kind: 'invalid' }

  if (params.has('access_token') || params.has('refresh_token')) {
    const accessToken = params.get('access_token')?.trim()
    const refreshToken = params.get('refresh_token')?.trim()
    const expiresIn = Number(params.get('expires_in'))
    const expiresAt = params.has('expires_at') ? Number(params.get('expires_at')) : now + expiresIn
    if (
      !accessToken || !refreshToken || params.get('type') !== expectedType ||
      params.get('token_type') !== 'bearer' ||
      !Number.isSafeInteger(expiresIn) || expiresIn <= 0 ||
      !Number.isSafeInteger(expiresAt) || expiresAt <= now
    ) return { kind: 'invalid' }

    return {
      kind: 'session',
      session: { accessToken, refreshToken, expiresIn, expiresAt, tokenType: 'bearer' },
    }
  }

  const tokenHash = readHashToken(hash)
  if (tokenHash) return { kind: 'hash', tokenHash }
  return params.has('token_hash') || params.has('type') ? { kind: 'invalid' } : null
}

/** Valida la contraseña nueva y su confirmación. Devuelve un mensaje o '' si es válida. */
export function validateNewPassword(password, confirmation) {
  if (!password) return 'Ingresá una contraseña.'
  if (password.length < PASSWORD_MIN) return `Usá al menos ${PASSWORD_MIN} caracteres.`
  if (password.length > PASSWORD_MAX) return `Usá como máximo ${PASSWORD_MAX} caracteres.`
  if (password !== confirmation) return 'Las contraseñas no coinciden.'
  return ''
}
