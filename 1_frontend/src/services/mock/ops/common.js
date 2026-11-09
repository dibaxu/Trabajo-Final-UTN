import { ApiError } from '../../../lib/ApiError.js'

export const bad = (message, details = []) => new ApiError(400, message, details)
export const notFound = (what) => new ApiError(404, `${what} no encontrado.`)
export const conflict = (message) => new ApiError(409, message)

export const nid = (s, key) => (s.counters[key] = (s.counters[key] ?? 0) + 1)
export const ci = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
export const text = (v, label, { required = false, max = 200 } = {}) => {
  const t = String(v ?? '').trim()
  if (required && !t) throw bad(`${label} es obligatorio.`)
  if (t.length > max) throw bad(`${label} no puede superar ${max} caracteres.`)
  return t
}

export function num(v, label, { int = false, positive = false } = {}) {
  const n = typeof v === 'string' ? Number(v.trim().replace(',', '.')) : v
  if (v === '' || v === null || v === undefined || typeof n !== 'number' || !Number.isFinite(n)) {
    throw bad(`${label}: ingresá un número válido.`)
  }
  if (int && !Number.isInteger(n)) throw bad(`${label} debe ser un número entero.`)
  if (positive ? n <= 0 : n < 0) {
    throw bad(positive ? `${label} debe ser mayor que cero.` : `${label} no puede ser negativo.`)
  }
  return n
}

export const findProfile = (s, id) => s.profiles.find((p) => p.id === id)
export const userName = (s, id) => findProfile(s, id)?.displayName ?? '—'

/** Datos públicos del perfil (lo que devuelve /auth/me). */
export const userOf = (p) => ({ id: p.id, email: p.email, displayName: p.displayName, role: p.role })
