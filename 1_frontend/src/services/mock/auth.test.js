import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { __useState, configureDb } from './db.js'
import { createSeedFrom } from './seedRunner.js'
import seedBase from './seeds/10-base.js'
import { getState } from './db.js'
import { requestPasswordReset, setPassword, verifyLink } from './invitations.js'

// Flujo simulado de invitación / recuperación: el enlace de ejemplo es "demo".
const createSeed = createSeedFrom([seedBase])
configureDb({ seed: createSeed, version: 'test-auth' })

beforeEach(() => __useState(createSeed()))

const rejects = (promise, status) =>
  assert.rejects(promise, (e) => e.status === status, `esperaba estado ${status}`)

test('un enlace inválido se rechaza con 401', async () => {
  await rejects(verifyLink('otro', 'invite'), 401)
})

test('el enlace de ejemplo permite definir la contraseña de la cuenta', async () => {
  const session = await verifyLink('demo', 'invite')
  assert.equal(session.user.role, 'ADMINISTRADOR')
  const nueva = 'UnaClaveNueva2026!'
  const fresh = await setPassword(session, nueva)
  assert.equal(fresh.user.id, session.user.id)
  const profile = getState().profiles.find((p) => p.id === session.user.id)
  assert.equal(profile.password, nueva)
})

test('la recuperación responde igual exista o no el correo', async () => {
  const a = await requestPasswordReset('alguien@example.com')
  const b = await requestPasswordReset('no-existe@example.com')
  assert.deepEqual(a, b)
})
