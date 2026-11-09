import { useId } from 'react'
import { inputClass, inputErrorClass } from './styles.js'

function FieldShell({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

const aria = (id, error) => ({
  'aria-invalid': error ? 'true' : undefined,
  'aria-describedby': error ? `${id}-error` : undefined,
})

export function TextField({ label, error, hint, className = '', ...props }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <input id={id} {...aria(id, error)} className={`${inputClass} ${error ? inputErrorClass : ''} ${className}`} {...props} />
    </FieldShell>
  )
}

export function SelectField({ label, error, hint, children, className = '', ...props }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <select id={id} {...aria(id, error)} className={`${inputClass} ${error ? inputErrorClass : ''} ${className}`} {...props}>
        {children}
      </select>
    </FieldShell>
  )
}

export function TextAreaField({ label, error, hint, ...props }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <textarea id={id} rows={3} {...aria(id, error)} className={`${inputClass} ${error ? inputErrorClass : ''}`} {...props} />
    </FieldShell>
  )
}

/** Campo de texto numérico (acepta coma decimal) con unidad opcional. */
export function NumericField({ label, unit, error, hint, inputMode = 'decimal', ...props }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          {...aria(id, error)}
          className={`${inputClass} tabular-nums ${unit ? 'pr-14' : ''} ${error ? inputErrorClass : ''}`}
          {...props}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-400">{unit}</span>
        )}
      </div>
    </FieldShell>
  )
}
