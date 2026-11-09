import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/useAuth.js'
import { navItemsFor } from '../modules.js'
import { roleLabel } from '../features/auth/roles.js'
import { IS_MOCK } from '../services/mode.js'
import { api } from '../services/index.js'
import { BRAND } from '../config/brand.js'

const linkClass = ({ isActive }) =>
  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
  }`

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [resetting, setResetting] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  async function handleReset() {
    if (!window.confirm('Se borrarán los datos de prueba actuales y se cargarán los de ejemplo. ¿Continuar?')) return
    setResetting(true)
    await api.maintenance.resetDemoData()
    await logout()
    window.location.assign('/login')
  }

  return (
    <div className="min-h-screen">
      {IS_MOCK && (
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">
          Modo demo: los datos se guardan solo en este navegador.{' '}
          <button onClick={handleReset} disabled={resetting} className="font-semibold underline">
            Restablecer datos de ejemplo
          </button>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img src={BRAND.logo} alt="" className="size-10 rounded-full" />
            <span className="font-semibold tracking-tight">{BRAND.name}</span>
          </div>

          <nav aria-label="Principal" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 lg:order-none lg:w-auto">
            {navItemsFor(user).map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="max-w-40 truncate text-sm font-medium">{user.displayName}</p>
              <p className="text-xs text-ink-500">{roleLabel(user.role)}</p>
            </div>
            <button onClick={handleLogout} className="rounded-lg border border-ink-300 px-3 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-ink-100">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
