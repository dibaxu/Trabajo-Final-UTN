// Ventas y una devolución de demostración (requiere el seed base).
import { createReturn, insertSale } from '../ops/sales.js'

export default function seedSales(s, ctx) {
  const { admin, operator, ids, daysAgo } = ctx
  const costOf = (i) => ({ costSource: 'ESTIMACION', costEstimateId: s.estimates.find((e) => e.productId === ids[i]).id })
  const sale = (type, ago, lines, by = operator) =>
    insertSale(s, { saleType: type, items: lines.map(([i, quantity, unitPrice]) => ({ productId: ids[i], quantity, unitPrice, ...costOf(i) })) }, by, daysAgo(ago, 15))

  sale('MINORISTA', 18, [[1, 6, 2500], [2, 2, 6500]])
  sale('MAYORISTA', 14, [[1, 40, 1800], [4, 12, 3600]])
  const returned = sale('MINORISTA', 9, [[0, 3, 9000], [3, 1, 14000]])
  sale('MINORISTA', 5, [[2, 4, 6500], [4, 3, 4800]], admin)
  sale('MAYORISTA', 3, [[0, 10, 6500]])
  sale('MINORISTA', 1, [[3, 2, 14000], [1, 5, 2500]])
  createReturn(s, returned.id, { reason: 'Pieza con falla de impresión', items: [{ saleItemId: returned.items[0].id, quantity: 1 }] }, admin, daysAgo(7, 16))
}
