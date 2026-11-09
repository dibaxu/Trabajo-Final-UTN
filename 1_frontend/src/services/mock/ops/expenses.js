// Gastos (HU08).
import { bad, notFound, conflict, nid, text, num, userName } from './common.js'

export const listExpenseCategories = (s) => [...s.expenseCategories]

export function saveExpense(s, id, data, actorId) {
  const existing = id ? s.expenses.find((x) => x.id === Number(id)) : null
  if (id && !existing) throw notFound('Gasto')
  if (existing && existing.status !== 'ACTIVO') throw conflict('Un gasto anulado no puede modificarse.')

  const categoryId = Number(data.categoryId)
  if (!s.expenseCategories.some((c) => c.id === categoryId)) throw bad('La categoría es obligatoria.')
  const incurredOn = String(data.incurredOn ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(incurredOn) || Number.isNaN(Date.parse(incurredOn))) throw bad('La fecha no es válida.')
  const fields = {
    categoryId,
    incurredOn,
    amount: num(data.amount, 'El importe', { positive: true }),
    description: text(data.description, 'La descripción', { max: 200 }),
  }
  const now = new Date().toISOString()
  if (existing) return Object.assign(existing, fields, { updatedAt: now })
  const e = { id: nid(s, 'expenses'), ...fields, status: 'ACTIVO', createdBy: actorId, voidedBy: null, voidedAt: null, createdAt: now, updatedAt: now }
  s.expenses.push(e)
  return e
}

export function voidExpense(s, id, actorId) {
  const e = s.expenses.find((x) => x.id === Number(id))
  if (!e) throw notFound('Gasto')
  if (e.status === 'ANULADO') throw conflict('El gasto ya fue anulado.')
  Object.assign(e, { status: 'ANULADO', voidedBy: actorId, voidedAt: new Date().toISOString() })
  return e
}

export function listExpenses(s, { from, to, categoryId, status } = {}) {
  return s.expenses
    .filter(
      (e) =>
        (!from || e.incurredOn >= from) &&
        (!to || e.incurredOn <= to) &&
        (!categoryId || e.categoryId === Number(categoryId)) &&
        (!status || e.status === status),
    )
    .map((e) => ({
      ...e,
      categoryName: s.expenseCategories.find((c) => c.id === e.categoryId)?.name ?? '—',
      createdByName: userName(s, e.createdBy),
    }))
    .sort((a, b) => b.incurredOn.localeCompare(a.incurredOn) || b.id - a.id)
}

