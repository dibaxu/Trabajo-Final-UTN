import { useState } from 'react'
import { api } from '../../services/index.js'
import { useQuery } from '../../lib/useQuery.js'
import { startOfMonthStr, todayStr } from '../../lib/dates.js'
import { formatDay, formatMoney } from '../../lib/format.js'
import { Badge, Button, EmptyState, PageHeader, QueryState, StatCard, TableWrap, Td, Th } from '../../components/ui.jsx'
import { SelectField } from '../../components/form.jsx'
import { DateField } from '../../components/DateField.jsx'
import { ConfirmModal } from '../../components/ConfirmModal.jsx'
import { ExpenseModal } from './ExpenseModal.jsx'

/** HU08 — gastos por período y categoría (solo administrador). */
export default function ExpensesPage() {
  const [filters, setFilters] = useState(() => ({ from: startOfMonthStr(), to: todayStr(), categoryId: '' }))
  const [modal, setModal] = useState(null) // { kind: 'edit', expense? } | { kind: 'void', expense }
  const set = (key) => (e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }))

  const expenses = useQuery(api.expenses.list, filters)
  const categories = useQuery(api.expenses.categories)

  return (
    <div>
      <PageHeader
        title="Gastos"
        description="Gastos operativos del emprendimiento. Se anulan en lugar de eliminarse."
        actions={<Button onClick={() => setModal({ kind: 'edit' })}>Nuevo gasto</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <DateField label="Desde" value={filters.from} onChange={set('from')} />
        <DateField label="Hasta" value={filters.to} onChange={set('to')} />
        <SelectField label="Categoría" value={filters.categoryId} onChange={set('categoryId')}>
          <option value="">Todas</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      </div>

      <QueryState query={expenses}>
        {(list) => {
          const active = list.filter((e) => e.status === 'ACTIVO')
          const total = active.reduce((a, e) => a + e.amount, 0)
          return (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <StatCard label="Total de gastos (sin anulados)" value={formatMoney(total)} />
                <StatCard label="Cantidad" value={active.length} />
              </div>
              {list.length === 0 ? (
                <EmptyState title="No hay gastos en el período" />
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <Th>Fecha</Th>
                      <Th>Categoría</Th>
                      <Th>Descripción</Th>
                      <Th className="text-right">Importe</Th>
                      <Th>Cargó</Th>
                      <Th>
                        <span className="sr-only">Acciones</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((e) => {
                      const voided = e.status === 'ANULADO'
                      return (
                        <tr key={e.id} className={voided ? 'text-ink-400 line-through' : ''}>
                          <Td className="whitespace-nowrap">{formatDay(e.incurredOn)}</Td>
                          <Td>{e.categoryName}</Td>
                          <Td>{e.description || '—'}</Td>
                          <Td className="text-right tabular-nums">{formatMoney(e.amount)}</Td>
                          <Td>{e.createdByName}</Td>
                          <Td>
                            {voided ? (
                              <Badge tone="danger">Anulado</Badge>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="secondary" onClick={() => setModal({ kind: 'edit', expense: e })}>
                                  Editar
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'void', expense: e })}>
                                  Anular
                                </Button>
                              </div>
                            )}
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

      {modal?.kind === 'edit' && (
        <ExpenseModal expense={modal.expense} categories={categories.data ?? []} onClose={() => setModal(null)} onDone={expenses.reload} />
      )}
      {modal?.kind === 'void' && (
        <ConfirmModal
          title="Anular gasto"
          danger
          confirmLabel="Anular gasto"
          message={`Se anulará el gasto de ${formatMoney(modal.expense.amount)} (${modal.expense.categoryName}). Dejará de contar en los resultados.`}
          onConfirm={async () => {
            await api.expenses.void(modal.expense.id)
            expenses.reload()
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
