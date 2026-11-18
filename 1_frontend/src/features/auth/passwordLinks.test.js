import test from 'node:test'
import assert from 'node:assert/strict'
import { PASSWORD_MAX, PASSWORD_MIN, readHashToken, validateNewPassword } from './passwordLinks.js'

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
