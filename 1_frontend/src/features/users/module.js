import UsersPage from './UsersPage.jsx'

export default {
  id: 'usuarios',
  routes: [{ path: '/usuarios', Component: UsersPage, permission: 'users.manage' }],
  nav: { to: '/usuarios', label: 'Usuarios', order: 70, permission: 'users.manage' },
}
