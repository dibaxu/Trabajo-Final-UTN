import { ApiError } from '../../../lib/ApiError.js'
import { op } from '../op.js'
import { userOf } from '../ops/common.js'

const members = (s) =>
  s.profiles.map((p) => ({ ...userOf(p), isActive: p.isActive, emailConfirmed: p.emailConfirmed, invitedBy: p.invitedBy }))

const P = { permission: 'users.manage' }

export default {
  users: {
    list: op((s) => members(s), P),
    invite: op(
      (s, a, { email, displayName }) => {
        const mail = String(email ?? '').trim().toLowerCase()
        if (!/^\S+@\S+\.\S+$/.test(mail)) throw new ApiError(400, 'El correo no es válido.')
        if (!String(displayName ?? '').trim()) throw new ApiError(400, 'El nombre es obligatorio.')
        const existing = s.profiles.find((p) => p.email === mail)
        if (existing?.emailConfirmed) throw new ApiError(409, 'Ese correo ya tiene una cuenta activa.')
        if (!existing) {
          s.profiles.push({ id: crypto.randomUUID(), email: mail, password: null, displayName: displayName.trim(), role: 'ADMINISTRADOR', isActive: true, emailConfirmed: false, invitedBy: a.id })
        }
        return { message: 'Invitación enviada (simulada).' }
      },
      { ...P, tx: true },
    ),
    setStatus: op(
      (s, _a, id, isActive) => {
        const p = s.profiles.find((x) => x.id === id)
        if (!p) throw new ApiError(404, 'Usuario no encontrado.')
        const activeAdmins = s.profiles.filter((x) => x.role === 'ADMINISTRADOR' && x.isActive)
        if (!isActive && p.role === 'ADMINISTRADOR' && activeAdmins.length === 1 && activeAdmins[0].id === p.id) {
          throw new ApiError(409, 'No se puede deshabilitar al último administrador activo.')
        }
        p.isActive = Boolean(isActive)
        return members(s).find((m) => m.id === id)
      },
      { ...P, tx: true },
    ),
  },
}
