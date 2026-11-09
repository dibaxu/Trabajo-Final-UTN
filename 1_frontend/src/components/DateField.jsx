import { useId, useRef, useState } from 'react'
import { isValidDateStr } from '../lib/dates.js'
import { inputClass, inputErrorClass } from './styles.js'

// Valor externo: "YYYY-MM-DD" (o "" si está vacío/incompleto).
// Lo que se ve y se escribe: "dd/mm/aaaa", sin depender del idioma del navegador.
const toDisplay = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '')

/** "9112026" → "09/11/2026" a medida que se escribe (solo dígitos, máx. 8). */
function mask(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

function toIso(text) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (!m) return ''
  const iso = `${m[3]}-${m[2]}-${m[1]}`
  return isValidDateStr(iso) ? iso : ''
}

/**
 * Campo de fecha día/mes/año. `onChange` recibe `{ target: { value } }` con
 * "YYYY-MM-DD" cuando la fecha está completa y es válida, o "" si no.
 */
export function DateField({ label, value, onChange, error, hint }) {
  const id = useId()
  const pickerRef = useRef(null)
  const [text, setText] = useState(toDisplay(value))

  // Si el valor cambia desde afuera (p. ej. un atajo de período), se muestra ese valor.
  const shown = value && toIso(text) !== value ? toDisplay(value) : text
  const invalid = Boolean(error) || (shown.length === 10 && !toIso(shown))

  function handleText(e) {
    const next = mask(e.target.value)
    setText(next)
    onChange({ target: { value: toIso(next) } })
  }

  function handlePicker(e) {
    const iso = e.target.value
    setText(toDisplay(iso))
    onChange({ target: { value: iso } })
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          maxLength={10}
          value={shown}
          onChange={handleText}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${inputClass} tabular-nums pr-11 ${invalid ? inputErrorClass : ''}`}
        />
        <button
          type="button"
          onClick={() => pickerRef.current?.showPicker?.()}
          aria-label="Elegir fecha en el calendario"
          className="absolute inset-y-0 right-1 my-1 rounded-md px-2 text-ink-500 hover:bg-ink-100"
        >
          📅
        </button>
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={value || ''}
          onChange={handlePicker}
          className="pointer-events-none absolute bottom-0 right-0 size-0 opacity-0"
        />
      </div>
      {hint && !error && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
