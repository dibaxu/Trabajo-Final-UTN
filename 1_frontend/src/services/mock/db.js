// Base de datos simulada: un único objeto persistido en localStorage.
import { readJson, writeJson } from '../../lib/storage.js'

let seedFn = null
let key = 'costos3d.mock.db'
let state = null

/**
 * Lo llama registry.js al iniciar la app (y las pruebas, con sus propios seeds).
 * `version` identifica el conjunto de módulos: si cambia (se suma un módulo),
 * se parte de datos de ejemplo nuevos.
 */
export function configureDb({ seed, version }) {
  seedFn = seed
  key = `costos3d.mock.db.${version}`
  state = null
}

export function getState() {
  if (!state) {
    state = readJson(key, null)
    if (!state) {
      state = seedFn()
      writeJson(key, state)
    }
  }
  return state
}

/**
 * Ejecuta `fn(state)` de forma atómica: si lanza un error, el estado vuelve
 * exactamente a como estaba y no se guarda nada (equivale a una transacción).
 */
export function write(fn) {
  const current = getState()
  const snapshot = structuredClone(current)
  try {
    const result = fn(current)
    writeJson(key, current)
    return result
  } catch (error) {
    state = snapshot
    throw error
  }
}

export function resetDemoData() {
  state = seedFn()
  writeJson(key, state)
}

/** Solo para pruebas: arranca con un estado dado, en memoria. */
export function __useState(next) {
  state = next
}
