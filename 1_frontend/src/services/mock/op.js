// Envoltorio común de las operaciones del backend simulado: exige sesión,
// comprueba el permiso, opcionalmente abre una transacción y devuelve una copia.
import { ApiError } from '../../lib/ApiError.js'
import { loadSession } from '../../lib/session.js'
import { can } from '../../features/auth/permissions.js'
import { getState, write } from './db.js'
import { userOf } from './ops/common.js'

function actor(s) {
  const session = loadSession()
  const p = s.profiles.find((x) => x.id === session?.user?.id)
  if (!p || !p.isActive) throw new ApiError(401, 'Se requiere una sesión válida.')
  return p
}

function authorize(s, permission) {
  const a = actor(s)
  if (permission && !can(userOf(a), permission)) throw new ApiError(403, 'No tenés permisos para esta acción.')
  return a
}

/** `fn(state, actor, ...args)`. Opciones: `permission` y `tx` (transacción atómica). */
export const op = (fn, { permission, tx = false } = {}) => async (...args) => {
  const run = (s) => fn(s, authorize(s, permission), ...args)
  return structuredClone(tx ? write(run) : run(getState()))
}
