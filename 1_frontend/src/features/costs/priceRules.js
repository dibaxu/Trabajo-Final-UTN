// Multiplicadores del precio de venta sugerido (HU03): precio = costo total × multiplicador.
// TODO (HU13): cuando exista la administración de parámetros de costos,
// estos valores deberían venir del backend.
export const PRICE_RULES = [
  { id: 'mayorista', label: 'Mayorista', multiplier: 2 },
  { id: 'media', label: 'Ganancia media', multiplier: 3 },
  { id: 'estandar', label: 'Estándar', multiplier: 4 },
  { id: 'minorista', label: 'Minorista', multiplier: 5 },
]
