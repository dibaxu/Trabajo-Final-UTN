import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAuth } from './useAuth.js'
import { ApiError } from '../../lib/http.js'
import { BRAND } from '../../config/brand.js'
import { IS_MOCK } from '../../services/mode.js'
import { DEMO_USERS } from '../../services/mock/demoUsers.js'
import { FullScreenLoader } from '../../components/FullScreenLoader.jsx'

// Mensaje genérico: nunca indica si falló el correo o la contraseña.
const GENERIC_ERROR = 'Correo o contraseña incorrectos.'

function messageFor(error) {
  if (!(error instanceof ApiError)) return 'Ocurrió un error inesperado.'
  switch (error.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Revisá tu conexión.'
    case 403:
      return 'Tu cuenta no tiene acceso habilitado. Consultá con un administrador.'
    case 429:
      return 'Demasiados intentos. Esperá un minuto y volvé a probar.'
    case 500:
    case 503:
      return 'El servicio no está disponible por el momento.'
    default:
      return GENERIC_ERROR // 400 / 401
  }
}

export default function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const from = location.state?.from?.pathname ?? '/'

  if (status === 'loading') return <FullScreenLoader label="Recuperando sesión…" />
  if (status === 'authenticated') return <Navigate to={from} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Ingresá tu correo y contraseña.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(messageFor(err))
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={BRAND.logo} alt={`Logo de ${BRAND.name}`} className="size-32 rounded-full shadow-sm" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">{BRAND.name}</h1>
          <p className="text-sm text-ink-500">{BRAND.tagline}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-5 text-lg font-semibold">Iniciar sesión</h2>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          <label className="mb-4 block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">
              Correo electrónico
            </span>
            <input
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              placeholder="nombre@ejemplo.com"
              disabled={submitting}
              autoFocus
            />
          </label>

          <label className="mb-6 block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">
              Contraseña
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              disabled={submitting}
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-500 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        {IS_MOCK && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">Modo demo (sin backend)</p>
            <p className="mt-1">
              Administrador: {DEMO_USERS.admin.email} / {DEMO_USERS.admin.password}
            </p>
            <p>
              Operador: {DEMO_USERS.operator.email} / {DEMO_USERS.operator.password}
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-ink-400">
          El acceso es solo por invitación de un administrador.
        </p>
      </div>
    </main>
  )
}
