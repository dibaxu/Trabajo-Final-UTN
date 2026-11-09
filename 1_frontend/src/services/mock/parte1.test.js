import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { saveSession } from '../../lib/session.js'
import { __useState, configureDb } from './db.js'
import { createSeedFrom } from './seedRunner.js'
import { userOf } from './ops/common.js'
import seedBase from './seeds/10-base.js'
import categories from './slices/categories.js'
import products from './slices/products.js'
import costs from './slices/costs.js'
import stockSlice from './slices/stock.js'

// PARTE 1: base, productos, costos y stock.
const api = { ...categories, ...products, ...costs, ...stockSlice }
const createSeed = createSeedFrom([seedBase])
configureDb({ seed: createSeed, version: 'test-parte1' })

let state
function loginAs(role) {
  const p = state.profiles.find((x) => x.role === role)
  saveSession({ accessToken: 't', refreshToken: 'r', expiresAt: Date.now() / 1000 + 3600, user: userOf(p) })
}
beforeEach(() => {
  state = createSeed()
  __useState(state)
  loginAs('ADMINISTRADOR')
})

const rejects = (promise, status) =>
  assert.rejects(promise, (e) => e.status === status, `esperaba estado ${status}`)

async function firstActive() {
  const [p] = await api.products.list({ status: 'active' })
  const [est] = await api.estimates.list({ productId: p.id })
  return { p, est }
}

test('stock = suma de movimientos y sin movimientos es 0', async () => {
  const stock = await api.stock.list({})
  const movs = await api.stock.movements({})
  for (const p of stock) {
    const sum = movs.filter((m) => m.productId === p.id).reduce((a, m) => a + m.quantityDelta, 0)
    assert.equal(p.stock, sum)
  }
  const created = await api.products.create({ name: 'Nuevo', categoryId: 1 })
  assert.equal(created.stock, 0)
})

test('ajuste de stock: solo admin, motivo obligatorio y sin negativos', async () => {
  const { p } = await firstActive()
  await rejects(api.stock.adjust({ productId: p.id, direction: 'DECREASE', quantity: p.stock + 1, reason: 'x' }), 409)
  await rejects(api.stock.adjust({ productId: p.id, direction: 'DECREASE', quantity: 1, reason: '' }), 400)
  await rejects(api.stock.adjust({ productId: p.id, direction: 'INCREASE', quantity: 0, reason: 'x' }), 400)
  const r = await api.stock.adjust({ productId: p.id, direction: 'DECREASE', quantity: 1, reason: 'Pieza rota' })
  assert.equal(r.stockAfter, r.stockBefore - 1)
  loginAs('OPERADOR')
  await rejects(api.stock.adjust({ productId: p.id, direction: 'INCREASE', quantity: 1, reason: 'x' }), 403)
  await rejects(api.stock.movements({}), 403)
  const prod = await api.stock.registerProduction({ productId: p.id, quantity: 4 })
  assert.equal(prod.stockAfter, r.stockAfter + 4)
  await rejects(api.stock.registerProduction({ productId: p.id, quantity: 0 }), 400)
})

test('producto: nombre obligatorio, sku único, sin negativos', async () => {
  await rejects(api.products.create({ name: ' ', categoryId: 1 }), 400)
  await rejects(api.products.create({ name: 'A', categoryId: 1, referenceSalePrice: -1 }), 400)
  await rejects(api.products.create({ name: 'A', categoryId: 1, sku: 'mac-001' }), 409)
  await rejects(api.products.create({ name: 'A' }), 400)
})

test('estimaciones: historial inmutable y primera vigente', async () => {
  const p = await api.products.create({ name: 'Con estimación', categoryId: 1 })
  const params = { weightGrams: 100, filamentPricePerKg: 20000, printHours: 1, printMinutes: 30, powerWatts: 200, kwhCost: 100, wearPerHour: 50, laborHours: 0, laborRate: 0, extras: 0 }
  const a = await api.estimates.create({ productId: p.id, params })
  const b = await api.estimates.create({ productId: p.id, params: { ...params, weightGrams: 200 } })
  const list = await api.estimates.list({ productId: p.id })
  assert.equal(list.length, 2)
  assert.equal(list.find((e) => e.id === a.id).isCurrent, true)
  assert.equal((await api.products.get(p.id)).currentCost, a.result.total)
  await api.estimates.setCurrent(b.id)
  assert.equal((await api.products.get(p.id)).currentCost, b.result.total)
  await rejects(api.estimates.create({ productId: p.id, params: { ...params, printMinutes: 60 } }), 400)
  await rejects(api.estimates.create({ productId: p.id, params: { ...params, extras: -1 } }), 400)
})
