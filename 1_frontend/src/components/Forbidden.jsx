import { Link } from 'react-router'

export function Forbidden() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-4xl">🔒</p>
      <h1 className="mt-3 text-xl font-semibold">No tenés permisos para ver esta sección</h1>
      <p className="mt-1 text-sm text-ink-500">Consultá con un administrador si necesitás acceso.</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-700 underline">
        Volver al inicio
      </Link>
    </div>
  )
}
