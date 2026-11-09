// Arma el estado inicial del backend simulado ejecutando los "seeds" en orden.
// Cada módulo aporta su archivo en ./seeds (ver registry.js); `ctx` comparte
// datos entre ellos (usuarios, ids de productos, etc.).

const DAY = 86_400_000

/** ISO de hace `n` días a la hora indicada (hora local). */
export const daysAgo = (n, hour = 11) => {
  const d = new Date(Date.now() - n * DAY)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

/** Estructura completa de datos (todas las colecciones del DER), vacía. */
export function emptyState() {
  return {
    counters: {},
    profiles: [],
    categories: [],
    products: [],
    costSettings: [],
    estimates: [],
    stockMovements: [],
    sales: [],
    saleReturns: [],
    expenseCategories: ['Insumos', 'Servicios', 'Transporte', 'Feria', 'Otros'].map((name, i) => ({
      id: i + 1,
      name,
      isActive: true,
    })),
    expenses: [],
  }
}

/** @param {Array<(s: object, ctx: object) => void>} seedFns en orden de ejecución */
export function createSeedFrom(seedFns) {
  return () => {
    const s = emptyState()
    const ctx = { daysAgo }
    for (const seed of seedFns) seed(s, ctx)
    return s
  }
}
