// Categorías y productos (HU02) → /api/product-categories y /api/products.
import { authRequest } from '../../../lib/http.js'
import { categoryToApi, productFromApi, productToApi, queryString } from '../adapters.js'

const json = (method, body) => ({ method, body })

export default {
  categories: {
    list: () => authRequest('/product-categories'),
    create: (data) => authRequest('/product-categories', json('POST', categoryToApi(data))),
    update: (id, data) => authRequest(`/product-categories/${id}`, json('PATCH', categoryToApi(data))),
  },

  products: {
    list: async (filters = {}) => {
      const { search, categoryId, status } = filters
      const rows = await authRequest(`/products${queryString({ search: search?.trim(), categoryId, status })}`)
      return rows.map(productFromApi)
    },
    get: async (id) => productFromApi(await authRequest(`/products/${id}`)),
    create: async (data) =>
      productFromApi(await authRequest('/products', json('POST', productToApi(data, { creating: true })))),
    update: async (id, data) => {
      let product = await authRequest(`/products/${id}`, json('PATCH', productToApi(data)))
      // El estado activo/inactivo tiene su propio endpoint.
      if (data.isActive !== undefined && Boolean(data.isActive) !== product.isActive) {
        product = await authRequest(`/products/${id}/status`, json('PATCH', { isActive: Boolean(data.isActive) }))
      }
      return productFromApi(product)
    },
  },
}
