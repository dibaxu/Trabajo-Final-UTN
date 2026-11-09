import { Navigate } from 'react-router'
import { useAuth } from './useAuth.js'
import { homePathFor } from '../../modules.js'

/** Inicio según el rol: cada módulo declara si quiere ser la pantalla inicial. */
export function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={homePathFor(user)} replace />
}
