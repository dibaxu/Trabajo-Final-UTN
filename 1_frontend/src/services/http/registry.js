// Implementaciones reales (modo http). Cada módulo del backend que se publique
// se agrega como ./modules/<nombre>.js (ver INTEGRACION.md); no hay que editar este archivo.
// Los módulos sin implementación responden 501.
import { notReady } from './notReady.js'

const modules = import.meta.glob('./modules/*.js', { eager: true })

const implemented = Object.assign({ maintenance: { resetDemoData: async () => {} } }, ...Object.values(modules).map((m) => m.default))

export const httpApi = new Proxy(implemented, {
  get: (target, name) => target[name] ?? notReady(String(name)),
})
