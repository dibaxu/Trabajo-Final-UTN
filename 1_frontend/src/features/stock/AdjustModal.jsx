import { useState } from 'react'
import { api } from '../../services/index.js'
import { parseNumber } from '../../lib/numbers.js'
import { Alert, Button, ErrorAlert } from '../../components/ui.jsx'
import { Modal } from '../../components/Modal.jsx'
import { NumericField, SelectField, TextField } from '../../components/form.jsx'

/** HU06 — ajuste de inventario (solo administrador), con stock anterior y resultante. */
export function AdjustModal({ products, initialProductId = '', onClose, onDone }) {
  const [productId, setProductId] = useState(initialProductId ? String(initialProductId) : '')
  const [direction, setDirection] = useState('DECREASE')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)

  const product = products.find((p) => String(p.id) === productId)
  const q = parseNumber(quantity)
  const validQty = Number.isInteger(q) && q > 0
  const after = product && validQty ? product.stock + (direction === 'INCREASE' ? q : -q) : null

  async function handleSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!productId) next.productId = 'Seleccioná un producto.'
    if (!validQty) next.quantity = 'Ingresá un entero distinto de cero.'
    if (!reason.trim()) next.reason = 'El motivo es obligatorio.'
    if (after !== null && after < 0) next.quantity = `El stock quedaría negativo (actual: ${product.stock}).`
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setApiError(null)
    try {
      setDone(await api.stock.adjust({ productId: Number(productId), direction, quantity: q, reason }))
      onDone()
    } catch (error) {
      setApiError(error)
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <Modal title="Ajuste registrado" onClose={onClose}>
        <Alert tone="success">
          Stock de <strong>{product?.name}</strong>: {done.stockBefore} → <strong>{done.stockAfter}</strong>
        </Alert>
        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>Listo</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Ajustar stock" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <SelectField label="Producto *" value={productId} onChange={(e) => setProductId(e.target.value)} error={errors.productId}>
          <option value="">Seleccioná un producto…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-700">Tipo de ajuste *</legend>
          <div className="flex gap-2">
            {[
              ['INCREASE', 'Aumentar'],
              ['DECREASE', 'Reducir'],
            ].map(([value, label]) => (
              <label
                key={value}
                className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium ${
                  direction === value ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-ink-300 text-ink-600'
                }`}
              >
                <input type="radio" name="direction" value={value} checked={direction === value} onChange={() => setDirection(value)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <NumericField label="Cantidad *" unit="u." inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} error={errors.quantity} />
        <TextField label="Motivo *" value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} maxLength={200} placeholder="Ej.: conteo físico, pieza dañada" />

        {product && (
          <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
            Stock anterior: <strong className="tabular-nums">{product.stock}</strong> → Stock resultante:{' '}
            <strong className={`tabular-nums ${after !== null && after < 0 ? 'text-red-700' : ''}`}>{after ?? '—'}</strong>
          </div>
        )}
        <ErrorAlert error={apiError} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Confirmar ajuste'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
