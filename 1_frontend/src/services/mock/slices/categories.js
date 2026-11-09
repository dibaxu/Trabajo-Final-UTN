import { op } from '../op.js'
import { createCategory, listCategories, updateCategory } from '../ops/catalog.js'

export default {
  categories: {
    list: op((s) => listCategories(s)),
    create: op((s, _a, data) => createCategory(s, data), { tx: true }),
    update: op((s, _a, id, data) => updateCategory(s, id, data), { tx: true }),
  },
}
