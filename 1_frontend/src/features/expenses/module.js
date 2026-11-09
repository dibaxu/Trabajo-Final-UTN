import ExpensesPage from './ExpensesPage.jsx'

export default {
  id: 'gastos',
  routes: [{ path: '/gastos', Component: ExpensesPage, permission: 'expenses.manage' }],
  nav: { to: '/gastos', label: 'Gastos', order: 60, permission: 'expenses.manage' },
}
