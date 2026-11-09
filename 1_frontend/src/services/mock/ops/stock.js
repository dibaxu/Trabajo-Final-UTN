// Producción, ajustes y consultas de stock (HU04, HU05, HU06, HU14).
import { bad, conflict, text, num, userName } from './common.js'
import { activeProduct, insertMovement, stockOf } from './inventory.js'
import { listProducts } from './catalog.js'
import { dayRange } from '../../../lib/dates.js'

export function registerProduction(s, { productId, quantity, note }, actorId) {
  const p = activeProduct(s, productId)
  const q = num(quantity, 'La cantidad', { int: true, positive: true })
  const reason = text(note, 'La observación', { max: 200 })
  const before = stockOf(s, p.id)
  const movement = insertMovement(s, { productId: p.id, type: 'PRODUCCION', delta: q, reason }, actorId)
  return { movement, stockBefore: before, stockAfter: before + q }
}

export function adjustStock(s, { productId, direction, quantity, reason }, actorId) {
  const p = activeProduct(s, productId)
  if (!['INCREASE', 'DECREASE'].includes(direction)) throw bad('Indicá si el ajuste aumenta o reduce el stock.')
  const q = num(quantity, 'La cantidad', { int: true, positive: true })
  const why = text(reason, 'El motivo', { required: true, max: 200 })
  const before = stockOf(s, p.id)
  const delta = direction === 'INCREASE' ? q : -q
  if (before + delta < 0) throw conflict(`El ajuste dejaría el stock negativo (actual: ${before}).`)
  const movement = insertMovement(
    s,
    { productId: p.id, type: delta > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO', delta, reason: why },
    actorId,
  )
  return { movement, stockBefore: before, stockAfter: before + delta }
}


export function listStock(s, { search = '', categoryId, availability = '' } = {}) {
  return listProducts(s, { search, categoryId, status: 'active' }).filter((p) => {
    if (availability === 'available') return p.stock > 0
    if (availability === 'out') return p.stock <= 0
    return true
  })
}

export function listMovements(s, { productId, type, from, to } = {}) {
  const { start, end } = dayRange(from, to)
  return s.stockMovements
    .filter((m) => {
      const t = new Date(m.occurredAt).getTime()
      return (
        t >= start &&
        t <= end &&
        (!productId || m.productId === Number(productId)) &&
        (!type || m.type === type)
      )
    })
    .map((m) => ({
      ...m,
      productName: s.products.find((p) => p.id === m.productId)?.name ?? '—',
      createdByName: userName(s, m.createdBy),
    }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id - a.id)
}

