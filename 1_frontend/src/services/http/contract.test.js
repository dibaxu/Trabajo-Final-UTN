import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { saveSession } from '../../lib/session.js'
import catalog from './modules/catalog.js'
import stock from './modules/stock.js'

// Prueba de contrato: la forma de las peticiones (ruta, método, cuerpo) contra lo que declara
// 2_backend/openapi/openapi.json, con un `fetch` simulado.
const { categories, products } = catalog
const calls = []
let responder

beforeEach(() => {
  calls.length = 0
  saveSession({
    accessToken: 't',
    refreshToken: 'r',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'u1', role: 'ADMINISTRADOR' },
  })
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers?.Authorization })
    const data = responder(url, init)
    return { ok: true, status: 200, json: async () => data }
  }
})

const product = (over = {}) => ({
  id: 1, name: 'Llavero', categoryId: 2, categoryName: 'Hogar', sku: null, description: null,
  referenceSalePrice: 1500, manualCost: 800, isActive: true, imageUrl: null, stock: 4, ...over,
})

test('products.list arma la consulta y adapta el costo', async () => {
  responder = () => [product()]
  const rows = await products.list({ search: ' llave ', categoryId: '2', status: '' })
  assert.equal(calls[0].url, '/api/products?search=llave&categoryId=2')
  assert.equal(calls[0].auth, 'Bearer t')
  assert.equal(rows[0].currentCost, 800)
})

test('products.create envía solo campos permitidos', async () => {
  responder = () => product()
  await products.create({ name: 'A', categoryId: 2, sku: '', description: '', imageUrl: 'data:image/png;base64,x', referenceSalePrice: 10, currentCost: 5, weightGrams: 3, isActive: true })
  assert.deepEqual(calls[0].body, { name: 'A', categoryId: 2, sku: null, description: null, referenceSalePrice: 10, manualCost: 5, isActive: true })
  assert.equal(calls[0].method, 'POST')
})

test('products.update cambia el estado con su propio endpoint', async () => {
  let n = 0
  responder = () => product({ isActive: n++ === 0 }) // PATCH devuelve activo; se pide inactivo
  const result = await products.update(1, { ...product(), currentCost: 800, isActive: false })
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['PATCH /api/products/1', 'PATCH /api/products/1/status'])
  assert.deepEqual(calls[1].body, { isActive: false })
  assert.equal(result.isActive, false)
})

test('products.update no llama a /status si el estado no cambia', async () => {
  responder = () => product()
  await products.update(1, { name: 'B', isActive: true })
  assert.equal(calls.length, 1)
})

test('categories usa /product-categories', async () => {
  responder = () => ({ id: 1, name: 'Hogar', isActive: true })
  await categories.create({ name: 'Hogar' })
  await categories.update(1, { isActive: false })
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ['POST /api/product-categories', 'PATCH /api/product-categories/1'])
  assert.deepEqual(calls[1].body, { isActive: false })
})

test('stock: listado, movimientos, producción y ajustes', async () => {
  responder = (url) => (url.includes('/stock/production') || url.includes('/stock/adjustments')
    ? { movement: { id: 9, quantityDelta: 3 }, stockBefore: 1, stockAfter: 4 }
    : [{ id: 1, name: 'A', stock: 2 }])
  const rows = await stock.stock.list({ availability: 'available' })
  assert.equal(calls[0].url, '/api/stock?availability=available')
  assert.equal(rows[0].isActive, true)
  await stock.stock.movements({ productId: '3', from: '2026-11-01', to: '' })
  assert.equal(calls[1].url, '/api/stock/movements?productId=3&from=2026-11-01')
  const prod = await stock.stock.registerProduction({ productId: '3', quantity: '3', note: '' })
  assert.deepEqual(calls[2].body, { productId: 3, quantity: 3, note: null })
  assert.equal(prod.movement.saleId, null)
  await stock.stock.adjust({ productId: 3, direction: 'INCREASE', quantity: 2, reason: 'inventario' })
  assert.equal(calls[3].url, '/api/stock/adjustments')
  assert.deepEqual(calls[3].body, { productId: 3, direction: 'INCREASE', quantity: 2, reason: 'inventario' })
})
