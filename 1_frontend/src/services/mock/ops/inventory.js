// Movimientos de stock: el stock nunca se guarda, siempre se calcula sumando movimientos.
import { bad, nid } from './common.js'

export const MOVEMENT_TYPES = [
  'PRODUCCION',
  'VENTA',
  'DEVOLUCION',
  'ANULACION',
  'AJUSTE_POSITIVO',
  'AJUSTE_NEGATIVO',
]

export function stockMap(s) {
  const map = new Map()
  for (const m of s.stockMovements) map.set(m.productId, (map.get(m.productId) ?? 0) + m.quantityDelta)
  return map
}
export const stockOf = (s, productId) =>
  s.stockMovements.reduce((a, m) => (m.productId === productId ? a + m.quantityDelta : a), 0)

export function insertMovement(s, { productId, type, delta, reason = '', saleId = null, saleItemId = null, returnId = null, at }, actorId) {
  if (!MOVEMENT_TYPES.includes(type)) throw bad('Tipo de movimiento inválido.')
  if (!Number.isInteger(delta) || delta === 0) throw bad('La cantidad del movimiento debe ser distinta de cero.')
  const m = {
    id: nid(s, 'stockMovements'),
    productId,
    type,
    quantityDelta: delta,
    reason,
    saleId,
    saleItemId,
    returnId,
    occurredAt: at ?? new Date().toISOString(),
    createdBy: actorId,
  }
  s.stockMovements.push(m)
  return m
}

export function activeProduct(s, productId) {
  const p = s.products.find((x) => x.id === Number(productId))
  if (!p) throw bad('Seleccioná un producto.')
  if (!p.isActive) throw bad(`El producto "${p.name}" está inactivo.`)
  return p
}

