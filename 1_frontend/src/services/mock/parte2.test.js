import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { saveSession } from '../../lib/session.js'
import { __useState, configureDb } from './db.js'
import { createSeedFrom } from './seedRunner.js'
import { userOf } from './ops/common.js'
import seedBase from './seeds/10-base.js'
import seedSales from './seeds/50-sales.js'
import seedExpenses from './seeds/60-expenses.js'
import categories from './slices/categories.js'
import products from './slices/products.js'
import costs from './slices/costs.js'
import stockSlice from './slices/stock.js'
import sales from './slices/sales.js'
import expenses from './slices/expenses.js'
import reports from './slices/reports.js'
import users from './slices/users.js'

// PARTE 2: ventas, gastos, resumen y usuarios (sobre la base de la parte 1).
const api = { ...categories, ...products, ...costs, ...stockSlice, ...sales, ...expenses, ...reports, ...users }
const createSeed = createSeedFrom([seedBase, seedSales, seedExpenses])
configureDb({ seed: createSeed, version: 'test-parte2' })

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

const line = (p, est, quantity = 1, unitPrice = 1000) => ({
  productId: p.id, quantity, unitPrice, costSource: 'ESTIMACION', costEstimateId: est.id,
})

test('venta: descuenta stock, guarda costo histórico y suma duplicados', async () => {
  const { p, est } = await firstActive()
  const before = p.stock
  const sale = await api.sales.create({ saleType: 'MINORISTA', items: [line(p, est, 2, 5000), line(p, est, 3, 5000)] })
  assert.equal(sale.items.length, 1)
  assert.equal(sale.items[0].quantity, 5)
  assert.equal(sale.totalAmount, 25000)
  assert.equal(sale.grossMargin, 25000 - 5 * est.result.total)
  assert.equal((await api.products.get(p.id)).stock, before - 5)
  // cambiar el costo actual no altera la venta anterior
  await api.products.update(p.id, { ...p, currentCost: 999999 })
  assert.equal((await api.sales.get(sale.id)).items[0].unitCost, est.result.total)
})

test('venta atómica: si falla un detalle no se guarda nada', async () => {
  const { p, est } = await firstActive()
  const stockBefore = (await api.products.get(p.id)).stock
  const salesBefore = (await api.sales.list({})).length
  const movBefore = (await api.stock.movements({})).length
  await rejects(
    api.sales.create({ saleType: 'MAYORISTA', items: [line(p, est, 1), line({ id: 99999 }, est, 1)] }),
    400,
  )
  assert.equal((await api.products.get(p.id)).stock, stockBefore)
  assert.equal((await api.sales.list({})).length, salesBefore)
  assert.equal((await api.stock.movements({})).length, movBefore)
})

test('validaciones de venta', async () => {
  const { p, est } = await firstActive()
  await rejects(api.sales.create({ items: [line(p, est)] }), 400) // sin tipo
  await rejects(api.sales.create({ saleType: 'MINORISTA', items: [] }), 400)
  await rejects(api.sales.create({ saleType: 'MINORISTA', items: [line(p, est, 0)] }), 400)
  await rejects(api.sales.create({ saleType: 'MINORISTA', items: [line(p, est, 1.5)] }), 400)
  await rejects(api.sales.create({ saleType: 'MINORISTA', items: [line(p, est, p.stock + 1)] }), 409)
  const other = (await api.estimates.list({})).find((e) => e.productId !== p.id)
  await rejects(api.sales.create({ saleType: 'MINORISTA', items: [{ ...line(p, other), costEstimateId: other.id }] }), 400)
  await rejects(api.sales.create({ saleType: 'MINORISTA', items: [{ productId: p.id, quantity: 1, unitPrice: 10, costSource: 'MANUAL', unitCost: -1 }] }), 400)
  const inactive = (await api.products.list({ status: 'inactive' }))[0]
  await rejects(api.sales.create({ saleType: 'MINORISTA', items: [{ productId: inactive.id, quantity: 1, unitPrice: 1, costSource: 'MANUAL', unitCost: 0 }] }), 400)
})

test('anulación restituye stock, exige motivo y no se repite', async () => {
  const { p, est } = await firstActive()
  const before = (await api.products.get(p.id)).stock
  const sale = await api.sales.create({ saleType: 'MINORISTA', items: [line(p, est, 2)] })
  await rejects(api.sales.cancel(sale.id, ' '), 400)
  const cancelled = await api.sales.cancel(sale.id, 'Error de carga')
  assert.equal(cancelled.status, 'ANULADA')
  assert.equal((await api.products.get(p.id)).stock, before)
  await rejects(api.sales.cancel(sale.id, 'otra vez'), 409)
  assert.equal(cancelled.items.length, 1) // los detalles se conservan
})

test('devoluciones: parcial, total, límites y bloqueo de anulación', async () => {
  const { p, est } = await firstActive()
  const sale = await api.sales.create({ saleType: 'MINORISTA', items: [line(p, est, 3)] })
  const itemId = sale.items[0].id
  let r = await api.sales.createReturn(sale.id, { reason: 'x', items: [{ saleItemId: itemId, quantity: 1 }] })
  assert.equal(r.status, 'PARCIALMENTE_DEVUELTA')
  await rejects(api.sales.cancel(sale.id, 'motivo'), 409)
  await rejects(api.sales.createReturn(sale.id, { reason: 'x', items: [{ saleItemId: itemId, quantity: 3 }] }), 409)
  await rejects(api.sales.createReturn(sale.id, { reason: '', items: [{ saleItemId: itemId, quantity: 1 }] }), 400)
  r = await api.sales.createReturn(sale.id, { reason: 'x', items: [{ saleItemId: itemId, quantity: 2 }] })
  assert.equal(r.status, 'DEVUELTA')
})

test('dashboard: coherente con ventas, devoluciones y anulaciones', async () => {
  const month = { from: '2000-01-01', to: '2999-12-31' }
  const d0 = await api.reports.dashboard(month)
  assert.equal(d0.revenue, d0.byType.MAYORISTA.revenue + d0.byType.MINORISTA.revenue)
  assert.equal(d0.netResult, Math.round((d0.revenue - d0.cogs - d0.expenses) * 100) / 100)
  const sales = (await api.sales.list(month)).filter((s) => s.status !== 'ANULADA')
  const gross = sales.reduce((a, s) => a + s.totalAmount, 0)
  assert.ok(d0.revenue <= gross) // hay una devolución en el seed
  const { p, est } = await firstActive()
  const sale = await api.sales.create({ saleType: 'MAYORISTA', items: [line(p, est, 1, 700)] })
  const d1 = await api.reports.dashboard(month)
  assert.equal(d1.revenue, Math.round((d0.revenue + 700) * 100) / 100)
  await api.sales.cancel(sale.id, 'prueba')
  assert.deepEqual(await api.reports.dashboard(month), d0)
  const empty = await api.reports.dashboard({ from: '1990-01-01', to: '1990-01-31' })
  assert.equal(empty.revenue + empty.cogs + empty.expenses + empty.units, 0)
})

test('gastos: importe > 0, categoría obligatoria, anulación y permisos', async () => {
  await rejects(api.expenses.create({ categoryId: 1, incurredOn: '2026-10-01', amount: 0 }), 400)
  await rejects(api.expenses.create({ incurredOn: '2026-10-01', amount: 5 }), 400)
  const e = await api.expenses.create({ categoryId: 1, incurredOn: '2026-10-01', amount: 5, description: 'x' })
  await api.expenses.void(e.id)
  await rejects(api.expenses.update(e.id, { categoryId: 1, incurredOn: '2026-10-01', amount: 6 }), 409)
  loginAs('OPERADOR')
  await rejects(api.expenses.list({}), 403)
  await rejects(api.reports.dashboard({}), 403)
})

test('usuarios: no se deshabilita al último administrador activo', async () => {
  const admin = state.profiles.find((p) => p.role === 'ADMINISTRADOR')
  await rejects(api.users.setStatus(admin.id, false), 409)
})
