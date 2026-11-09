import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../services/index.js'
import { useQuery } from '../../lib/useQuery.js'
import { parseNumber } from '../../lib/numbers.js'
import { formatDate, formatMoney } from '../../lib/format.js'
import { Alert, Button, Card, ErrorAlert, PageHeader } from '../../components/ui.jsx'
import { NumericField, SelectField, TextField } from '../../components/form.jsx'
import { SalesNav } from './SalesNav.jsx'
import { TYPE_LABELS } from './saleMeta.js'

const ALL = {}

/** Línea nueva: precio de referencia y costo de la estimación vigente (si hay). */
function newLine(product) {
  const hasEstimate = Boolean(product.currentEstimateId)
  return {
    productId: product.id,
    quantity: '1',
    unitPrice: product.referenceSalePrice ? String(product.referenceSalePrice) : '',
    costChoice: hasEstimate ? `est:${product.currentEstimateId}` : 'manual',
    manualCost: !hasEstimate && product.currentCost ? String(product.currentCost) : '',
  }
}

/** HU07 (registrar venta) + HU12 (costo aplicado: estimación o manual). */
export default function NewSalePage() {
  const navigate = useNavigate()
  const products = useQuery(api.stock.list, ALL)
  const estimates = useQuery(api.estimates.list, ALL)

  const [saleType, setSaleType] = useState('')
  const [lines, setLines] = useState([])
  const [notes, setNotes] = useState('')
  const [apiError, setApiError] = useState(null)
  const [saving, setSaving] = useState(false)

  const productList = products.data ?? []
  const byId = new Map(productList.map((p) => [p.id, p]))
  const estimatesOf = (productId) => (estimates.data ?? []).filter((e) => e.productId === productId)

  function addProduct(e) {
    const id = Number(e.target.value)
    if (!id) return
    const product = byId.get(id)
    setLines((prev) =>
      prev.some((l) => l.productId === id)
        ? prev.map((l) => (l.productId === id ? { ...l, quantity: String((parseNumber(l.quantity) || 0) + 1) } : l)) // no se duplica: se acumula
        : [...prev, newLine(product)],
    )
  }
  const update = (productId, patch) => setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)))
  const remove = (productId) => setLines((prev) => prev.filter((l) => l.productId !== productId))

  // Cálculo y validación por línea.
  const rows = lines.map((l) => {
    const product = byId.get(l.productId)
    const qty = parseNumber(l.quantity)
    const price = parseNumber(l.unitPrice)
    let unitCost = NaN
    if (l.costChoice === 'manual') unitCost = parseNumber(l.manualCost)
    else unitCost = estimatesOf(l.productId).find((e) => `est:${e.id}` === l.costChoice)?.result.total ?? NaN

    const errors = {}
    if (!Number.isInteger(qty) || qty <= 0) errors.quantity = 'Entero mayor que cero.'
    else if (product && qty > product.stock) errors.quantity = `Máximo ${product.stock}.`
    if (Number.isNaN(price) || price < 0) errors.unitPrice = 'Precio inválido.'
    if (Number.isNaN(unitCost) || unitCost < 0) errors.cost = 'Costo inválido.'
    const ok = Object.keys(errors).length === 0
    return { line: l, product, errors, ok, qty, price, unitCost, total: ok ? qty * price : 0, margin: ok ? qty * (price - unitCost) : 0 }
  })

  const allOk = rows.length > 0 && rows.every((r) => r.ok)
  const total = rows.reduce((a, r) => a + r.total, 0)
  const margin = rows.reduce((a, r) => a + r.margin, 0)
  const canConfirm = allOk && saleType && !saving

  async function handleConfirm() {
    setSaving(true)
    setApiError(null)
    try {
      const sale = await api.sales.create({
        saleType,
        notes,
        items: rows.map((r) => ({
          productId: r.line.productId,
          quantity: r.qty,
          unitPrice: r.price,
          ...(r.line.costChoice === 'manual'
            ? { costSource: 'MANUAL', unitCost: r.unitCost }
            : { costSource: 'ESTIMACION', costEstimateId: Number(r.line.costChoice.slice(4)) }),
        })),
      })
      navigate(`/ventas/${sale.id}`, { state: { justCreated: true } })
    } catch (error) {
      setApiError(error)
      setSaving(false)
      products.reload() // el stock pudo cambiar
    }
  }

  return (
    <div>
      <PageHeader title="Nueva venta" description="Elegí los productos, el precio y el costo aplicado. Al confirmar se descuenta el stock." />
      <SalesNav />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-1 text-sm font-semibold text-ink-700">Tipo de venta *</h2>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de venta">
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-xl border px-4 py-3 text-center font-medium transition ${
                    saleType === value ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-ink-300 text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  <input type="radio" name="saleType" value={value} checked={saleType === value} onChange={() => setSaleType(value)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <SelectField label="Agregar producto" value="" onChange={addProduct}>
              <option value="">Seleccioná un producto…</option>
              {productList.map((p) => (
                <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                  {p.name} — stock {p.stock}
                  {p.stock <= 0 ? ' (sin stock)' : ''}
                </option>
              ))}
            </SelectField>

            {lines.length === 0 ? (
              <p className="mt-4 text-sm text-ink-500">Todavía no agregaste productos.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {rows.map(({ line, product, errors, total: lineTotal, margin: lineMargin, ok }) => (
                  <li key={line.productId} className="rounded-xl border border-ink-200 p-3">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{product?.name}</p>
                        <p className="text-xs text-ink-500">Stock disponible: {product?.stock}</p>
                      </div>
                      <button type="button" onClick={() => remove(line.productId)} className="text-sm text-ink-500 underline hover:text-red-700">
                        Quitar
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <NumericField label="Cantidad" inputMode="numeric" value={line.quantity} error={errors.quantity} onChange={(e) => update(line.productId, { quantity: e.target.value })} />
                      <NumericField label="Precio unitario" unit="$" value={line.unitPrice} error={errors.unitPrice} onChange={(e) => update(line.productId, { unitPrice: e.target.value })} />
                      <div className="sm:col-span-2">
                        <SelectField label="Costo aplicado" value={line.costChoice} error={errors.cost && line.costChoice !== 'manual' ? errors.cost : undefined} onChange={(e) => update(line.productId, { costChoice: e.target.value })}>
                          {estimatesOf(line.productId).map((e) => (
                            <option key={e.id} value={`est:${e.id}`}>
                              Estimación {formatDate(e.createdAt)} · {formatMoney(e.result.total)}
                              {e.isCurrent ? ' (vigente)' : ''}
                            </option>
                          ))}
                          <option value="manual">Costo manual</option>
                        </SelectField>
                      </div>
                      {line.costChoice === 'manual' && (
                        <div className="sm:col-span-2 sm:col-start-3">
                          <NumericField label="Costo unitario manual" unit="$" value={line.manualCost} error={errors.cost} onChange={(e) => update(line.productId, { manualCost: e.target.value })} />
                        </div>
                      )}
                    </div>
                    {ok && (
                      <p className="mt-3 text-sm text-ink-600">
                        Subtotal <strong className="tabular-nums">{formatMoney(lineTotal)}</strong> · Margen{' '}
                        <strong className={`tabular-nums ${lineMargin < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatMoney(lineMargin)}</strong>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <TextField label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Ej.: feria del sábado, cliente frecuente" />
          </Card>
        </div>

        <Card className="lg:sticky lg:top-24">
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Resumen</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Tipo</dt>
              <dd>{saleType ? TYPE_LABELS[saleType] : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Productos</dt>
              <dd className="tabular-nums">{lines.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Margen bruto</dt>
              <dd className={`tabular-nums ${margin < 0 ? 'text-red-700' : ''}`}>{allOk ? formatMoney(margin) : '—'}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-ink-500">Total</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">{allOk ? formatMoney(total) : formatMoney(0)}</p>

          {!saleType && lines.length > 0 && <Alert tone="warning" className="mt-3">Indicá si la venta es mayorista o minorista.</Alert>}
          <ErrorAlert error={apiError} className="mt-3" />
          <Button onClick={handleConfirm} disabled={!canConfirm} className="mt-4 w-full">
            {saving ? 'Confirmando…' : 'Confirmar venta'}
          </Button>
        </Card>
      </div>
    </div>
  )
}
