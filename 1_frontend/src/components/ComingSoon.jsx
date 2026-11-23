import { Link } from 'react-router'

/** Pantalla de los módulos que el backend real todavía no implementa (solo modo http). */
export default function ComingSoon() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-ink-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold">Módulo en desarrollo</h1>
      <p className="mt-2 text-sm text-ink-600">
        Esta sección todavía no está disponible en el servidor. Mientras tanto podés usar los módulos habilitados del menú.
      </p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
        Volver al inicio
      </Link>
    </div>
  )
}
