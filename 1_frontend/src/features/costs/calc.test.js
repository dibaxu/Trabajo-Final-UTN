import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateEstimate, round2, totalTimeHours } from './calc.js'
import { PRICE_RULES } from './priceRules.js'

const base = {
  weightGrams: 100,
  filamentPricePerKg: 20000,
  printHours: 2,
  printMinutes: 30,
  powerWatts: 200,
  kwhCost: 100,
  wearPerHour: 50,
  laborHours: 0.5,
  laborRate: 4000,
  extras: 300,
}

test('tiempo total = horas + minutos / 60', () => {
  assert.equal(totalTimeHours(2, 30), 2.5)
  assert.equal(totalTimeHours(0, 45), 0.75)
})

test('desglose con tiempo total (no solo horas enteras)', () => {
  const r = calculateEstimate(base, PRICE_RULES)
  assert.equal(r.timeHours, 2.5)
  assert.deepEqual(r.breakdown, {
    material: 2000, // 0.1 kg * 20000
    electricity: 50, // 0.2 kW * 100 * 2.5 h
    wear: 125, // 50 * 2.5 h
    labor: 2000, // 0.5 * 4000
    extras: 300,
  })
  assert.equal(r.total, 4475)
})

test('el total es la suma de los componentes redondeados', () => {
  const r = calculateEstimate(
    { ...base, weightGrams: 33, filamentPricePerKg: 18333, powerWatts: 137, kwhCost: 77.77, printMinutes: 17 },
    PRICE_RULES,
  )
  const sum = Object.values(r.breakdown).reduce((a, b) => a + b, 0)
  assert.equal(r.total, round2(sum))
})

test('precios sugeridos: x2 mayorista, x3 media, x4 estándar, x5 minorista', () => {
  const r = calculateEstimate(base, PRICE_RULES) // total 4475
  const price = (id) => r.suggestedPrices.find((s) => s.id === id)
  assert.deepEqual(
    r.suggestedPrices.map((s) => [s.label, s.multiplier]),
    [['Mayorista', 2], ['Ganancia media', 3], ['Estándar', 4], ['Minorista', 5]],
  )
  assert.equal(price('mayorista').price, 8950)
  assert.equal(price('mayorista').profit, 4475)
  assert.equal(price('media').price, 13425)
  assert.equal(price('estandar').price, 17900)
  assert.equal(price('minorista').price, 22375)
  assert.equal(price('minorista').profit, 17900)
})

test('redondeo uniforme a 2 decimales, mitad hacia arriba', () => {
  assert.equal(round2(1.005), 1.01)
  assert.equal(round2(2.675), 2.68)
  assert.equal(round2(0.1 + 0.2), 0.3)
})

test('todo en cero da costo cero', () => {
  const zero = Object.fromEntries(Object.keys(base).map((k) => [k, 0]))
  assert.equal(calculateEstimate(zero, PRICE_RULES).total, 0)
})
