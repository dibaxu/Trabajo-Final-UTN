import { useState } from 'react'
import { api } from '../../services/index.js'
import { parseNumber } from '../../lib/numbers.js'
import { todayStr, isValidDateStr } from '../../lib/dates.js'
import { Alert, Button, ErrorAlert } from '../../components/ui.jsx'
import { Modal } from '../../components/Modal.jsx'
import { NumericField, SelectField, TextField } from '../../components/form.jsx'
import { DateField } from '../../components/DateField.jsx'

/** Alta y edición de un gasto (HU08). */
export function ExpenseModal({ expense, categories, onClose, onDone }) {
  const [form, setForm] = useState({
    incurredOn: expense?.incurredOn ?? todayStr(),
    categoryId: expense ? String(expense.categoryId) : '',
    amount: expense ? String(expense.amount) : '',
    description: expense?.description ?? '',
  })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!form.categoryId) next.categoryId = 'La categoría es obligatoria.'
    if (!isValidDateStr(form.incurredOn)) next.incurredOn = 'Ingresá una fecha válida.'
    const amount = parseNumber(form.amount)
    if (Number.isNaN(amount) || amount <= 0) next.amount = 'El importe debe ser mayor que cero.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    setApiError(null)
    const payload = { ...form, categoryId: Number(form.categoryId), amount }
    try {
      if (expense) await api.expenses.update(expense.id, payload)
      else await api.expenses.create(payload)
      onDone()
      onClose()
    } catch (error) {
      setApiError(error)
      setSaving(false)
    }
  }

  return (
    <Modal title={expense ? 'Editar gasto' : 'Nuevo gasto'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField label="Fecha *" value={form.incurredOn} onChange={set('incurredOn')} error={errors.incurredOn} />
          <SelectField label="Categoría *" value={form.categoryId} onChange={set('categoryId')} error={errors.categoryId}>
            <option value="">Seleccioná…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        </div>
        <NumericField label="Importe *" unit="$" value={form.amount} onChange={set('amount')} error={errors.amount} />
        <TextField label="Descripción" value={form.description} onChange={set('description')} maxLength={200} />
        <Alert tone="info">
          No cargues acá gastos que ya incluiste en el costo de un producto (por ejemplo, el filamento de una pieza estimada): se
          contarían dos veces en el resultado.
        </Alert>
        <ErrorAlert error={apiError} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar gasto'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
