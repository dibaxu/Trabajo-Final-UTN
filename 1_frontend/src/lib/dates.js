// Fechas de calendario como "YYYY-MM-DD" en hora local del navegador.
const pad = (n) => String(n).padStart(2, '0')

export const toDateStr = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const todayStr = () => toDateStr(new Date())

export const startOfMonthStr = () => {
  const d = new Date()
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), 1))
}

function parse(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str ?? '')
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

export const isValidDateStr = (str) => {
  const d = parse(str)
  return d !== null && toDateStr(d) === str
}

/**
 * Límites [inicio, fin] en milisegundos de un rango de fechas locales,
 * ambos días inclusive. Un extremo vacío no limita.
 */
export function dayRange(from, to) {
  const start = parse(from)
  const end = parse(to)
  return {
    start: start ? start.getTime() : -Infinity,
    end: end ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1).getTime() - 1 : Infinity,
  }
}
