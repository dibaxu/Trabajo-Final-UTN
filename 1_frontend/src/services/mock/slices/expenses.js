import { op } from '../op.js'
import { listExpenseCategories, listExpenses, saveExpense, voidExpense } from '../ops/expenses.js'

const P = { permission: 'expenses.manage' }

export default {
  expenses: {
    categories: op((s) => listExpenseCategories(s), P),
    list: op((s, _a, filters) => listExpenses(s, filters), P),
    create: op((s, a, data) => saveExpense(s, null, data, a.id), { ...P, tx: true }),
    update: op((s, a, id, data) => saveExpense(s, id, data, a.id), { ...P, tx: true }),
    void: op((s, a, id) => voidExpense(s, id, a.id), { ...P, tx: true }),
  },
}
