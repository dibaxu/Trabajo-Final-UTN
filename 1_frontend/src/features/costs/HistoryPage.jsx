import { useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../services/index.js'
import { useQuery } from '../../lib/useQuery.js'
import { formatDateTime, formatDuration, formatMoney } from '../../lib/format.js'
import { Badge, Button, EmptyState, ErrorAlert, PageHeader, QueryState } from '../../components/ui.jsx'
import { SelectField } from '../../components/form.jsx'
import { ALL_FIELDS } from './fields.js'
import { CostsNav } from './CostsNav.jsx'

export default function HistoryPage() {
  const [productId, setProductId] = useState('')
  const [actionError, setActionError] = useState(null)
  const products = useQuery(api.products.list, {})
  const estimates = useQuery(api.estimates.list, { productId: productId || undefined })

  async function markCurrent(id) {
    setActionError(null)
    try {
      await api.estimates.setCurrent(id)
      estimates.reload()
    } catch (error) {
      setActionError(error)
    }
  }

  return (
    <div>
      <PageHeader
        title="Costos"
        description="Cada estimación guardada se conserva con sus parámetros y fecha. La vigente define el costo actual del producto."
      />
      <CostsNav />

      <div className="mb-4 max-w-xs">
        <SelectField label="Producto" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Todos</option>
          {(products.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
      </div>
      <ErrorAlert error={actionError} className="mb-3" />

      <QueryState query={estimates}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState title="Todavía no hay estimaciones guardadas">
              <Link to="/costos" className="font-medium text-brand-700 underline">
                Hacer una estimación
              </Link>
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {list.map((e) => (
                <li key={e.id} className="rounded-2xl border border-ink-200 bg-white shadow-sm">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-4">
                      <div>
                        <p className="flex items-center gap-2 font-semibold">
                          {e.productName}
                          {e.isCurrent && <Badge tone="success">Vigente</Badge>}
                        </p>
                        <p className="text-xs text-ink-500">
                          {formatDateTime(e.createdAt)} · {e.createdByName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold tabular-nums">{formatMoney(e.result.total)}</p>
                        <p className="text-xs text-ink-500">
                          {['mayorista', 'minorista']
                            .map((id) => e.result.suggestedPrices.find((s) => s.id === id))
                            .filter(Boolean)
                            .map((s) => `${s.label} ${formatMoney(s.price)}`)
                            .join(' · ')}
                        </p>
                      </div>
                    </summary>

                    <div className="grid gap-6 border-t border-ink-100 px-5 py-4 text-sm sm:grid-cols-2">
                      <div>
                        <h3 className="mb-2 font-semibold text-ink-700">Parámetros usados</h3>
                        <dl className="space-y-1">
                          {ALL_FIELDS.map((f) => (
                            <div key={f.key} className="flex justify-between gap-3">
                              <dt className="text-ink-500">{f.label}</dt>
                              <dd className="tabular-nums">
                                {e.params[f.key]} {f.unit}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                      <div>
                        <h3 className="mb-2 font-semibold text-ink-700">Resultado · {formatDuration(e.result.timeHours)}</h3>
                        <dl className="space-y-1">
                          {[
                            ['Material', e.result.breakdown.material],
                            ['Electricidad', e.result.breakdown.electricity],
                            ['Desgaste', e.result.breakdown.wear],
                            ['Mano de obra', e.result.breakdown.labor],
                            ['Extras', e.result.breakdown.extras],
                          ].map(([label, v]) => (
                            <div key={label} className="flex justify-between gap-3">
                              <dt className="text-ink-500">{label}</dt>
                              <dd className="tabular-nums">{formatMoney(v)}</dd>
                            </div>
                          ))}
                          <div className="flex justify-between gap-3 border-t border-ink-100 pt-1 font-semibold">
                            <dt>Total</dt>
                            <dd className="tabular-nums">{formatMoney(e.result.total)}</dd>
                          </div>
                        </dl>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            to="/costos"
                            state={{ preset: { params: e.params, productId: e.productId } }}
                            className="rounded-lg border border-ink-300 px-3 py-1.5 font-medium text-ink-700 hover:bg-ink-100"
                          >
                            Usar como base
                          </Link>
                          {!e.isCurrent && (
                            <Button size="sm" variant="secondary" onClick={() => markCurrent(e.id)}>
                              Marcar como vigente
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </div>
  )
}
