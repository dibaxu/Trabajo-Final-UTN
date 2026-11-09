import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth.js'
import { FullScreenLoader } from '../../components/FullScreenLoader.jsx'

/** Envuelve las rutas privadas: sin sesión redirige al login. */
export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenLoader label="Recuperando sesión…" />
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
