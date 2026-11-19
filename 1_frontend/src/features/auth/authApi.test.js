import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { readPasswordLink } from './passwordLinks.js'

// Vite transforma import.meta.env y el registro import.meta.glob igual que en el frontend.
let vite, api, sessions
before(async () => {
  vite = await createServer({
    configFile: false,
    envDir: false,
    define: {
      'import.meta.env.VITE_API_MODE': JSON.stringify('http'),
      'import.meta.env.VITE_API_URL': JSON.stringify('/api'),
    },
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  api = await vite.ssrLoadModule('/src/features/auth/authApi.js')
  sessions = await vite.ssrLoadModule('/src/lib/session.js')
})
after(async () => { await vite?.close() })
beforeEach(() => sessions.clearSession())

const prior = {
  accessToken: 'otra-cuenta', refreshToken: 'otro-refresh',
  expiresAt: 2000000000, user: { id: 'otra-persona' },
}
const invited = { id: 'persona-del-correo', displayName: 'Persona invitada', email: 'invitada@example.com' }
const response = (data, status = 200) => new Response(JSON.stringify(data), { status })

test('invitación y recuperación usan la cuenta del correo y guardan solo la sesión final', async (t) => {
  for (const type of ['invite', 'recovery']) {
    await t.test(type, async (t) => {
      sessions.saveSession(prior)
      const params = new URLSearchParams({
        access_token: 'access-del-correo', refresh_token: 'refresh-del-correo',
        expires_in: '3600', token_type: 'bearer', type,
      })
      const { session: tokens } = readPasswordLink(`#${params}`, type)
      const final = {
        accessToken: 'access-renovado', refreshToken: 'refresh-renovado',
        expiresAt: 2000003600, user: invited,
      }
      const calls = []
      t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push(url)
        assert.equal(options.headers.Authorization, 'Bearer access-del-correo')
        if (url === '/api/auth/me') {
          assert.equal(options.method, 'GET')
          return response(invited)
        }
        assert.equal(url, '/api/auth/password')
        assert.equal(options.method, 'PATCH')
        const body = JSON.parse(options.body)
        assert.equal(body.refreshToken, 'refresh-del-correo')
        if (body.password === 'ClaveRechazada2026!') return response({ message: 'Contraseña rechazada.' }, 400)
        assert.equal(body.password, 'ClaveAceptada2026!')
        return response(final)
      })

      const verified = await api.verifyLinkSession(tokens)
      assert.deepEqual(verified.user, invited)
      assert.equal(sessions.loadSession().user.id, prior.user.id)
      await assert.rejects(api.setPassword(verified, 'ClaveRechazada2026!'), { status: 400 })
      assert.equal(sessions.loadSession().user.id, prior.user.id)
      await api.setPassword(verified, 'ClaveAceptada2026!')
      assert.deepEqual(sessions.loadSession(), final)
      assert.deepEqual(calls, ['/api/auth/me', '/api/auth/password', '/api/auth/password'])
    })
  }
})

test('una sesión revocada o un perfil desactivado se rechaza sin usar ni reemplazar la cuenta abierta', async (t) => {
  for (const status of [401, 403]) {
    await t.test(String(status), async (t) => {
      sessions.saveSession(prior)
      t.mock.method(globalThis, 'fetch', async (url, options) => {
        assert.equal(url, '/api/auth/me')
        assert.equal(options.headers.Authorization, 'Bearer token-no-autorizado')
        return response({ message: 'Sin acceso.' }, status)
      })
      await assert.rejects(api.verifyLinkSession({ accessToken: 'token-no-autorizado' }), { status })
      assert.deepEqual(sessions.loadSession(), prior)
    })
  }
})

test('la validación de sesión admite reintentar un fallo de red sin persistir tokens', async (t) => {
  let calls = 0
  const tokens = { accessToken: 'access-del-correo', refreshToken: 'refresh-del-correo' }
  t.mock.method(globalThis, 'fetch', async () => {
    if (++calls === 1) throw new TypeError('Sin red')
    return response(invited)
  })
  await assert.rejects(api.verifyLinkSession(tokens), { status: 0 })
  assert.equal(sessions.loadSession(), null)
  assert.deepEqual(await api.verifyLinkSession(tokens), { ...tokens, user: invited })
  assert.equal(sessions.loadSession(), null)
})

test('los enlaces propios siguen verificándose una sola vez por POST con token_hash', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/auth/verify')
    assert.equal(options.method, 'POST')
    assert.deepEqual(JSON.parse(options.body), { tokenHash: 'hash-del-correo', type: 'invite' })
    return response({ user: invited })
  })
  assert.deepEqual(await api.verifyLink('hash-del-correo', 'invite'), { user: invited })
  assert.equal(sessions.loadSession(), null)
})
