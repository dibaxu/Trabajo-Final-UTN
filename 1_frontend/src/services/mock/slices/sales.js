import { op } from '../op.js'
import { cancelSale, createReturn, getSale, insertSale, listSales } from '../ops/sales.js'

export default {
  sales: {
    list: op((s, _a, filters) => listSales(s, filters)),
    get: op((s, _a, id) => getSale(s, id)),
    create: op((s, a, data) => insertSale(s, data, a.id), { tx: true }),
    cancel: op((s, a, id, reason) => cancelSale(s, id, reason, a.id), { permission: 'sales.cancel', tx: true }),
    createReturn: op((s, a, id, data) => createReturn(s, id, data, a.id), { permission: 'sales.return', tx: true }),
  },
}
