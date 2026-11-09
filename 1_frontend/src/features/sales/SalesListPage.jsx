import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../services/index.js'
import { useQuery } from '../../lib/useQuery.js'
import { startOfMonthStr, todayStr } from '../../lib/dates.js'
import { formatDateTime, formatMoney } from '../../lib/format.js'
import { Badge, EmptyState, PageHeader, QueryState, StatCard, TableWrap, Td, Th } from '../../components/ui.jsx'
import { SelectField } from '../../components/form.jsx'
import { DateField } from '../../components/DateField.jsx'
import { SalesNav } from './SalesNav.jsx'
import { STATUS_META, TYPE_LABELS } from './saleMeta.js'

export default function SalesListPage() {
  const [filters, setFilters] = useState(() => ({ from: startOfMonthStr(), to: todayStr(), saleType: '', status: '' }))
  const set = (key) => (e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }))
  const sales = useQuery(api.sales.list, filters)

  return (
    <div>
      <PageHeader
        title="Ventas"
        description="Ventas del período. Las anuladas se muestran pero no suman a los totales."
        actions={
          <Link to="/ventas/nueva" className="rounded-lg bg-brand-500 px-4 py-2.5 font-semibold text-white hover:bg-brand-600">
            Nueva venta
          </Link>
        }
      />
      <SalesNav />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DateField label="Desde" value={filters.from} onChange={set('from')} />
        <DateField label="Hasta" value={filters.to} onChange={set('to')} />
        <SelectField label="Tipo" value={filters.saleType} onChange={set('saleType')}>
          <option value="">Todos</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </SelectField>
        <SelectField label="Estado" value={filters.status} onChange={set('status')}>
          <option value="">Todos</option>
          {Object.entries(STATUS_META).map(([v, m]) => (
            <option key={v} value={v}>
              {m.label}
            </option>
          ))}
        </SelectField>
      </div>

      <QueryState query={sales}>
        {(list) => {
          const counted = list.filter((s) => s.status !== 'ANULADA')
          const total = counted.reduce((a, s) => a + s.totalAmount, 0)
          const margin = counted.reduce((a, s) => a + s.grossMargin, 0)
          return (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <StatCard label="Ventas (sin anuladas)" value={counted.length} />
                <StatCard label="Total vendido" value={formatMoney(total)} hint="Valores originales, sin descontar devoluciones" />
                <StatCard label="Margen bruto" value={formatMoney(margin)} />
              </div>
              {list.length === 0 ? (
                <EmptyState title="No hay ventas en el período">
                  <Link to="/ventas/nueva" className="font-medium text-brand-700 underline">
                    Registrar una venta
                  </Link>
                </EmptyState>
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>N.º</Th>
                      <Th>Fecha</Th>
                      <Th>Tipo</Th>
                      <Th className="text-right">Unidades</Th>
                      <Th className="text-right">Total</Th>
                      <Th className="text-right">Margen</Th>
                      <Th>Estado</Th>
                      <Th>Registró</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => (
                      <tr key={s.id} className={s.status === 'ANULADA' ? 'text-ink-400' : ''}>
                        <Td>
                          <Link to={`/ventas/${s.id}`} className="font-semibold text-brand-700 underline">
                            #{s.id}
                          </Link>
                        </Td>
                        <Td className="whitespace-nowrap">{formatDateTime(s.soldAt)}</Td>
                        <Td>{TYPE_LABELS[s.saleType]}</Td>
                        <Td className="text-right tabular-nums">{s.units}</Td>
                        <Td className="text-right tabular-nums">{formatMoney(s.totalAmount)}</Td>
                        <Td className="text-right tabular-nums">{formatMoney(s.grossMargin)}</Td>
                        <Td>
                          <Badge tone={STATUS_META[s.status].tone}>{STATUS_META[s.status].label}</Badge>
                        </Td>
                        <Td>{s.createdByName}</Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </>
          )
        }}
      </QueryState>
    </div>
  )
}
