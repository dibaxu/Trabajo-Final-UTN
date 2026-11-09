// Datos base de demostración: usuarios, categorías, parámetros, productos, estimaciones y producción.
import { DEMO_USERS } from '../demoUsers.js'
import { createCategory } from '../ops/catalog.js'
import { saveProduct } from '../ops/catalog.js'
import { createCostSetting, createEstimate } from '../ops/costs.js'
import { insertMovement } from '../ops/inventory.js'

export default function seedBase(s, ctx) {
  const { daysAgo } = ctx
  const admin = crypto.randomUUID()
  const operator = crypto.randomUUID()
  ctx.admin = admin
  ctx.operator = operator
  s.profiles.push(
    { id: admin, email: DEMO_USERS.admin.email, password: DEMO_USERS.admin.password, displayName: 'Ana (administradora)', role: 'ADMINISTRADOR', isActive: true, emailConfirmed: true, invitedBy: null },
    { id: operator, email: DEMO_USERS.operator.email, password: DEMO_USERS.operator.password, displayName: 'Beto (operador)', role: 'OPERADOR', isActive: true, emailConfirmed: true, invitedBy: admin },
  )

  const cat = Object.fromEntries(
    ['Decoración', 'Llaveros', 'Funcionales', 'Juguetes'].map((name) => [name, createCategory(s, { name }).id]),
  )

  createCostSetting(
    s,
    { filamentPricePerKg: 22000, electricityPricePerKwh: 120, wearCostPerHour: 150, laborCostPerHour: 3500, effectiveFrom: daysAgo(60) },
    admin,
  )

  const catalog = [
    { name: 'Maceta geométrica', sku: 'MAC-001', c: 'Decoración', price: 9000, w: 85, h: 3, m: 20, watts: 180, labor: 0.25 },
    { name: 'Llavero logo', sku: 'LLA-001', c: 'Llaveros', price: 2500, w: 12, h: 0, m: 40, watts: 150, labor: 0.1 },
    { name: 'Soporte para celular', sku: 'FUN-001', c: 'Funcionales', price: 6500, w: 55, h: 2, m: 10, watts: 170, labor: 0.2 },
    { name: 'Dragón articulado', sku: 'JUG-001', c: 'Juguetes', price: 14000, w: 140, h: 7, m: 30, watts: 200, labor: 0.5 },
    { name: 'Organizador de cables', sku: 'FUN-002', c: 'Funcionales', price: 4800, w: 35, h: 1, m: 45, watts: 160, labor: 0.15 },
    { name: 'Figura decorativa (descontinuada)', sku: 'DEC-009', c: 'Decoración', price: 7000, w: 60, h: 2, m: 0, watts: 180, labor: 0.2, inactive: true },
  ]
  const ids = []
  ctx.ids = ids
  for (const it of catalog) {
    const p = saveProduct(s, null, { name: it.name, sku: it.sku, categoryId: cat[it.c], description: '', referenceSalePrice: it.price, weightGrams: it.w, currentCost: 0, isActive: true }, admin)
    ids.push(p.id)
    createEstimate(
      s,
      {
        productId: p.id,
        costSettingId: 1,
        params: { weightGrams: it.w, filamentPricePerKg: 22000, printHours: it.h, printMinutes: it.m, powerWatts: it.watts, kwhCost: 120, wearPerHour: 150, laborHours: it.labor, laborRate: 3500, extras: 100 },
      },
      admin,
    )
  }
  saveProduct(s, ids[5], { ...s.products[5], isActive: false }, admin)

  // Producción inicial (con fechas pasadas)
  const produce = [[ids[0], 30, 25], [ids[1], 120, 25], [ids[2], 40, 25], [ids[3], 12, 20], [ids[4], 50, 20]]
  for (const [productId, qty, ago] of produce) {
    insertMovement(s, { productId, type: 'PRODUCCION', delta: qty, reason: 'Producción inicial', at: daysAgo(ago) }, admin)
  }
}
