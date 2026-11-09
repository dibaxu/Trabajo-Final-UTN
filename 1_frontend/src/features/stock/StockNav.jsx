import { SubNav } from '../../components/SubNav.jsx'
import { useAuth } from '../auth/useAuth.js'
import { can } from '../auth/permissions.js'

export function StockNav() {
  const { user } = useAuth()
  const items = [
    { to: '/stock', label: 'Existencias' },
    ...(can(user, 'stock.movements') ? [{ to: '/stock/movimientos', label: 'Movimientos' }] : []),
  ]
  return <SubNav items={items} />
}
