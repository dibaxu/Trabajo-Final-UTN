// Traducciones entre la forma de datos que usa la interfaz (la del backend simulado) y la que
// expone el backend real (ver 2_backend/openapi/openapi.json). Es código puro: se prueba con
// `node --test` (adapters.test.js). El backend rechaza campos desconocidos (400), por eso cada
// cuerpo se arma campo por campo.

const toNumber = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const nullIfBlank = (v) => {
  const t = typeof v === 'string' ? v.trim() : v
  return t === '' || t === undefined ? null : t
}

/** Arma `?a=1&b=2` descartando valores vacíos. */
export function queryString(params = {}) {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') q.set(key, String(value))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

/**
 * Backend → interfaz. El backend guarda el costo informado a mano en `manualCost`; la interfaz lo
 * muestra como `currentCost`. El peso no existe en el backend (queda en 0).
 */
export function productFromApi(p) {
  return { ...p, currentCost: p.manualCost ?? 0, weightGrams: 0 }
}

/** Interfaz → backend (POST/PATCH /products). `isActive` solo se envía al crear. */
export function productToApi(data, { creating = false } = {}) {
  const body = {}
  if (data.name !== undefined) body.name = String(data.name).trim()
  if (data.categoryId !== undefined) body.categoryId = Number(data.categoryId)
  if (data.sku !== undefined) body.sku = nullIfBlank(data.sku)
  if (data.description !== undefined) body.description = nullIfBlank(data.description)
  if (data.referenceSalePrice !== undefined) body.referenceSalePrice = toNumber(data.referenceSalePrice)
  if (data.currentCost !== undefined) {
    const cost = toNumber(data.currentCost)
    body.manualCost = cost > 0 ? cost : null
  }
  if (creating && data.isActive !== undefined) body.isActive = Boolean(data.isActive)
  return body
}

/** Interfaz → backend (POST/PATCH /product-categories). */
export function categoryToApi(data) {
  const body = {}
  if (data.name !== undefined) body.name = String(data.name).trim()
  if (data.isActive !== undefined) body.isActive = Boolean(data.isActive)
  return body
}

/** Backend → interfaz para GET /stock: completa lo que la pantalla de stock espera de un producto. */
export function stockRowFromApi(row) {
  return { isActive: true, imageUrl: null, ...row }
}

/** Backend → interfaz para GET /stock/movements: agrega los vínculos que aún no existen en el backend. */
export function movementFromApi(m) {
  return { saleId: null, saleItemId: null, returnId: null, ...m }
}

/** Interfaz → backend para registrar producción. */
export function productionToApi({ productId, quantity, note }) {
  return { productId: Number(productId), quantity: Number(quantity), note: nullIfBlank(note) }
}

/** Interfaz → backend para ajustes de stock. */
export function adjustmentToApi({ productId, direction, quantity, reason }) {
  return {
    productId: Number(productId),
    direction,
    quantity: Number(quantity),
    reason: String(reason ?? '').trim(),
  }
}

/** Respuesta de producción/ajuste: `{ movement, stockBefore, stockAfter }`. */
export function stockChangeFromApi(r) {
  return { ...r, movement: movementFromApi(r.movement) }
}
