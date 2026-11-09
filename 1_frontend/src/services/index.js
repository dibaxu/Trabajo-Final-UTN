// Punto único de acceso a los datos. La interfaz solo importa `api`.
//
// VITE_API_MODE=mock  → backend simulado en el navegador (por defecto).
// VITE_API_MODE=http  → backend real; los módulos sin implementar responden 501.
import { IS_MOCK } from './mode.js'
import { mockApi } from './mock/registry.js'
import { httpApi } from './http/registry.js'

export const api = IS_MOCK ? mockApi : httpApi
