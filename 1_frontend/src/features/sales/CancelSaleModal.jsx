import { useState } from 'react'
import { api } from '../../services/index.js'
import { Button, ErrorAlert } from '../../components/ui.jsx'
import { Modal } from '../../components/Modal.jsx'
import { TextAreaField } from '../../components/form.jsx'

/** HU10 — anular una venta confirmada (motivo obligatorio). */
export function CancelSaleModal({ sale, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [apiError, setApiError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason.trim()) return setError('El motivo es obligatorio.')
    setSaving(true)
    setApiError(null)
    try {
      await api.sales.cancel(sale.id, reason)
      onDone()
      onClose()
    } catch (err) {
      setApiError(err)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Anular venta #${sale.id}`} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <p className="text-sm text-ink-600">
          Se restituirán al stock todas las unidades vendidas. La venta se conserva, pero deja de contar en ingresos, costos y margen. Esta acción no se puede deshacer.
        </p>
        <TextAreaField label="Motivo de anulación *" value={reason} onChange={(e) => setReason(e.target.value)} error={error} maxLength={200} autoFocus />
        <ErrorAlert error={apiError} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Volver
          </Button>
          <Button type="submit" variant="danger" disabled={saving}>
            {saving ? 'Anulando…' : 'Anular venta'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
