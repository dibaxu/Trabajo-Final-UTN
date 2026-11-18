import SetPasswordPage from './SetPasswordPage.jsx'

/** Ruta pública /auth/accept-invitation (enlace del correo de invitación). */
export default function AcceptInvitationPage() {
  return <SetPasswordPage type="invite" />
}
