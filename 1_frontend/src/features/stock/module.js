import StockPage from './StockPage.jsx'
import MovementsPage from './MovementsPage.jsx'

export default {
  id: 'stock',
  routes: [
    { path: '/stock', Component: StockPage },
    { path: '/stock/movimientos', Component: MovementsPage, permission: 'stock.movements' },
  ],
  nav: { to: '/stock', label: 'Stock', order: 30 },
}
