# Integración con el backend — parte 2 (ventas, gastos, resumen, usuarios)

Complementa a `INTEGRACION.md` (misma convención: un archivo por módulo en `src/services/http/modules/`).

| Servicio (`api.…`) | Endpoint propuesto | Notas |
| --- | --- | --- |
| `sales.list/get` | `GET /sales?from&to&status&saleType`, `GET /sales/:id` | El detalle incluye `items` (con `returnedQuantity`) y `returns`. |
| `sales.create` | `POST /sales` | `{saleType, notes, items:[{productId, quantity, unitPrice, costSource: ESTIMACION\|MANUAL, costEstimateId?, unitCost?}]}`. **Transacción única** (venta + detalles + movimientos) con bloqueo de stock. Con `ESTIMACION` el servidor toma el costo de la estimación (debe pertenecer al producto). |
| `sales.cancel` | `POST /sales/:id/cancel` | Admin. `{reason}`. 409 si ya anulada o con devoluciones. |
| `sales.createReturn` | `POST /sales/:id/returns` | Admin. `{reason, items:[{saleItemId, quantity}]}`. Estado resultante `PARCIALMENTE_DEVUELTA` / `DEVUELTA`. |
| `expenses.categories/list/create/update/void` | `GET /expense-categories`, `GET/POST /expenses`, `PATCH /expenses/:id`, `POST /expenses/:id/void` | Admin. Importe > 0. Estados `ACTIVO` / `ANULADO`. Categorías que espera el front: Insumos, Servicios, Transporte, Feria, Otros. |
| `reports.dashboard` | `GET /reports/dashboard?from&to` | Ver reglas abajo. |
| `users.list/invite/setStatus` | ya existen: `/users`, `/users/invitations`, `/users/:id/status` | Implementado en `services/http/modules/users.js`. |

Estados de venta: `CONFIRMADA`, `ANULADA`, `PARCIALMENTE_DEVUELTA`, `DEVUELTA`. Tipo: `MAYORISTA` | `MINORISTA` (obligatorio, sin valor por defecto).

## Resumen (HU09)

Entrada `from`/`to` (días inclusive). Cuentan las ventas del período que **no están anuladas**; las devoluciones restan unidades, ingresos y costo de la venta original (atribuidas al período de esa venta). Gastos: solo `ACTIVO` con fecha en el período. `netResult = revenue − cogs − expenses`. Respuesta: `revenue, cogs, grossMargin, expenses, netResult, units, salesCount, byType{MAYORISTA,MINORISTA}, byProduct[], expensesByCategory[]`. **Definir la zona horaria del negocio** (p. ej. `America/Argentina/Buenos_Aires`) para los límites de día; hoy el simulado usa la hora local del navegador.
