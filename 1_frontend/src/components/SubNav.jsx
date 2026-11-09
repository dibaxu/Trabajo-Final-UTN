import { NavLink } from 'react-router'

/** Pestañas de sección (p. ej. Estimador / Historial / Parámetros). */
export function SubNav({ items }) {
  return (
    <nav aria-label="Sección" className="mb-6 flex gap-1 overflow-x-auto border-b border-ink-200">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end
          className={({ isActive }) =>
            `-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
              isActive ? 'border-brand-500 text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-800'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
