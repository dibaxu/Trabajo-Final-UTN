// Stock (HU04, HU05, HU06, HU14) → /api/stock.
import { authRequest } from '../../../lib/http.js'
import {
  adjustmentToApi,
  movementFromApi,
  productionToApi,
  queryString,
  stockChangeFromApi,
  stockRowFromApi,
} from '../adapters.js'

export default {
  stock: {
    list: async (filters = {}) => {
      const { search, categoryId, availability } = filters
      const rows = await authRequest(`/stock${queryString({ search: search?.trim(), categoryId, availability })}`)
      return rows.map(stockRowFromApi)
    },
    movements: async (filters = {}) => {
      const { productId, type, from, to } = filters
      const rows = await authRequest(`/stock/movements${queryString({ productId, type, from, to })}`)
      return rows.map(movementFromApi)
    },
    registerProduction: async (data) =>
      stockChangeFromApi(await authRequest('/stock/production', { method: 'POST', body: productionToApi(data) })),
    adjust: async (data) =>
      stockChangeFromApi(await authRequest('/stock/adjustments', { method: 'POST', body: adjustmentToApi(data) })),
  },
}
