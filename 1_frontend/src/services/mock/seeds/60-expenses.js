// Gastos de demostración (requiere el seed base).
import { saveExpense } from '../ops/expenses.js'

export default function seedExpenses(s, ctx) {
  const { admin, daysAgo } = ctx
  const expense = (cat, ago, amount, description) =>
    saveExpense(s, null, { categoryId: cat, incurredOn: daysAgo(ago).slice(0, 10), amount, description }, admin)
  expense(1, 20, 44000, 'Filamento PLA x2 kg')
  expense(2, 12, 18000, 'Electricidad del taller')
  expense(4, 8, 25000, 'Puesto en feria de diseño')
  expense(3, 8, 6500, 'Traslado a la feria')
  expense(5, 4, 3200, 'Bolsas y etiquetas')
}
