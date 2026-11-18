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

/** Valida la contraseña nueva y su confirmación. Devuelve un mensaje o '' si es válida. */
export function validateNewPassword(password, confirmation) {
  if (!password) return 'Ingresá una contraseña.'
  if (password.length < PASSWORD_MIN) return `Usá al menos ${PASSWORD_MIN} caracteres.`
  if (password.length > PASSWORD_MAX) return `Usá como máximo ${PASSWORD_MAX} caracteres.`
  if (password !== confirmation) return 'Las contraseñas no coinciden.'
  return ''
}
