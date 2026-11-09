// Pequeño envoltorio de localStorage con respaldo en memoria.
// Capa temporal: se usa hasta integrar los módulos de productos y costos del backend.
const memory = new Map()

export function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return memory.has(key) ? memory.get(key) : fallback
  }
}

export function writeJson(key, value) {
  memory.set(key, value)
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* sin almacenamiento persistente: queda en memoria */
  }
}
