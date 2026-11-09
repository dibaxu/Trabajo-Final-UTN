import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateForm } from './validation.js'
import { emptyForm } from './fields.js'

const form = (over) => ({ ...emptyForm(), ...over })

test('minutos entre 0 y 59', () => {
  assert.equal(validateForm(form({ printMinutes: '59' })).valid, true)
  assert.equal(validateForm(form({ printMinutes: '0' })).valid, true)
  assert.ok(validateForm(form({ printMinutes: '60' })).errors.printMinutes)
})

test('no admite negativos', () => {
  const r = validateForm(form({ weightGrams: '-5', extras: '-0,5' }))
  assert.ok(r.errors.weightGrams)
  assert.ok(r.errors.extras)
})

test('acepta coma decimal y vacío como 0', () => {
  const r = validateForm(form({ kwhCost: '12,5' }))
  assert.equal(r.valid, true)
  assert.equal(r.values.kwhCost, 12.5)
  assert.equal(r.values.weightGrams, 0)
})

test('rechaza texto y decimales en horas/minutos', () => {
  const r = validateForm(form({ weightGrams: 'abc', printHours: '1.5', printMinutes: '2,5' }))
  assert.ok(r.errors.weightGrams && r.errors.printHours && r.errors.printMinutes)
})
