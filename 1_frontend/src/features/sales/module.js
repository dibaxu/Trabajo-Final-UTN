import SalesListPage from './SalesListPage.jsx'
import NewSalePage from './NewSalePage.jsx'
import SaleDetailPage from './SaleDetailPage.jsx'

export default {
  id: 'ventas',
  routes: [
    { path: '/ventas', Component: SalesListPage },
    { path: '/ventas/nueva', Component: NewSalePage },
    { path: '/ventas/:id', Component: SaleDetailPage },
  ],
  nav: { to: '/ventas', label: 'Ventas', order: 20 },
  home: { order: 20, path: () => '/ventas/nueva' },
}
