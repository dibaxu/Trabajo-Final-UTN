# Integración con el backend

El frontend consume una capa de servicios (`src/services/index.js`). Con `VITE_API_MODE=mock` esa capa es un backend simulado; con `VITE_API_MODE=http` usa la API real. Hoy el backend solo tiene **auth y usuarios**; el resto responde `501` en modo `http` hasta que se implemente.

## Cómo conectar un módulo (sin tocar las pantallas)

1. Crear `src/services/http/modules/<modulo>.js` con `export default { <modulo>: { ...operaciones } }`, con los mismos nombres, argumentos y forma de respuesta que `src/services/mock/slices/<modulo>.js`. El registro (`http/registry.js`) lo detecta solo.
2. Usar `authRequest(path, { method, body })` de `src/lib/http.js` (agrega el Bearer, renueva el token y reintenta ante 401). Los filtros van como query string.
3. La forma exacta de cada respuesta es la que devuelven las funciones de `src/services/mock/ops/*.js` (`productView`, `saleView`, `dashboard`, …), cubierta por `parte1.test.js` y `parte2.test.js`. Si el backend decide otra forma, se adapta en `http/modules/` sin tocar las pantallas.

## Contrato propuesto (parte 1)

Prefijo `/api`, JSON en camelCase, sin envoltorio `data`, errores `{statusCode, message, error}` (igual que auth). Importes numéricos; fechas con hora en ISO 8601; fechas de calendario y filtros `from`/`to` como `YYYY-MM-DD`. La interfaz muestra las fechas como día/mes/año.

| Servicio (`api.…`) | Endpoint propuesto | Notas |
| --- | --- | --- |
| `categories.list/create/update` | `GET/POST /product-categories`, `PATCH /product-categories/:id` | `{name, isActive}`. Nombre único. |
| `products.list` | `GET /products?search&categoryId&status=active\|inactive` | Cada producto incluye `categoryName` y `stock` (suma de movimientos). |
| `products.get/create/update` | `GET /products/:id`, `POST /products`, `PATCH /products/:id` | `name`, `categoryId`, `sku` (único), `description`, `imageUrl`, `referenceSalePrice`, `currentCost`, `weightGrams`, `isActive`. Sin borrado físico. |
| `costSettings.current/list/create` | `GET /cost-settings/current`, `GET /cost-settings`, `POST /cost-settings` | `filamentPricePerKg`, `electricityPricePerKwh`, `wearCostPerHour`, `laborCostPerHour`, `effectiveFrom`. Crear nunca borra anteriores. |
| `estimates.list/create` | `GET /cost-estimates?productId`, `POST /cost-estimates` | El cliente envía `params`; **el servidor recalcula** con las mismas fórmulas (ver abajo). La primera estimación de un producto queda vigente. |
| `estimates.setCurrent` | `POST /cost-estimates/:id/current` | Marca vigente y actualiza `currentCost` del producto. |
| `stock.list` | `GET /stock?search&categoryId&availability=available\|out` | Solo productos activos. |
| `stock.movements` | `GET /stock/movements?productId&type&from&to` | Admin. Incluye `saleId` / `returnId`. |
| `stock.registerProduction` | `POST /stock/production` | `{productId, quantity, note}` → `{movement, stockBefore, stockAfter}`. |
| `stock.adjust` | `POST /stock/adjustments` | Admin. `{productId, direction: INCREASE\|DECREASE, quantity, reason}`. 409 si dejaría stock negativo. |

Movimientos de stock: `PRODUCCION`, `VENTA`, `DEVOLUCION`, `ANULACION`, `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`. En el DER no figura `ANULACION` (movimiento compensatorio de una venta anulada): agregarlo al `CHECK` de `stock_movements.movement_type`.

### Fórmulas de estimación (HU03)

`tiempoTotal = horas + minutos/60`; material `= peso/1000 × precioKg`; electricidad `= consumoW/1000 × costoKWh × tiempoTotal`; desgaste `= desgasteHora × tiempoTotal`; mano de obra `= horasTrabajo × valorHora`; extras. Cada componente se redondea a 2 decimales (mitad hacia arriba) y el total es la suma de los componentes ya redondeados. Referencia: `src/features/costs/calc.js`.

> En la lista de fórmulas original, electricidad y desgaste usaban solo las horas enteras; se siguió el criterio de la HU03 (tiempo total).

### Precios sugeridos

`precio = costo total × multiplicador`: ×2 Mayorista, ×3 Ganancia media, ×4 Estándar, ×5 Minorista (`src/features/costs/priceRules.js`). Si pasan a ser configurables (HU13) deben venir del backend; las estimaciones guardadas conservan los precios calculados.

### Permisos

El front oculta lo que no corresponde según `src/features/auth/permissions.js`, pero el backend debe validarlo (`@AdminOnly()`): ajustes de stock, movimientos, parámetros de costos y, de la parte 2, anulaciones, devoluciones, gastos, usuarios y (salvo que se habilite) el resumen. El MVP solo tiene el rol `ADMINISTRADOR`; la interfaz ya contempla `OPERADOR` (HU01/HU15) para cuando se agregue.
