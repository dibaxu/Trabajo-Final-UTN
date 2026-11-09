import { SubNav } from '../../components/SubNav.jsx'
import { useAuth } from '../auth/useAuth.js'
import { can } from '../auth/permissions.js'

export function CostsNav() {
  const { user } = useAuth()
  const items = [
    { to: '/costos', label: 'Estimador' },
    { to: '/costos/historial', label: 'Historial' },
    ...(can(user, 'costSettings.manage') ? [{ to: '/costos/parametros', label: 'Parámetros' }] : []),
  ]
  return <SubNav items={items} />
}
