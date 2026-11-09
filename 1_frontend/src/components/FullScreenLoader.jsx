export function FullScreenLoader({ label = 'Cargando…' }) {
  return (
    <div
      role="status"
      className="flex min-h-screen items-center justify-center gap-3 text-ink-500"
    >
      <span className="size-5 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
