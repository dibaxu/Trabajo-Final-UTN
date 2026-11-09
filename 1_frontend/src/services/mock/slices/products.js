import { op } from '../op.js'
import { getProduct, listProducts, saveProduct } from '../ops/catalog.js'

export default {
  products: {
    list: op((s, _a, filters) => listProducts(s, filters)),
    get: op((s, _a, id) => getProduct(s, id)),
    create: op((s, a, data) => saveProduct(s, null, data, a.id), { tx: true }),
    update: op((s, a, id, data) => saveProduct(s, id, data, a.id), { tx: true }),
  },
}
