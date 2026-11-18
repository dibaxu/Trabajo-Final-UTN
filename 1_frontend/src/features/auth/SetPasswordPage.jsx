import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useAuth } from './useAuth.js'
import * as authApi from './authApi.js'
import { ApiError } from '../../lib/http.js'
import { IS_MOCK } from '../../services/mode.js'
import { AuthAlert, AuthLayout } from './AuthLayout.jsx'
import { inputClass } from './authStyles.js'
import { PASSWORD_MIN, readHashToken, validateNewPassword } from './passwordLinks.js'

// Un mismo flujo para dos correos distintos:
//   invite   → /auth/accept-invitation#token_hash=...  (primera contraseña)
//   recovery → /auth/reset-password#token_hash=...     (contraseña olvidada)
const COPY = {
  invite: {
    title: 'Aceptar invitación',
    verifying: 'Verificando tu invitación…',
    intro: 'Definí tu contraseña para ingresar.',
    submit: 'Guardar contraseña y entrar',
    invalid: 'El enlace de invitación no es válido, venció o ya fue usado.',
    help: 'Pedile a un administrador que te reenvíe la invitación. Si ya definiste tu contraseña, iniciá sesión.',
  },
  recovery: {
    title: 'Nueva contraseña',
    verifying: 'Verificando el enlace…',
    intro: 'Elegí una contraseña nueva para tu cuenta.',
    submit: 'Guardar nueva contraseña',
    invalid: 'El enlace no es válido, venció o ya fue usado.',
    help: 'Podés pedir un enlace nuevo desde “Olvidé mi contraseña”.',
  },
}

function verifyMessage(error, copy) {
  if (!(error instanceof ApiError)) return 'Ocurrió un error inesperado.'
  switch (error.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Revisá tu conexión y reintentá.'
    case 403:
      return 'Tu cuenta no tiene acceso habilitado. Consultá con un administrador.'
    case 429:
      return 'Demasiados intentos. Esperá un minuto y volvé a probar.'
    case 500:
    case 503:
      return 'El servicio no está disponible por el momento. Reintentá en unos minutos.'
    default:
      return copy.invalid // 400 / 401
  }
}

// Errores que no consumen el enlace: tiene sentido reintentar con el mismo token.
const isRetryable = (error) =>
  error instanceof ApiError && [0, 429, 500, 503].includes(error.status)

function passwordMessage(error) {
  if (!(error instanceof ApiError)) return 'Ocurrió un error inesperado.'
  switch (error.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Revisá tu conexión.'
    case 400: {
      const detail = error.details?.length ? ` ${error.details.join(' ')}` : ''
      return `La contraseña no cumple los requisitos de seguridad.${detail}`
    }
    case 401:
      return 'La verificación venció. Abrí de nuevo el enlace del correo.'
    case 429:
      return 'Demasiados intentos. Esperá un minuto y volvé a probar.'
    default:
      return 'No se pudo guardar la contraseña. Reintentá en unos minutos.'
  }
}

export default function SetPasswordPage({ type }) {
  const copy = COPY[type]
  const navigate = useNavigate()
  const { status, acceptSession } = useAuth()

  // 'verifying' | 'form' | 'failed' | 'missing' (no hay token en la URL)
  const [phase, setPhase] = useState(() =>
    readHashToken(window.location.hash) ? 'verifying' : 'missing',
  )
  const [verified, setVerified] = useState(null) // sesión devuelta por /auth/verify (solo en memoria)
  const [failure, setFailure] = useState({ message: '', retryable: false })
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const tokenRef = useRef(null)
  const startedRef = useRef(false)

  const runVerify = useCallback(async () => {
    try {
      const session = await authApi.verifyLink(tokenRef.current, type)
      setVerified(session)
      setPhase('form')
    } catch (err) {
      setFailure({ message: verifyMessage(err, COPY[type]), retryable: isRetryable(err) })
      setPhase('failed')
    }
  }, [type])

  useEffect(() => {
    // Evita consumir el enlace dos veces (React StrictMode ejecuta los efectos dos veces en desarrollo).
    if (startedRef.current) return
    startedRef.current = true
    const token = readHashToken(window.location.hash)
    if (!token) return
    tokenRef.current = token
    // El token no debe quedar en la barra de direcciones ni en el historial.
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    runVerify()
  }, [runVerify])

  // Sin token y con sesión iniciada no hay nada que hacer acá.
  if (phase === 'missing' && status === 'authenticated') return <Navigate to="/" replace />

  function retry() {
    setPhase('verifying')
    runVerify()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const problem = validateNewPassword(password, confirmation)
    if (problem) {
      setError(problem)
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const session = await authApi.setPassword(verified, password)
      acceptSession(session)
      navigate('/', { replace: true })
    } catch (err) {
      setError(passwordMessage(err))
      setSubmitting(false)
    }
  }

  if (phase === 'verifying') {
    return (
      <AuthLayout title={copy.title}>
        <div role="status" className="flex items-center gap-3 text-ink-500">
          <span className="size-5 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500" />
          <span className="text-sm">{copy.verifying}</span>
        </div>
      </AuthLayout>
    )
  }

  if (phase === 'failed' || phase === 'missing') {
    const message = phase === 'failed' ? failure.message : copy.invalid
    return (
      <AuthLayout title={copy.title}>
        <AuthAlert>{message}</AuthAlert>
        {phase === 'missing' && <p className="mb-4 text-sm text-ink-600">{copy.help}</p>}
        {phase === 'failed' && !failure.retryable && <p className="mb-4 text-sm text-ink-600">{copy.help}</p>}
        {IS_MOCK && phase === 'missing' && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Modo demo: agregá <code>#token_hash=demo</code> al final de la dirección para probar esta pantalla.
          </p>
        )}
        {failure.retryable && phase === 'failed' && (
          <button
            type="button"
            onClick={retry}
            className="mb-3 w-full rounded-lg bg-brand-500 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-600"
          >
            Reintentar
          </button>
        )}
        <div className="flex flex-col gap-2 text-center text-sm">
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Ir a iniciar sesión
          </Link>
          {type === 'recovery' && (
            <Link to="/auth/forgot-password" className="text-ink-600 hover:underline">
              Pedir un enlace nuevo
            </Link>
          )}
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={copy.title}>
      <form onSubmit={handleSubmit} noValidate>
        {verified?.user && (
          <p className="mb-4 text-sm text-ink-600">
            Hola, <strong>{verified.user.displayName}</strong> ({verified.user.email}). {copy.intro}
          </p>
        )}

        {error && <AuthAlert>{error}</AuthAlert>}

        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">Contraseña nueva</span>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            disabled={submitting}
            autoFocus
            aria-describedby="password-help"
          />
          <span id="password-help" className="mt-1 block text-xs text-ink-500">
            Al menos {PASSWORD_MIN} caracteres.
          </span>
        </label>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">Repetir contraseña</span>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className={inputClass}
            disabled={submitting}
          />
        </label>

        <label className="mb-6 flex items-center gap-2 text-sm text-ink-600">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          Mostrar contraseñas
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-500 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Guardando…' : copy.submit}
        </button>
      </form>
    </AuthLayout>
  )
}
