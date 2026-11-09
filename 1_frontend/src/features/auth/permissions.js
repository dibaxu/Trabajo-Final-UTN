// Permisos por rol. El backend es quien manda; esto solo decide qué mostrar.
// En el MVP todos los miembros reales son ADMINISTRADOR; OPERADOR está
// previsto (ver HU15) y se puede probar con el usuario demo del modo mock.

/** HU09: "Operadores pueden acceder solamente si se decide habilitar ese permiso". */
export const OPERATOR_CAN_VIEW_DASHBOARD = false

const ADMIN_ONLY = new Set([
  'costSettings.manage', // HU13
  'stock.adjust', // HU06
  'stock.movements', // HU14
  'sales.cancel', // HU10
  'sales.return', // HU11
  'expenses.manage', // HU08
  'users.manage', // HU15
])

export function can(user, permission) {
  if (!user) return false
  if (user.role === 'ADMINISTRADOR') return true
  if (permission === 'dashboard.view') return OPERATOR_CAN_VIEW_DASHBOARD
  return !ADMIN_ONLY.has(permission)
}
