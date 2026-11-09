// Ventas, anulaciones y devoluciones (HU07, HU10, HU11, HU12).
import { bad, notFound, conflict, nid, text, num, userName } from './common.js'
import { activeProduct, insertMovement, stockOf } from './inventory.js'
import { dayRange } from '../../../lib/dates.js'
import { round2 } from '../../../features/costs/calc.js'

export const SALE_TYPES = ['MAYORISTA', 'MINORISTA']

export function returnedQty(s, saleItemId) {
  let total = 0
  for (const r of s.saleReturns) for (const it of r.items) if (it.saleItemId === saleItemId) total += it.quantity
  return total
}

export function insertSale(s, input, actorId, at = new Date().toISOString()) {
  if (!SALE_TYPES.includes(input.saleType)) throw bad('Indicá si la venta es mayorista o minorista.')
  if (!Array.isArray(input.items) || input.items.length === 0) throw bad('La venta debe tener al menos un producto.')

  // Un producto no puede repetirse: se acumulan las cantidades.
  const merged = new Map()
  for (const raw of input.items) {
    const prev = merged.get(Number(raw.productId))
    if (!prev) merged.set(Number(raw.productId), { ...raw, productId: Number(raw.productId) })
    else {
      if (Number(prev.unitPrice) !== Number(raw.unitPrice)) throw bad('Un mismo producto aparece con precios distintos.')
      prev.quantity = Number(prev.quantity) + Number(raw.quantity)
    }
  }

  const sale = {
    id: nid(s, 'sales'),
    status: 'CONFIRMADA',
    saleType: input.saleType,
    soldAt: at,
    notes: text(input.notes, 'Las notas', { max: 300 }),
    items: [],
    totalAmount: 0,
    totalCost: 0,
    grossMargin: 0,
    cancellationReason: null,
    cancelledBy: null,
    cancelledAt: null,
    createdBy: actorId,
    createdAt: new Date().toISOString(),
  }

  for (const raw of merged.values()) {
    const product = activeProduct(s, raw.productId)
    const quantity = num(raw.quantity, `Cantidad de "${product.name}"`, { int: true, positive: true })
    const unitPrice = num(raw.unitPrice, `Precio de "${product.name}"`)
    const available = stockOf(s, product.id)
    if (quantity > available) {
      throw conflict(`Stock insuficiente de "${product.name}": disponible ${available}.`)
    }

    let unitCost
    let costEstimateId = null
    if (raw.costSource === 'ESTIMACION') {
      const est = s.estimates.find((e) => e.id === Number(raw.costEstimateId))
      if (!est || est.productId !== product.id) {
        throw bad(`La estimación elegida no pertenece a "${product.name}".`)
      }
      costEstimateId = est.id
      unitCost = est.result.total
    } else if (raw.costSource === 'MANUAL') {
      unitCost = num(raw.unitCost, `Costo de "${product.name}"`)
    } else {
      throw bad(`Elegí el costo de "${product.name}": estimación o manual.`)
    }

    const lineTotal = round2(quantity * unitPrice)
    const lineCost = round2(quantity * unitCost)
    const item = {
      id: nid(s, 'saleItems'),
      productId: product.id,
      quantity,
      unitPrice,
      unitCost,
      costSource: raw.costSource,
      costEstimateId,
      lineTotal,
      lineCost,
      lineMargin: round2(lineTotal - lineCost),
    }
    sale.items.push(item)
    insertMovement(s, { productId: product.id, type: 'VENTA', delta: -quantity, saleId: sale.id, saleItemId: item.id, at }, actorId)
  }

  sale.totalAmount = round2(sale.items.reduce((a, i) => a + i.lineTotal, 0))
  sale.totalCost = round2(sale.items.reduce((a, i) => a + i.lineCost, 0))
  sale.grossMargin = round2(sale.totalAmount - sale.totalCost)
  s.sales.push(sale)
  return saleView(s, sale)
}

export function cancelSale(s, id, reason, actorId) {
  const sale = s.sales.find((x) => x.id === Number(id))
  if (!sale) throw notFound('Venta')
  const why = text(reason, 'El motivo de anulación', { required: true, max: 200 })
  if (sale.status === 'ANULADA') throw conflict('La venta ya fue anulada.')
  if (sale.status !== 'CONFIRMADA' || s.saleReturns.some((r) => r.saleId === sale.id)) {
    throw conflict('No se puede anular una venta con devoluciones.')
  }
  for (const it of sale.items) {
    insertMovement(s, { productId: it.productId, type: 'ANULACION', delta: it.quantity, reason: why, saleId: sale.id, saleItemId: it.id }, actorId)
  }
  Object.assign(sale, { status: 'ANULADA', cancellationReason: why, cancelledBy: actorId, cancelledAt: new Date().toISOString() })
  return saleView(s, sale)
}

export function createReturn(s, saleId, { reason, items }, actorId, at = new Date().toISOString()) {
  const sale = s.sales.find((x) => x.id === Number(saleId))
  if (!sale) throw notFound('Venta')
  if (sale.status === 'ANULADA') throw conflict('No se puede devolver una venta anulada.')
  const why = text(reason, 'El motivo de la devolución', { required: true, max: 200 })
  if (!Array.isArray(items) || items.length === 0) throw bad('La devolución debe incluir al menos un producto.')

  const wanted = new Map()
  for (const raw of items) {
    const itemId = Number(raw.saleItemId)
    const qty = num(raw.quantity, 'La cantidad a devolver', { int: true, positive: true })
    wanted.set(itemId, (wanted.get(itemId) ?? 0) + qty)
  }

  const ret = { id: nid(s, 'saleReturns'), saleId: sale.id, returnedAt: at, reason: why, items: [], createdBy: actorId }
  for (const [itemId, qty] of wanted) {
    const item = sale.items.find((i) => i.id === itemId)
    if (!item) throw bad('Solo pueden devolverse productos incluidos en la venta.')
    const remaining = item.quantity - returnedQty(s, itemId)
    if (qty > remaining) {
      const name = s.products.find((p) => p.id === item.productId)?.name
      throw conflict(`No se pueden devolver ${qty} de "${name}": quedan ${remaining} por devolver.`)
    }
    const ri = { id: nid(s, 'saleReturnItems'), saleItemId: itemId, quantity: qty }
    ret.items.push(ri)
    insertMovement(s, { productId: item.productId, type: 'DEVOLUCION', delta: qty, reason: why, saleId: sale.id, saleItemId: itemId, returnId: ret.id, at }, actorId)
  }
  s.saleReturns.push(ret)
  const allReturned = sale.items.every((i) => returnedQty(s, i.id) >= i.quantity)
  sale.status = allReturned ? 'DEVUELTA' : 'PARCIALMENTE_DEVUELTA'
  return saleView(s, sale)
}

export function saleView(s, sale) {
  return {
    ...sale,
    createdByName: userName(s, sale.createdBy),
    cancelledByName: sale.cancelledBy ? userName(s, sale.cancelledBy) : null,
    items: sale.items.map((i) => ({
      ...i,
      productName: s.products.find((p) => p.id === i.productId)?.name ?? '—',
      returnedQuantity: returnedQty(s, i.id),
    })),
    returns: s.saleReturns
      .filter((r) => r.saleId === sale.id)
      .map((r) => ({ ...r, createdByName: userName(s, r.createdBy) })),
  }
}

export function getSale(s, id) {
  const sale = s.sales.find((x) => x.id === Number(id))
  if (!sale) throw notFound('Venta')
  return saleView(s, sale)
}

export function listSales(s, { from, to, status, saleType } = {}) {
  const { start, end } = dayRange(from, to)
  return s.sales
    .filter((x) => {
      const t = new Date(x.soldAt).getTime()
      return t >= start && t <= end && (!status || x.status === status) && (!saleType || x.saleType === saleType)
    })
    .map((x) => {
      const v = saleView(s, x)
      return { ...v, itemCount: v.items.length, units: v.items.reduce((a, i) => a + i.quantity, 0) }
    })
    .sort((a, b) => b.soldAt.localeCompare(a.soldAt) || b.id - a.id)
}

