import { useState } from 'react'
import { api } from '../../services/index.js'
import { parseNumber } from '../../lib/numbers.js'
import { Alert, Button, ErrorAlert } from '../../components/ui.jsx'
import { Modal } from '../../components/Modal.jsx'
import { NumericField, SelectField, TextField } from '../../components/form.jsx'

/** HU04 — registrar unidades producidas. Muestra la existencia resultante. */
export function ProductionModal({ products, initialProductId = '', onClose, onDone }) {
  const [productId, setProductId] = useState(initialProductId ? String(initialProductId) : '')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!productId) next.productId = 'Seleccioná un producto.'
    const q = parseNumber(quantity)
    if (!Number.isInteger(q) || q <= 0) next.quantity = 'Ingresá un entero mayor que cero.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setApiError(null)
    try {
      setResult(await api.stock.registerProduction({ productId: Number(productId), quantity: q, note }))
      onDone()
    } catch (error) {
      setApiError(error)
    } finally {
      setSaving(false)
    }
  }

  if (result) {
    const name = products.find((p) => String(p.id) === productId)?.name
    return (
      <Modal title="Producción registrada" onClose={onClose}>
        <Alert tone="success">
          Se registraron {result.movement.quantityDelta} unidades de <strong>{name}</strong>.
        </Alert>
        <p className="mt-4 text-sm text-ink-600">
          Existencia resultante: <strong className="text-lg tabular-nums text-ink-900">{result.stockAfter}</strong>{' '}
          <span className="text-ink-500">(antes: {result.stockBefore})</span>
        </p>
        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>Listo</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Registrar producción" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <SelectField label="Producto *" value={productId} onChange={(e) => setProductId(e.target.value)} error={errors.productId}>
          <option value="">Seleccioná un producto…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (stock {p.stock})
            </option>
          ))}
        </SelectField>
        <NumericField label="Unidades producidas *" unit="u." inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} error={errors.quantity} autoFocus={Boolean(productId)} />
        <TextField label="Observación" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        <ErrorAlert error={apiError} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Registrando…' : 'Registrar producción'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
