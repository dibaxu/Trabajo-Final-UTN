import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adjustmentToApi,
  categoryToApi,
  movementFromApi,
  productFromApi,
  productToApi,
  productionToApi,
  queryString,
  stockRowFromApi,
} from './adapters.js'

test('queryString descarta valores vacíos y codifica el resto', () => {
  assert.equal(queryString({ search: '', categoryId: undefined, status: null }), '')
  assert.equal(queryString({ search: 'taza azul', categoryId: 3, status: 'active' }), '?search=taza+azul&categoryId=3&status=active')
})

test('productToApi envía solo campos que el backend acepta (rechaza desconocidos con 400)', () => {
  const body = productToApi(
    {
      id: 7,
      name: '  Llavero  ',
      categoryId: '2',
      sku: ' ',
      description: '',
      imageUrl: 'data:image/jpeg;base64,xx',
      referenceSalePrice: '1500',
      currentCost: 800,
      weightGrams: 40,
      isActive: false,
      stock: 5,
      categoryName: 'Hogar',
    },
    { creating: true },
  )
  assert.deepEqual(body, {
    name: 'Llavero',
    categoryId: 2,
    sku: null,
    description: null,
    referenceSalePrice: 1500,
    manualCost: 800,
    isActive: false,
  })
})

test('productToApi no envía isActive al editar y convierte costo 0 en null', () => {
  const body = productToApi({ name: 'A', categoryId: 1, currentCost: 0, isActive: true })
  assert.equal('isActive' in body, false)
  assert.equal(body.manualCost, null)
})

test('productToApi en edición parcial no inventa campos', () => {
  assert.deepEqual(productToApi({ name: 'Solo nombre' }), { name: 'Solo nombre' })
})

test('productFromApi expone manualCost como currentCost', () => {
  const view = productFromApi({ id: 1, name: 'A', manualCost: 1200.5, stock: 3 })
  assert.equal(view.currentCost, 1200.5)
  assert.equal(view.weightGrams, 0)
  assert.equal(productFromApi({ id: 2, manualCost: null }).currentCost, 0)
})

test('categoryToApi filtra campos', () => {
  assert.deepEqual(categoryToApi({ id: 1, name: ' Hogar ', isActive: false, extra: 1 }), { name: 'Hogar', isActive: false })
  assert.deepEqual(categoryToApi({ isActive: true }), { isActive: true })
})

test('stock: filas y movimientos reciben los campos que espera la interfaz', () => {
  assert.equal(stockRowFromApi({ id: 1, name: 'A', stock: 2 }).isActive, true)
  const m = movementFromApi({ id: 1, quantityDelta: 5, type: 'PRODUCCION' })
  assert.equal(m.saleId, null)
  assert.equal(m.returnId, null)
})

test('producción y ajustes arman el cuerpo del backend', () => {
  assert.deepEqual(productionToApi({ productId: '4', quantity: '10', note: '' }), { productId: 4, quantity: 10, note: null })
  assert.deepEqual(adjustmentToApi({ productId: 4, direction: 'DECREASE', quantity: '2', reason: ' rotura ' }), {
    productId: 4,
    direction: 'DECREASE',
    quantity: 2,
    reason: 'rotura',
  })
})
