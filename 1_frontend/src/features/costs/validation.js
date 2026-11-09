import { ALL_FIELDS } from './fields.js'

const DECIMAL = /^(\d+([.,]\d*)?|[.,]\d+)$/
const INTEGER = /^\d+$/

/** Convierte el texto de un campo en número. Vacío cuenta como 0. */
export function parseField(raw, field) {
  const s = String(raw ?? '').trim()
  if (s === '') return { value: 0 }
  if (s.startsWith('-')) return { error: 'No puede ser negativo.' }

  if (field.kind === 'integer') {
    if (!INTEGER.test(s)) return { error: 'Ingresá un número entero.' }
  } else if (!DECIMAL.test(s)) {
    return { error: 'Ingresá un número válido.' }
  }

  const value = Number(s.replace(',', '.'))
  if (!Number.isFinite(value)) return { error: 'Ingresá un número válido.' }
  if (field.max !== undefined && value > field.max) {
    return { error: `Debe estar entre 0 y ${field.max}.` }
  }
  return { value }
}

/**
 * Valida el formulario completo.
 * @returns {{ values: object, errors: Record<string,string>, valid: boolean }}
 */
export function validateForm(form) {
  const values = {}
  const errors = {}
  for (const field of ALL_FIELDS) {
    const r = parseField(form[field.key], field)
    if (r.error) errors[field.key] = r.error
    else values[field.key] = r.value
  }
  return { values, errors, valid: Object.keys(errors).length === 0 }
}
