import { op } from '../op.js'
import { adjustStock, listMovements, listStock, registerProduction } from '../ops/stock.js'

export default {
  stock: {
    list: op((s, _a, filters) => listStock(s, filters)),
    movements: op((s, _a, filters) => listMovements(s, filters), { permission: 'stock.movements' }),
    registerProduction: op((s, a, data) => registerProduction(s, data, a.id), { tx: true }),
    adjust: op((s, a, data) => adjustStock(s, data, a.id), { permission: 'stock.adjust', tx: true }),
  },
}
