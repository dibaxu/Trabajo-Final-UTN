import { useAuth } from './useAuth.js'
import { can } from './permissions.js'
import { Forbidden } from '../../components/Forbidden.jsx'

/** Muestra su contenido solo con el permiso indicado; si no, "sin permisos". */
export function PermissionGuard({ permission, children }) {
  const { user } = useAuth()
  return can(user, permission) ? children : <Forbidden />
}
