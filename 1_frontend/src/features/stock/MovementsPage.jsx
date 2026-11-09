import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../../services/index.js'
import { useQuery } from '../../lib/useQuery.js'
import { formatDateTime } from '../../lib/format.js'
import { Alert, Badge, EmptyState, PageHeader, QueryState, TableWrap, Td, Th } from '../../components/ui.jsx'
import { SelectField } from '../../components/form.jsx'
import { DateField } from '../../components/DateField.jsx'
import { StockNav } from './StockNav.jsx'
import { MOVEMENT_LABELS } from './movementTypes.js'

/** HU14 — historial de movimientos (solo lectura). */
export default function MovementsPage() {
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState({ productId: searchParams.get('producto') ?? '', type: '', from: '', to: '' })
  const set = (key) => (e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }))

  const products = useQuery(api.stock.list, {})
  const movements = useQuery(api.stock.movements, filters)

  const selected = (products.data ?? []).find((p) => String(p.id) === filters.productId)
  const unfiltered = !filters.type && !filters.from && !filters.to

  return (
    <div>
      <PageHeader title="Stock" description="Cada cambio de existencias queda registrado y no puede modificarse ni eliminarse." />
      <StockNav />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField label="Producto" value={filters.productId} onChange={set('productId')}>
          <option value="">Todos</option>
          {(products.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Tipo" value={filters.type} onChange={set('type')}>
          <option value="">Todos</option>
          {Object.entries(MOVEMENT_LABELS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <DateField label="Desde" value={filters.from} onChange={set('from')} />
        <DateField label="Hasta" value={filters.to} onChange={set('to')} />
      </div>

      <QueryState query={movements}>
        {(list) => {
          const sum = list.reduce((a, m) => a + m.quantityDelta, 0)
          return (
            <>
              {selected && unfiltered && (
                <Alert tone={sum === selected.stock ? 'success' : 'warning'} className="mb-3">
                  Suma de movimientos de <strong>{selected.name}</strong>: {sum} · Stock actual: {selected.stock}
                  {sum === selected.stock ? ' ✓' : ''}
                </Alert>
              )}
              {list.length === 0 ? (
                <EmptyState title="No hay movimientos para los filtros elegidos" />
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Fecha</Th>
                      <Th>Producto</Th>
                      <Th>Tipo</Th>
                      <Th className="text-right">Cantidad</Th>
                      <Th>Usuario</Th>
                      <Th>Motivo / referencia</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((m) => {
                      const meta = MOVEMENT_LABELS[m.type]
                      const entry = m.quantityDelta > 0
                      return (
                        <tr key={m.id}>
                          <Td className="whitespace-nowrap">{formatDateTime(m.occurredAt)}</Td>
                          <Td>{m.productName}</Td>
                          <Td>
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                          </Td>
                          <Td className={`text-right font-semibold tabular-nums ${entry ? 'text-emerald-700' : 'text-red-700'}`}>
                            {entry ? '+' : ''}
                            {m.quantityDelta}
                          </Td>
                          <Td>{m.createdByName}</Td>
                          <Td>
                            {m.saleId && (
                              <Link to={`/ventas/${m.saleId}`} className="font-medium text-brand-700 underline">
                                {m.returnId ? `Devolución #${m.returnId} · ` : ''}Venta #{m.saleId}
                              </Link>
                            )}
                            {m.reason && <span className={m.saleId ? 'ml-2 text-ink-500' : ''}>{m.reason}</span>}
                          </Td>
                        </tr>
                      )
                    })}
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
