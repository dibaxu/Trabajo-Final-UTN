import { BRAND } from '../../config/brand.js'

/** Marco común de las pantallas públicas de acceso (logo, marca y tarjeta). */
export function AuthLayout({ title, children }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={BRAND.logo} alt={`Logo de ${BRAND.name}`} className="size-32 rounded-full shadow-sm" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">{BRAND.name}</h1>
          <p className="text-sm text-ink-500">{BRAND.tagline}</p>
        </div>
        <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">{title}</h2>
          {children}
        </div>
      </div>
    </main>
  )
}

export function AuthAlert({ tone = 'error', children }) {
  const styles =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`mb-4 rounded-lg border px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  )
}
