/** Texto de un input → número (acepta coma decimal). Vacío o inválido → NaN. */
export function parseNumber(raw) {
  const s = String(raw ?? '').trim().replace(',', '.')
  if (s === '') return NaN
  return /^-?\d*\.?\d+$|^-?\d+\.$/.test(s) ? Number(s) : NaN
}
