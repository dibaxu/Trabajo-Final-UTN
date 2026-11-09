import { ApiError } from '../lib/ApiError.js'
import { alertTones, badgeTones, buttonVariants } from './styles.js'

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }) {
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5'
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes} ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({ className = '', ...props }) {
  return <section className={`rounded-2xl border border-ink-200 bg-white p-5 shadow-sm ${className}`} {...props} />
}

export function Badge({ tone = 'neutral', children }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeTones[tone]}`}>
      {children}
    </span>
  )
}

export function Alert({ tone = 'info', children, className = '' }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${alertTones[tone]} ${className}`}>
      {children}
    </div>
  )
}

/** Muestra un error de la API (con la lista de validaciones si la hay). */
export function ErrorAlert({ error, className = '' }) {
  if (!error) return null
  const message = error instanceof ApiError || error?.message ? error.message : 'Ocurrió un error inesperado.'
  return (
    <Alert tone="error" className={className}>
      {message}
      {error.details?.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {error.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </Alert>
  )
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-ink-500">{children}</div>}
    </div>
  )
}

export function Spinner({ label = 'Cargando…' }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-sm text-ink-500">
      <span className="size-5 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500" />
      {label}
    </div>
  )
}

/** Estados de carga / error / vacío para una consulta de useQuery. */
export function QueryState({ query, children }) {
  if (query.loading && !query.data) return <Spinner />
  if (query.error && !query.data) return <ErrorAlert error={query.error} />
  return children(query.data)
}

export function StatCard({ label, value, hint, tone = 'default' }) {
  const color = tone === 'negative' ? 'text-red-700' : tone === 'positive' ? 'text-emerald-700' : 'text-ink-900'
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-ink-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  )
}

/** Contenedor de tabla con scroll horizontal en pantallas chicas. */
export function TableWrap({ children }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white shadow-sm">
      <table className="w-full min-w-[40rem] text-left text-sm">{children}</table>
    </div>
  )
}

export const Th = ({ className = '', ...props }) => (
  <th scope="col" className={`whitespace-nowrap border-b border-ink-200 bg-ink-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500 ${className}`} {...props} />
)
export const Td = ({ className = '', ...props }) => (
  <td className={`border-b border-ink-100 px-4 py-3 align-middle ${className}`} {...props} />
)
