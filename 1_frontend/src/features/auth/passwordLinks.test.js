import test from 'node:test'
import assert from 'node:assert/strict'
import { PASSWORD_MAX, PASSWORD_MIN, readHashToken, readPasswordLink, validateNewPassword } from './passwordLinks.js'

test('readHashToken lee token_hash del fragmento', () => {
  assert.equal(readHashToken('#token_hash=abc123'), 'abc123')
  assert.equal(readHashToken('token_hash=abc123'), 'abc123')
  assert.equal(readHashToken('#foo=1&token_hash=xyz&bar=2'), 'xyz')
})

test('readHashToken decodifica caracteres codificados', () => {
  assert.equal(readHashToken('#token_hash=a%2Bb%3D'), 'a+b=')
})

test('readHashToken devuelve null si falta o está vacío', () => {
  assert.equal(readHashToken(''), null)
  assert.equal(readHashToken('#'), null)
  assert.equal(readHashToken(undefined), null)
  assert.equal(readHashToken('#token_hash='), null)
  assert.equal(readHashToken('#otro=1'), null)
})

const NOW = 1800000000
const standardParams = (type = 'invite') => new URLSearchParams({
  access_token: 'access-del-correo',
  refresh_token: 'refresh-del-correo',
  expires_in: '3600',
  expires_at: String(NOW + 3600),
  token_type: 'bearer',
  type,
})

test('el retorno estándar de invitación y recuperación conserva los tokens recibidos', () => {
  for (const type of ['invite', 'recovery']) {
    assert.deepEqual(readPasswordLink(`#${standardParams(type)}`, type, NOW), {
      kind: 'session',
      session: {
        accessToken: 'access-del-correo', refreshToken: 'refresh-del-correo',
        expiresIn: 3600, expiresAt: NOW + 3600, tokenType: 'bearer',
      },
    })
  }
})

test('acepta tokens codificados y calcula el vencimiento cuando solo viene expires_in', () => {
  const params = standardParams()
  params.set('refresh_token', 'refresh+con=caracteres/')
  params.delete('expires_at')
  const link = readPasswordLink(`#${params}`, 'invite', NOW)
  assert.equal(link.session.refreshToken, 'refresh+con=caracteres/')
  assert.equal(link.session.expiresAt, NOW + 3600)
})

test('conserva compatibilidad con las plantillas token_hash y distingue una URL sin enlace', () => {
  assert.deepEqual(readPasswordLink('#token_hash=demo', 'invite', NOW), { kind: 'hash', tokenHash: 'demo' })
  for (const hash of ['', '#', undefined, '#otro=1']) {
    assert.equal(readPasswordLink(hash, 'invite', NOW), null)
  }
  assert.deepEqual(readPasswordLink('#token_hash=', 'invite', NOW), { kind: 'invalid' })
})

test('rechaza errores de Supabase aunque también haya tokens, sin exponer el mensaje recibido', () => {
  for (const key of ['error', 'error_code', 'error_description']) {
    const params = standardParams()
    params.set(key, 'otp_expired')
    assert.deepEqual(readPasswordLink(`#${params}`, 'invite', NOW), { kind: 'invalid' })
    assert.deepEqual(readPasswordLink(`#${key}=otp_expired`, 'invite', NOW), { kind: 'invalid' })
  }
})

test('rechaza tokens incompletos o un tipo de flujo distinto, sin recurrir a token_hash', () => {
  for (const key of ['access_token', 'refresh_token', 'type', 'token_type', 'expires_in']) {
    const params = standardParams()
    params.delete(key)
    params.set('token_hash', 'no-usar-como-alternativa')
    assert.deepEqual(readPasswordLink(`#${params}`, 'invite', NOW), { kind: 'invalid' })
  }
  assert.deepEqual(readPasswordLink(`#${standardParams('recovery')}`, 'invite', NOW), { kind: 'invalid' })
  assert.deepEqual(readPasswordLink('#token_hash=demo&type=recovery', 'invite', NOW), { kind: 'invalid' })
})

test('rechaza vencimientos inválidos o ya vencidos y tokens vacíos', () => {
  for (const [key, value] of [
    ['expires_in', 'NaN'], ['expires_in', '0'], ['expires_in', '-1'], ['expires_in', '1.5'],
    ['expires_at', ''], ['expires_at', String(NOW)], ['expires_at', String(NOW - 1)],
    ['expires_at', 'Infinity'], ['access_token', ' '], ['refresh_token', ''], ['token_type', 'otro'],
  ]) {
    const params = standardParams()
    params.set(key, value)
    assert.deepEqual(readPasswordLink(`#${params}`, 'invite', NOW), { kind: 'invalid' }, `${key}=${value}`)
  }
})

test('validateNewPassword exige longitud y coincidencia', () => {
  const ok = 'a'.repeat(PASSWORD_MIN)
  assert.equal(validateNewPassword(ok, ok), '')
  assert.match(validateNewPassword('', ''), /Ingresá/)
  assert.match(validateNewPassword('corta', 'corta'), /al menos 12/)
  assert.match(validateNewPassword(ok, ok + 'x'), /no coinciden/)
  const long = 'a'.repeat(PASSWORD_MAX + 1)
  assert.match(validateNewPassword(long, long), /como máximo 128/)
  const max = 'a'.repeat(PASSWORD_MAX)
  assert.equal(validateNewPassword(max, max), '')
})
