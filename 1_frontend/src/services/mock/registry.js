// Registro automático del backend simulado: descubre los archivos de cada módulo.
//   ./seeds/NN-nombre.js   datos de ejemplo (se ejecutan por orden de nombre)
//   ./slices/nombre.js     operaciones de la API (api.<módulo>.<operación>)
// Sumar un módulo = agregar sus archivos en esas carpetas; no hay que editar este.
import { configureDb, resetDemoData } from './db.js'
import { createSeedFrom } from './seedRunner.js'

const seedModules = import.meta.glob('./seeds/*.js', { eager: true })
const sliceModules = import.meta.glob('./slices/*.js', { eager: true })

const seedNames = Object.keys(seedModules).sort()

configureDb({
  seed: createSeedFrom(seedNames.map((name) => seedModules[name].default)),
  version: seedNames.map((n) => n.replace(/^.*\/(\d+)-([\w-]+)\.js$/, '$1$2')).join('_'),
})

export const mockApi = Object.assign(
  { maintenance: { resetDemoData: async () => resetDemoData() } },
  ...Object.values(sliceModules).map((m) => m.default),
)
