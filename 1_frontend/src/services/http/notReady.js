import { ApiError } from '../../lib/ApiError.js'

/** Módulo del backend que todavía no existe: toda operación falla con 501. */
export function notReady(moduleName) {
  return new Proxy(
    {},
    {
      get: () => async () => {
        throw new ApiError(501, `El módulo "${moduleName}" todavía no está disponible en el backend.`)
      },
    },
  )
}
