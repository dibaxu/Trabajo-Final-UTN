// Parámetros de costos y estimaciones (HU03, HU13).
import { bad, notFound, nid, num, userName } from './common.js'
import { calculateEstimate } from '../../../features/costs/calc.js'
import { PRICE_RULES } from '../../../features/costs/priceRules.js'

export function currentCostSetting(s, at = Date.now()) {
  return (
    [...s.costSettings]
      .filter((c) => new Date(c.effectiveFrom).getTime() <= at)
      .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom) || b.id - a.id)[0] ?? null
  )
}

export function listCostSettings(s) {
  return [...s.costSettings]
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom) || b.id - a.id)
    .map((c) => ({ ...c, createdByName: userName(s, c.createdBy) }))
}

export function createCostSetting(s, data, actorId) {
  const effective = data.effectiveFrom ? new Date(data.effectiveFrom) : new Date()
  if (Number.isNaN(effective.getTime())) throw bad('La fecha de vigencia no es válida.')
  const c = {
    id: nid(s, 'costSettings'),
    filamentPricePerKg: num(data.filamentPricePerKg, 'El precio del filamento'),
    electricityPricePerKwh: num(data.electricityPricePerKwh, 'El costo del kWh'),
    wearCostPerHour: num(data.wearCostPerHour, 'El desgaste por hora'),
    laborCostPerHour: num(data.laborCostPerHour, 'El valor de la hora de trabajo'),
    effectiveFrom: effective.toISOString(),
    createdBy: actorId,
    createdAt: new Date().toISOString(),
  }
  s.costSettings.push(c)
  return c
}

const PARAM_LABELS = {
  weightGrams: 'Peso',
  filamentPricePerKg: 'Precio del filamento',
  printHours: 'Horas de impresión',
  printMinutes: 'Minutos de impresión',
  powerWatts: 'Consumo eléctrico',
  kwhCost: 'Costo del kWh',
  wearPerHour: 'Desgaste por hora',
  laborHours: 'Horas de trabajo manual',
  laborRate: 'Valor de la hora de trabajo',
  extras: 'Costos extras',
}

export function createEstimate(s, { productId, params, costSettingId = null }, actorId) {
  const product = s.products.find((p) => p.id === Number(productId))
  if (!product) throw bad('Seleccioná un producto.')
  const clean = {}
  for (const [key, label] of Object.entries(PARAM_LABELS)) {
    clean[key] = num(params?.[key] ?? 0, label, { int: key === 'printHours' || key === 'printMinutes' })
  }
  if (clean.printMinutes > 59) throw bad('Los minutos deben estar entre 0 y 59.')
  const result = calculateEstimate(clean, PRICE_RULES)
  const first = !s.estimates.some((e) => e.productId === product.id && e.isCurrent)
  const e = {
    id: nid(s, 'estimates'),
    productId: product.id,
    costSettingId,
    params: clean,
    result,
    isCurrent: false,
    createdBy: actorId,
    createdAt: new Date().toISOString(),
  }
  s.estimates.push(e)
  if (first) markCurrentEstimate(s, e.id)
  return estimateView(s, e)
}

function estimateView(s, e) {
  return {
    ...e,
    productName: s.products.find((p) => p.id === e.productId)?.name ?? '—',
    createdByName: userName(s, e.createdBy),
  }
}

export function listEstimates(s, { productId } = {}) {
  return s.estimates
    .filter((e) => !productId || e.productId === Number(productId))
    .map((e) => estimateView(s, e))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
}

/** Marca una estimación como vigente del producto y actualiza su costo actual. */
export function markCurrentEstimate(s, id) {
  const e = s.estimates.find((x) => x.id === Number(id))
  if (!e) throw notFound('Estimación')
  for (const o of s.estimates) if (o.productId === e.productId) o.isCurrent = o.id === e.id
  const p = s.products.find((x) => x.id === e.productId)
  p.currentCost = e.result.total
  p.currentEstimateId = e.id
  p.updatedAt = new Date().toISOString()
  return estimateView(s, e)
}

