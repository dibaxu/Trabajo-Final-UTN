import { formatDuration, formatMoney } from '../../lib/format.js'

const ROWS = [
  { key: 'material', label: 'Material', color: 'bg-brand-500' },
  { key: 'electricity', label: 'Electricidad', color: 'bg-amber-400' },
  { key: 'wear', label: 'Desgaste', color: 'bg-ink-500' },
  { key: 'labor', label: 'Mano de obra', color: 'bg-teal-600' },
  { key: 'extras', label: 'Extras', color: 'bg-ink-300' },
]

/** Muestra el costo desglosado y los precios sugeridos. Solo presentación. */
export function ResultBreakdown({ result }) {
  const { total, breakdown, timeHours, suggestedPrices } = result

  return (
    <div>
      <p className="text-sm text-ink-500">Costo total de fabricación</p>
      <p className="mt-0.5 text-4xl font-semibold tabular-nums tracking-tight">
        {formatMoney(total)}
      </p>
      <p className="mt-1 text-xs text-ink-500">
        Tiempo total: {formatDuration(timeHours)} ({timeHours.toFixed(2)} h)
      </p>

      {total > 0 && (
        <div
          className="mt-4 flex h-2 overflow-hidden rounded-full bg-ink-100"
          aria-hidden="true"
        >
          {ROWS.map((r) => (
            <div
              key={r.key}
              className={r.color}
              style={{ width: `${(breakdown[r.key] / total) * 100}%` }}
            />
          ))}
        </div>
      )}

      <dl className="mt-4 space-y-2 text-sm">
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-ink-600">
              <span className={`size-2.5 rounded-full ${r.color}`} />
              {r.label}
            </dt>
            <dd className="font-medium tabular-nums">{formatMoney(breakdown[r.key])}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink-700">Precios sugeridos</h3>
      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        {suggestedPrices.map((s) => (
          <li key={s.id} className="rounded-xl border border-ink-200 bg-white px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{s.label}</span>
              <span className="text-xs text-ink-500">×{s.multiplier}</span>
            </div>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(s.price)}</p>
            <p className="text-xs text-ink-500">Ganancia: {formatMoney(s.profit)}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
