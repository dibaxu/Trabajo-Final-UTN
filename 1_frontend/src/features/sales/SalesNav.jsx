import { SubNav } from '../../components/SubNav.jsx'

export function SalesNav() {
  return (
    <SubNav
      items={[
        { to: '/ventas', label: 'Ventas' },
        { to: '/ventas/nueva', label: 'Nueva venta' },
      ]}
    />
  )
}
