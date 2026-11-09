// Categorías y productos (HU02).
import { bad, notFound, conflict, nid, ci, text, num } from './common.js'
import { stockMap } from './inventory.js'

export function listCategories(s) {
  return [...s.categories].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function createCategory(s, { name }) {
  const n = text(name, 'El nombre', { required: true, max: 60 })
  if (s.categories.some((c) => ci(c.name, n))) throw conflict('Ya existe una categoría con ese nombre.')
  const c = { id: nid(s, 'categories'), name: n, isActive: true }
  s.categories.push(c)
  return c
}

export function updateCategory(s, id, { name, isActive }) {
  const c = s.categories.find((x) => x.id === Number(id))
  if (!c) throw notFound('Categoría')
  if (name !== undefined) {
    const n = text(name, 'El nombre', { required: true, max: 60 })
    if (s.categories.some((x) => x.id !== c.id && ci(x.name, n))) {
      throw conflict('Ya existe una categoría con ese nombre.')
    }
    c.name = n
  }
  if (isActive !== undefined) c.isActive = Boolean(isActive)
  return c
}


function productView(s, p, stocks = stockMap(s)) {
  return {
    ...p,
    categoryName: s.categories.find((c) => c.id === p.categoryId)?.name ?? '—',
    stock: stocks.get(p.id) ?? 0,
  }
}

export function listProducts(s, { search = '', categoryId, status = '' } = {}) {
  const q = search.trim().toLowerCase()
  const stocks = stockMap(s)
  return s.products
    .filter((p) => {
      if (q && !`${p.name} ${p.sku ?? ''}`.toLowerCase().includes(q)) return false
      if (categoryId && p.categoryId !== Number(categoryId)) return false
      if (status === 'active' && !p.isActive) return false
      if (status === 'inactive' && p.isActive) return false
      return true
    })
    .map((p) => productView(s, p, stocks))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function getProduct(s, id) {
  const p = s.products.find((x) => x.id === Number(id))
  if (!p) throw notFound('Producto')
  return productView(s, p)
}

export function saveProduct(s, id, data, actorId) {
  const existing = id ? s.products.find((x) => x.id === Number(id)) : null
  if (id && !existing) throw notFound('Producto')

  const name = text(data.name, 'El nombre', { required: true, max: 100 })
  const categoryId = Number(data.categoryId)
  const category = s.categories.find((c) => c.id === categoryId)
  if (!category) throw bad('Seleccioná una categoría.')
  if (!category.isActive && existing?.categoryId !== categoryId) {
    throw bad('La categoría seleccionada está inactiva.')
  }
  const sku = text(data.sku, 'El código interno', { max: 40 }) || null
  if (sku && s.products.some((p) => p.id !== existing?.id && p.sku && ci(p.sku, sku))) {
    throw conflict('Ya existe un producto con ese código interno.')
  }
  const referenceSalePrice = num(data.referenceSalePrice ?? 0, 'El precio de referencia')
  const currentCost = num(data.currentCost ?? 0, 'El costo')
  const weightGrams = num(data.weightGrams ?? 0, 'El peso')
  const imageUrl = data.imageUrl || null
  if (imageUrl && !String(imageUrl).startsWith('data:image/')) throw bad('La imagen no es válida.')

  const fields = {
    name,
    categoryId,
    sku,
    description: text(data.description, 'La descripción', { max: 500 }),
    imageUrl,
    referenceSalePrice,
    currentCost,
    weightGrams,
    isActive: data.isActive === undefined ? true : Boolean(data.isActive),
  }
  const now = new Date().toISOString()
  if (existing) {
    Object.assign(existing, fields, { updatedAt: now })
    return productView(s, existing)
  }
  const p = { id: nid(s, 'products'), ...fields, currentEstimateId: null, createdBy: actorId, createdAt: now, updatedAt: now }
  s.products.push(p)
  return productView(s, p)
}

