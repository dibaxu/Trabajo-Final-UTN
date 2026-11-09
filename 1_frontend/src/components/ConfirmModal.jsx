import { useState } from 'react'
import { Button, ErrorAlert } from './ui.jsx'
import { Modal } from './Modal.jsx'

/** Confirmación para acciones delicadas. `onConfirm` puede ser asíncrono. */
export function ConfirmModal({ title, message, confirmLabel = 'Confirmar', danger = false, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e)
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-ink-600">{message}</p>
      <ErrorAlert error={error} className="mt-3" />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={handleConfirm} disabled={busy}>
          {busy ? 'Procesando…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
