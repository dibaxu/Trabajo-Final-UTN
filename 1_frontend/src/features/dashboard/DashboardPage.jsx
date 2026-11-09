import { useState } from 'react'
import { api } from '../../services/index.js'
import { useQuery } from '../../lib/useQuery.js'
import { startOfMonthStr, todayStr, toDateStr } from '../../lib/dates.js'
import { formatMoney } from '../../lib/format.js'
import { Button, Card, EmptyState, PageHeader, QueryState, StatCard, TableWrap, Td, Th } from '../../components/ui.jsx'
import { DateField } from '../../components/DateField.jsx'
import { TYPE_LABELS } from '../sales/saleMeta.js'

function presets() {
  const now = new Date()
  const last30 = new Date(now)
  last30.setDate(last30.getDate() - 29)
  return [
    { label: 'Este mes', from: startOfMonthStr(), to: todayStr() },
    {
      label: 'Mes anterior',
      from: toDateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: toDateStr(new Date(now.getFullYear(), now.getMonth(), 0)),
    },
    { label: 'Últimos 30 días', from: toDateStr(last30), to: todayStr() },
  ]
}

/** HU09 — indicadores por período. El período por defecto es el mes actual. */
export default function DashboardPage() {
  const [range, setRange] = useState(() => ({ from: startOfMonthStr(), to: todayStr() }))
  const report = useQuery(api.reports.dashboard, range)
  const set = (key) => (e) => setRange((prev) => ({ ...prev, [key]: e.target.value }))

  return (
    <div>
      <PageHeader
        title="Resumen"
        description="Indicadores calculados con ventas confirmadas (sin anuladas, descontando devoluciones) y gastos activos del período."
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="w-40">
          <DateField label="Desde" value={range.from} onChange={set('from')} />
        </div>
        <div className="w-40">
          <DateField label="Hasta" value={range.to} onChange={set('to')} />
        </div>
        <div className="flex flex-wrap gap-2 pb-0.5">
          {presets().map((p) => (
            <Button key={p.label} size="sm" variant="secondary" onClick={() => setRange({ from: p.from, to: p.to })}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <QueryState query={report}>
        {(r) => (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Ingresos por ventas" value={formatMoney(r.revenue)} hint={`${r.salesCount} ventas`} />
              <StatCard label="Costo de productos vendidos" value={formatMoney(r.cogs)} />
              <StatCard label="Margen bruto" value={formatMoney(r.grossMargin)} tone={r.grossMargin < 0 ? 'negative' : 'default'} />
              <StatCard label="Gastos operativos" value={formatMoney(r.expenses)} />
              <StatCard label="Resultado neto" value={formatMoney(r.netResult)} hint="Ingresos − costo vendido − gastos" tone={r.netResult < 0 ? 'negative' : r.netResult > 0 ? 'positive' : 'default'} />
              <StatCard label="Unidades vendidas" value={r.units} />
            </div>

            <section>
              <h2 className="mb-2 font-semibold">Mayorista vs. minorista</h2>
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Tipo</Th>
                    <Th className="text-right">Ventas</Th>
                    <Th className="text-right">Unidades</Th>
                    <Th className="text-right">Ingresos</Th>
                    <Th className="text-right">Costo</Th>
                    <Th className="text-right">Margen</Th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(r.byType).map(([type, b]) => (
                    <tr key={type}>
                      <Td className="font-medium">{TYPE_LABELS[type]}</Td>
                      <Td className="text-right tabular-nums">{b.salesCount}</Td>
                      <Td className="text-right tabular-nums">{b.units}</Td>
                      <Td className="text-right tabular-nums">{formatMoney(b.revenue)}</Td>
                      <Td className="text-right tabular-nums">{formatMoney(b.cogs)}</Td>
                      <Td className="text-right tabular-nums">{formatMoney(b.grossMargin)}</Td>
                    </tr>
                  ))}
                  <tr className="bg-ink-50 font-semibold">
                    <Td>Total</Td>
                    <Td className="text-right tabular-nums">{r.salesCount}</Td>
                    <Td className="text-right tabular-nums">{r.units}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(r.revenue)}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(r.cogs)}</Td>
                    <Td className="text-right tabular-nums">{formatMoney(r.grossMargin)}</Td>
                  </tr>
                </tbody>
              </TableWrap>
            </section>

            <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
              <section>
                <h2 className="mb-2 font-semibold">Por producto</h2>
                {r.byProduct.length === 0 ? (
                  <EmptyState title="Sin ventas en el período" />
                ) : (
                  <TableWrap>
                    <thead>
                      <tr>
                        <Th>Producto</Th>
                        <Th className="text-right">Unid.</Th>
                        <Th className="text-right">Ingresos</Th>
                        <Th className="text-right">Margen</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.byProduct.map((p) => (
                        <tr key={p.productId}>
                          <Td className="font-medium">{p.productName}</Td>
                          <Td className="text-right tabular-nums">{p.units}</Td>
                          <Td className="text-right tabular-nums">{formatMoney(p.revenue)}</Td>
                          <Td className="text-right tabular-nums">{formatMoney(p.grossMargin)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                )}
              </section>

              <section>
                <h2 className="mb-2 font-semibold">Gastos por categoría</h2>
                <Card>
                  {r.expensesByCategory.length === 0 ? (
                    <p className="text-sm text-ink-500">Sin gastos en el período.</p>
                  ) : (
                    <ul className="space-y-3">
                      {r.expensesByCategory.map((c) => (
                        <li key={c.name}>
                          <div className="flex justify-between text-sm">
                            <span>{c.name}</span>
                            <span className="tabular-nums">{formatMoney(c.amount)}</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
                            <div className="h-full bg-brand-500" style={{ width: `${(c.amount / r.expenses) * 100}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </section>
            </div>
          </div>
        )}
      </QueryState>
    </div>
  )
}
