import { useState } from 'react'
import { api } from '../../services/index.js'
import { parseNumber } from '../../lib/numbers.js'
import { Button, ErrorAlert } from '../../components/ui.jsx'
import { Modal } from '../../components/Modal.jsx'
import { NumericField, TextAreaField } from '../../components/form.jsx'

/** HU11 — devolución total o parcial vinculada a una venta. */
export function ReturnModal({ sale, onClose, onDone }) {
  const returnable = sale.items.filter((i) => i.quantity - i.returnedQuantity > 0)
  const [qty, setQty] = useState({})
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const next = {}
    const items = []
    for (const i of returnable) {
      const raw = (qty[i.id] ?? '').trim()
      if (raw === '') continue
      const n = parseNumber(raw)
      const max = i.quantity - i.returnedQuantity
      if (!Number.isInteger(n) || n < 0) next[i.id] = 'Entero válido.'
      else if (n > max) next[i.id] = `Máximo ${max}.`
      else if (n > 0) items.push({ saleItemId: i.id, quantity: n })
    }
    if (items.length === 0 && Object.keys(next).length === 0) next.general = 'Indicá al menos una unidad a devolver.'
    if (!reason.trim()) next.reason = 'El motivo es obligatorio.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setApiError(null)
    try {
      await api.sales.createReturn(sale.id, { reason, items })
      onDone()
      onClose()
    } catch (err) {
      setApiError(err)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Devolución · venta #${sale.id}`} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <ul className="space-y-3">
          {returnable.map((i) => (
            <li key={i.id} className="grid grid-cols-[1fr_7rem] items-end gap-3">
              <div>
                <p className="font-medium">{i.productName}</p>
                <p className="text-xs text-ink-500">
                  Vendidas {i.quantity} · ya devueltas {i.returnedQuantity}
                </p>
              </div>
              <NumericField label="Devolver" inputMode="numeric" placeholder="0" value={qty[i.id] ?? ''} error={errors[i.id]} onChange={(e) => setQty((p) => ({ ...p, [i.id]: e.target.value }))} />
            </li>
          ))}
        </ul>
        {errors.general && <p className="text-sm text-red-700">{errors.general}</p>}
        <TextAreaField label="Motivo *" value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} maxLength={200} />
        <ErrorAlert error={apiError} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Registrando…' : 'Registrar devolución'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
