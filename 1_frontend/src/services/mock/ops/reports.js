// Resumen e indicadores (HU09).
import { dayRange } from '../../../lib/dates.js'
import { round2 } from '../../../features/costs/calc.js'
import { returnedQty } from './sales.js'
import { listExpenses } from './expenses.js'

/**
 * Indicadores del período. Reglas:
 *  - Cuentan las ventas del período (hora local) que no están anuladas.
 *  - Las devoluciones restan unidades, ingresos y costo de la venta original.
 *  - Gastos: solo ACTIVOS cuya fecha cae en el período.
 */
export function dashboard(s, { from, to } = {}) {
  const { start, end } = dayRange(from, to)
  const zero = () => ({ revenue: 0, cogs: 0, grossMargin: 0, units: 0, salesCount: 0 })
  const byType = { MAYORISTA: zero(), MINORISTA: zero() }
  const byProduct = new Map()
  let salesCount = 0

  for (const sale of s.sales) {
    const t = new Date(sale.soldAt).getTime()
    if (t < start || t > end || sale.status === 'ANULADA') continue
    salesCount += 1
    byType[sale.saleType].salesCount += 1
    for (const it of sale.items) {
      const net = it.quantity - returnedQty(s, it.id)
      if (net <= 0) continue
      const revenue = round2(net * it.unitPrice)
      const cogs = round2(net * it.unitCost)
      const bucket = byType[sale.saleType]
      bucket.revenue = round2(bucket.revenue + revenue)
      bucket.cogs = round2(bucket.cogs + cogs)
      bucket.units += net
      const prod = byProduct.get(it.productId) ?? { productId: it.productId, productName: s.products.find((p) => p.id === it.productId)?.name ?? '—', units: 0, revenue: 0, cogs: 0 }
      prod.units += net
      prod.revenue = round2(prod.revenue + revenue)
      prod.cogs = round2(prod.cogs + cogs)
      byProduct.set(it.productId, prod)
    }
  }
  for (const b of Object.values(byType)) b.grossMargin = round2(b.revenue - b.cogs)

  const revenue = round2(byType.MAYORISTA.revenue + byType.MINORISTA.revenue)
  const cogs = round2(byType.MAYORISTA.cogs + byType.MINORISTA.cogs)
  const expenseRows = listExpenses(s, { from, to, status: 'ACTIVO' })
  const expenses = round2(expenseRows.reduce((a, e) => a + e.amount, 0))
  const expensesByCategory = new Map()
  for (const e of expenseRows) expensesByCategory.set(e.categoryName, round2((expensesByCategory.get(e.categoryName) ?? 0) + e.amount))

  return {
    from,
    to,
    revenue,
    cogs,
    grossMargin: round2(revenue - cogs),
    expenses,
    netResult: round2(revenue - cogs - expenses),
    units: byType.MAYORISTA.units + byType.MINORISTA.units,
    salesCount,
    byType,
    byProduct: [...byProduct.values()]
      .map((p) => ({ ...p, grossMargin: round2(p.revenue - p.cogs) }))
      .sort((a, b) => b.revenue - a.revenue),
    expensesByCategory: [...expensesByCategory].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
  }
}

