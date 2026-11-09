import { useState } from 'react'
import { api } from '../../services/index.js'
import { useQuery } from '../../lib/useQuery.js'
import { useAuth } from '../auth/useAuth.js'
import { roleLabel } from '../auth/roles.js'
import { Alert, Badge, Button, ErrorAlert, PageHeader, QueryState, TableWrap, Td, Th } from '../../components/ui.jsx'
import { TextField } from '../../components/form.jsx'
import { Modal } from '../../components/Modal.jsx'
import { ConfirmModal } from '../../components/ConfirmModal.jsx'

function InviteModal({ onClose, onDone }) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Ingresá un correo válido.'
    if (!displayName.trim()) next.displayName = 'El nombre es obligatorio.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setSaving(true)
    setApiError(null)
    try {
      const res = await api.users.invite({ email: email.trim().toLowerCase(), displayName: displayName.trim() })
      setMessage(res?.message ?? 'Invitación enviada.')
      onDone()
    } catch (error) {
      setApiError(error)
    } finally {
      setSaving(false)
    }
  }

  if (message) {
    return (
      <Modal title="Invitar persona" onClose={onClose}>
        <Alert tone="success">{message}</Alert>
        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>Listo</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Invitar persona" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <p className="text-sm text-ink-600">Recibirá un correo para aceptar la invitación y definir su contraseña.</p>
        <TextField label="Nombre *" value={displayName} onChange={(e) => setDisplayName(e.target.value)} error={errors.displayName} maxLength={100} autoFocus />
        <TextField label="Correo electrónico *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <ErrorAlert error={apiError} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Enviando…' : 'Enviar invitación'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** HU15 — usuarios, rol y acceso (solo administrador). */
export default function UsersPage() {
  const { user } = useAuth()
  const members = useQuery(api.users.list)
  const [modal, setModal] = useState(null) // { kind: 'invite' } | { kind: 'status', member }

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="El acceso es solo por invitación. En esta versión todos los miembros son administradores; el rol no se puede cambiar desde acá."
        actions={<Button onClick={() => setModal({ kind: 'invite' })}>Invitar persona</Button>}
      />

      <QueryState query={members}>
        {(list) => (
          <TableWrap>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Correo</Th>
                <Th>Rol</Th>
                <Th>Estado</Th>
                <Th>
                  <span className="sr-only">Acciones</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => {
                const self = m.id === user.id
                return (
                  <tr key={m.id}>
                    <Td className="font-medium">
                      {m.displayName} {self && <span className="text-xs font-normal text-ink-500">(vos)</span>}
                    </Td>
                    <Td>{m.email}</Td>
                    <Td>
                      <Badge tone="brand">{roleLabel(m.role)}</Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {m.isActive ? <Badge tone="success">Activo</Badge> : <Badge tone="danger">Deshabilitado</Badge>}
                        {!m.emailConfirmed && <Badge tone="warning">Invitación pendiente</Badge>}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={self}
                          title={self ? 'No podés cambiar tu propio acceso' : undefined}
                          onClick={() => setModal({ kind: 'status', member: m })}
                        >
                          {m.isActive ? 'Deshabilitar' : 'Habilitar'}
                        </Button>
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </TableWrap>
        )}
      </QueryState>

      {modal?.kind === 'invite' && <InviteModal onClose={() => setModal(null)} onDone={members.reload} />}
      {modal?.kind === 'status' && (
        <ConfirmModal
          title={modal.member.isActive ? 'Deshabilitar usuario' : 'Habilitar usuario'}
          danger={modal.member.isActive}
          confirmLabel={modal.member.isActive ? 'Deshabilitar' : 'Habilitar'}
          message={
            modal.member.isActive
              ? `${modal.member.displayName} no podrá ingresar ni usar la aplicación.`
              : `${modal.member.displayName} podrá volver a ingresar.`
          }
          onConfirm={async () => {
            await api.users.setStatus(modal.member.id, !modal.member.isActive)
            members.reload()
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
