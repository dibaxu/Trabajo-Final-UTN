// Registro de módulos de la aplicación. Cada carpeta de src/features puede
// incluir un `module.js` que declara sus pantallas, su lugar en el menú y,
// opcionalmente, a dónde llevar al usuario al iniciar sesión. Sumar un módulo
// = agregar su carpeta; no hay que editar App.jsx ni el menú.
//
// module.js → export default {
//   id: 'ventas',
//   routes: [{ path: '/ventas', Component: Page, permission?: 'sales.cancel' }],
//   nav: { to: '/ventas', label: 'Ventas', order: 20, permission?: '…' },
//   home: { order: 20, path: (user) => '/ventas/nueva' | null },
// }
import { can } from './features/auth/permissions.js'

const found = import.meta.glob('./features/*/module.js', { eager: true })

export const modules = Object.values(found).map((m) => m.default)

export const routes = modules.flatMap((m) => m.routes ?? [])

export function navItemsFor(user) {
  return modules
    .filter((m) => m.nav && (!m.nav.permission || can(user, m.nav.permission)))
    .map((m) => m.nav)
    .sort((a, b) => a.order - b.order)
}

/** Primer destino disponible según el orden de `home` de cada módulo. */
export function homePathFor(user) {
  const candidates = modules
    .filter((m) => m.home)
    .sort((a, b) => a.home.order - b.home.order)
  for (const m of candidates) {
    const path = m.home.path(user)
    if (path) return path
  }
  return '/login'
}
