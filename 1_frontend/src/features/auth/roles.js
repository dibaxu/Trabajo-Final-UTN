// El backend devuelve el código del rol (hoy solo ADMINISTRADOR en el MVP).
export const ROLES = {
  ADMINISTRADOR: 'Administrador',
  OPERADOR: 'Operador',
}

export const isAdmin = (user) => user?.role === 'ADMINISTRADOR'

export function roleLabel(role) {
  if (!role) return ''
  if (ROLES[role]) return ROLES[role]
  const lower = role.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}
