import DashboardPage from './DashboardPage.jsx'
import { can } from '../auth/permissions.js'

export default {
  id: 'resumen',
  routes: [{ path: '/dashboard', Component: DashboardPage, permission: 'dashboard.view' }],
  nav: { to: '/dashboard', label: 'Resumen', order: 10, permission: 'dashboard.view' },
  home: { order: 10, path: (user) => (can(user, 'dashboard.view') ? '/dashboard' : null) },
}
