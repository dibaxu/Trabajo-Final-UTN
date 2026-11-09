// Cálculo de costos de impresión 3D. Funciones puras, sin dependencias.

/**
 * Regla de redondeo uniforme: a 2 decimales (centavos), mitad hacia arriba.
 * Se aplica a cada componente, al total (suma de componentes ya redondeados,
 * así el desglose siempre cierra con el total) y a los precios sugeridos.
 */
export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** tiempoTotal = horas + minutos / 60 */
export function totalTimeHours(hours, minutes) {
  return hours + minutes / 60
}

/**
 * @param {object} p parámetros numéricos ya validados
 * @param {number} p.weightGrams peso de la pieza (g)
 * @param {number} p.filamentPricePerKg precio del filamento por kg
 * @param {number} p.printHours horas de impresión
 * @param {number} p.printMinutes minutos de impresión (0–59)
 * @param {number} p.powerWatts consumo eléctrico (W)
 * @param {number} p.kwhCost costo del kWh
 * @param {number} p.wearPerHour desgaste por hora
 * @param {number} p.laborHours horas de trabajo manual
 * @param {number} p.laborRate valor de la hora de trabajo
 * @param {number} p.extras costos extras
 * @param {{id:string,label:string,multiplier:number}[]} priceRules
 */
export function calculateEstimate(p, priceRules = []) {
  const timeHours = totalTimeHours(p.printHours, p.printMinutes)

  const material = round2((p.weightGrams / 1000) * p.filamentPricePerKg)
  // Electricidad y desgaste usan el tiempo total (horas + minutos/60).
  const electricity = round2((p.powerWatts / 1000) * p.kwhCost * timeHours)
  const wear = round2(p.wearPerHour * timeHours)
  const labor = round2(p.laborHours * p.laborRate)
  const extras = round2(p.extras)

  const total = round2(material + electricity + wear + labor + extras)

  const suggestedPrices = priceRules.map((rule) => {
    const price = round2(total * rule.multiplier)
    return {
      id: rule.id,
      label: rule.label,
      multiplier: rule.multiplier,
      price,
      profit: round2(price - total),
    }
  })

  return {
    timeHours,
    breakdown: { material, electricity, wear, labor, extras },
    total,
    suggestedPrices,
  }
}
