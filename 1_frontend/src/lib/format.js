// Formato de fechas: día/mes/año (es-AR), siempre numérico.
const dateOpts = { day: '2-digit', month: '2-digit', year: 'numeric' }
const date = new Intl.DateTimeFormat('es-AR', dateOpts)
const dateTime = new Intl.DateTimeFormat('es-AR', { ...dateOpts, hour: '2-digit', minute: '2-digit', hour12: false })

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const formatMoney = (value) => money.format(value)
/** ISO con hora → "09/11/2026". */
export const formatDate = (iso) => date.format(new Date(iso))
/** ISO con hora → "09/11/2026 15:35". */
export const formatDateTime = (iso) => dateTime.format(new Date(iso)).replace(',', '')

/** Fecha de calendario "2026-11-09" → "09/11/2026", sin corrimientos de zona horaria. */
export const formatDay = (ymd) => {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

/** 1.5 → "1 h 30 min". */
export function formatDuration(totalHours) {
  const totalMinutes = Math.round(totalHours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}
