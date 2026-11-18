import { useState } from 'react'
import { Link } from 'react-router'
import * as authApi from './authApi.js'
import { ApiError } from '../../lib/http.js'
import { AuthAlert, AuthLayout } from './AuthLayout.jsx'
import { inputClass } from './authStyles.js'

function messageFor(error) {
  if (!(error instanceof ApiError)) return 'Ocurrió un error inesperado.'
  switch (error.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Revisá tu conexión.'
    case 400:
      return 'Ingresá un correo válido.'
    case 429:
      return 'Demasiados intentos. Esperá un minuto y volvé a probar.'
    default:
      return 'El servicio no está disponible por el momento.'
  }
}

/** Ruta pública /auth/forgot-password: pide el correo de recuperación. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Ingresá tu correo.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await authApi.requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Recuperar acceso">
      {sent ? (
        <>
          <AuthAlert tone="success">
            Si el correo corresponde a una cuenta con acceso, vas a recibir un enlace para definir una nueva contraseña.
          </AuthAlert>
          <p className="mb-4 text-sm text-ink-600">Revisá también la carpeta de correo no deseado.</p>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="mb-4 text-sm text-ink-600">
            Ingresá tu correo y te enviamos un enlace para elegir una contraseña nueva.
          </p>
          {error && <AuthAlert>{error}</AuthAlert>}
          <label className="mb-6 block">
            <span className="mb-1.5 block text-sm font-medium text-ink-700">Correo electrónico</span>
            <input
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="nombre@ejemplo.com"
              disabled={submitting}
              autoFocus
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-500 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
