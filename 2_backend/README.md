# Backend — administración de impresión 3D

NestJS 12 con TypeScript y ESM. PostgreSQL de Supabase se consulta mediante `pg`; `@supabase/supabase-js` queda disponible para Auth y Storage. Las migraciones se gestionan con Supabase CLI desde esta carpeta.

## Preparación

Requiere Node.js 24.15 o posterior de la línea 24 y npm. Para usar Supabase localmente también necesitás Docker Desktop iniciado. La CLI está fijada como dependencia de desarrollo; no hace falta instalarla globalmente.

Desde `2_backend`:

```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Si ya tenés `.env`, completá sus variables sin sobrescribirlo. Obtené `DATABASE_URL` desde Supabase > Connect: conexión directa si tu red admite IPv6, o **Session pooler** para IPv4. Usá la contraseña PostgreSQL y codificá sus caracteres reservados en la URL. No uses una API key como contraseña.

Descargá la CA de Database Settings > SSL Configuration y guardala en `certs/prod-ca-2021.crt`. El certificado CA es público; `.env`, claves y estado temporal de la CLI no se versionan.

| Variable | Uso |
| --- | --- |
| `NODE_ENV` | `development`, `test` o `production`; predeterminado `development`. |
| `PORT` | Puerto HTTP; predeterminado `3000`. |
| `FRONTEND_ORIGIN` | Origen exacto permitido por CORS, sin ruta ni barra final. |
| `DATABASE_URL` | URL PostgreSQL del proyecto. |
| `DATABASE_SSL` | `true` por defecto; `false` solo para PostgreSQL local. |
| `DATABASE_CA_PATH` | Ruta opcional del certificado CA, absoluta o relativa a `2_backend`, independientemente del directorio de ejecución. |
| `DATABASE_POOL_MAX` | Máximo de conexiones por proceso; predeterminado `5`. |
| `SUPABASE_URL` | URL HTTP del proyecto para Auth y Storage. |
| `SUPABASE_PUBLISHABLE_KEY` | Clave publicable; no uses una clave secreta. |
| `SUPABASE_SECRET_KEY` | Clave secreta del backend para crear cuentas e invitar (`sb_secret_...` o `service_role` heredada). Nunca en el frontend. |

Los parámetros SSL de `DATABASE_URL` se reemplazan por `DATABASE_SSL` y `DATABASE_CA_PATH`. Sin una CA configurada se usa la confianza predeterminada de Node; se conserva la verificación del servidor.

## Ejecutar

### Vercel

Configurar **Root Directory** como `2_backend`, **Framework Preset** como NestJS y **Node.js Version** como `24.x` en el panel. `vercel.json` declara el framework y no necesita reglas `functions`.

Además de las variables de la tabla anterior, agregar en las variables del proyecto de Vercel, para Production y para los Preview que usen este backend:

```dotenv
NODE_OPTIONS=--experimental-require-module
DATABASE_CA_PATH=./certs/prod-ca-2021.crt
DATABASE_SSL=true
```

NestJS 12 publica módulos ESM y `@nestjs/throttler` 6.7.1 los carga mediante `require()`. Si el runtime deshabilita esa interoperabilidad, la función falla al cargar con `ERR_REQUIRE_ESM`, antes de atender el login. La opción habilita esa carga; no hace falta modificar archivos de `node_modules`.

El certificado público `certs/prod-ca-2021.crt` debe estar versionado. El código lo lee con una URL literal relativa al módulo para que Node File Trace, utilizado por Vercel, lo incluya automáticamente en la función. Las rutas relativas de `DATABASE_CA_PATH` se resuelven desde `2_backend` tanto al ejecutar TypeScript como al ejecutar `dist`. Para otro archivo CA, también es necesario garantizar su inclusión en el paquete de despliegue.

El entrypoint inicia `bootstrap()` sin `await` en el nivel superior. El adaptador de Vercel captura `server.listen()` durante la importación y abre el servidor después; esperar el arranque desde el propio módulo provoca un bloqueo circular. Los errores del arranque se registran y finalizan el proceso con código 1. La prueba `test/vercel-startup.e2e-spec.ts` reproduce ese contrato y verifica health, Swagger y el preflight CORS sin conexiones a servicios externos.

Guardar la variable **antes** de crear un nuevo deploy. Los despliegues existentes conservan su configuración anterior. Después del deploy, comprobar `/api/health` y el inicio de sesión desde el frontend.

### Local

```powershell
npm run start:dev
```

El inicio valida las variables y ejecuta `SELECT 1`. Si no puede conectarse, no empieza a aceptar peticiones. No ejecuta migraciones al arrancar.

- Salud: <http://localhost:3000/api/health> (`200` con base disponible; `503` si falla).
- Swagger: <http://localhost:3000/api/docs>.
- OpenAPI JSON: <http://localhost:3000/api/docs-json>.
- OpenAPI YAML: <http://localhost:3000/api/docs-yaml>.

Para frontend: [contrato, ejemplos y flujo para registrar nuevos endpoints](../4_docs/api.md). El documento versionado se encuentra en [`openapi/openapi.json`](openapi/openapi.json) y se genera desde los mismos controladores y DTO que Swagger.

```powershell
npm run openapi:generate
npm run openapi:check
```

Estos comandos compilan y leen los metadatos de la API sin conectarse a PostgreSQL ni Supabase. `openapi:check` permite detectar que el contrato versionado quedó desactualizado.

Para probar los endpoints manualmente, abrir la [colección y el entorno YAML v3 de Postman](postman/README.md) en Local Mode. Incluyen el flujo por invitación, guardado automático de tokens y pruebas de acceso desactivado o sesión cerrada.

El acceso por invitación está implementado. Incluye login, renovación, verificación de enlaces, contraseña, recuperación, logout, perfil, listado de miembros, invitaciones y cambio de estado. Las rutas de negocio requieren una sesión válida y un perfil activo por defecto. Ver el [contrato, diseño y puesta en marcha de autenticación](../4_docs/autenticacion.md).

## Catálogo

| Operación | Rutas |
| --- | --- |
| Consultar productos | `GET /api/products?search=mac&categoryId=1&status=active`, `GET /api/products/:id` |
| Administrar productos | `POST /api/products`, `PATCH /api/products/:id`, `PATCH /api/products/:id/status` |
| Consultar categorías | `GET /api/product-categories` |
| Administrar categorías | `POST /api/product-categories`, `PATCH /api/product-categories/:id` |

Las escrituras requieren el rol `ADMINISTRADOR`. Para dar de alta un producto, enviá al menos `name` y `categoryId`. El producto admite un `manualCost` opcional de hasta dos decimales. Enviar `null` elimina el costo manual y enviar `0` registra un costo de cero. Los importes se expresan como números JSON. El peso corresponde a cada futura estimación de costo. `imageUrl` se devuelve como `null` hasta incorporar Storage. `stock` es numérico y vale cero cuando el producto todavía no tiene movimientos.

El catálogo conserva los registros al desactivarlos. Los nombres de categoría y los SKU se comparan sin distinguir mayúsculas. Si la base ya tiene registros duplicados con esa regla, resolvé esos duplicados antes de aplicar la [migración del catálogo](supabase/migrations/20261117000442_catalogo_productos.sql).

## Inventario

| Operación | Ruta y entrada |
| --- | --- |
| Consultar existencias | `GET /api/stock?search=mac&categoryId=1&availability=available` |
| Registrar producción | `POST /api/stock/production` con `{ "productId": 1, "quantity": 10, "note": "Lote PLA" }` |
| Ajustar existencias | `POST /api/stock/adjustments` con `{ "productId": 1, "direction": "DECREASE", "quantity": 2, "reason": "Piezas dañadas" }` |
| Consultar movimientos | `GET /api/stock/movements?productId=1&type=PRODUCCION&from=2026-11-01&to=2026-11-30` |

Producción y consulta de existencias requieren un perfil activo. Los ajustes y el historial requieren `ADMINISTRADOR`. Las cantidades son enteros entre 1 y 2147483647. `direction` admite `INCREASE` y `DECREASE`; `availability` admite `available` y `out`. La observación es opcional y el motivo del ajuste es obligatorio, ambos con hasta 200 caracteres.

Las escrituras responden `201` con `{ movement, stockBefore, stockAfter }`. El servidor asigna fecha y usuario. Cada POST confirmado registra una operación nueva. Un producto inexistente devuelve `404`; un producto inactivo o datos inválidos devuelven `400`; un ajuste con stock insuficiente devuelve `409`.

Los filtros de fecha incluyen ambos días completos en `America/Argentina/Buenos_Aires`. El historial incluye productos inactivos y admite `PRODUCCION`, `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`, `VENTA`, `ANULACION` y `DEVOLUCION`, ordenados por fecha e identificador descendentes. Los movimientos comerciales incluyen `saleId`, `saleItemId` y, cuando corresponde, `returnId`. Las consultas devuelven listas completas.

`InventoryService` concentra las consultas de movimientos, el cálculo de saldos y las transacciones. Bloquea la fila del producto antes de calcular el saldo y registrar una entrada o salida, coordinando las escrituras simultáneas y los cambios de estado del producto. Las correcciones se registran como movimientos nuevos. La interfaz compartida `getBalances(productIds, client?)` entrega existencias por lote y permite usar una transacción existente. Productos consume esa interfaz para incluir stock.

La [migración de Inventario](supabase/migrations/20261121200218_inventario_movimientos.sql) crea el historial con sus claves foráneas, restricciones de signo y motivo, índices y RLS. Conserva bloqueado el acceso de `anon` y `authenticated`. La migración de Ventas incorpora las relaciones con los detalles de ventas y devoluciones.

## Ventas

| Operación | Ruta |
| --- | --- |
| Consultar ventas | `GET /api/sales?from=2026-11-01&to=2026-11-30&status=CONFIRMADA&saleType=MINORISTA` |
| Consultar una venta | `GET /api/sales/:id` |
| Confirmar una venta | `POST /api/sales` |
| Anular una venta | `POST /api/sales/:id/cancel` |
| Registrar una devolución | `POST /api/sales/:id/returns` |

Para confirmar una venta, enviá el tipo obligatorio `MAYORISTA` o `MINORISTA` y al menos un detalle.

```json
{
  "saleType": "MINORISTA",
  "notes": "Venta en feria",
  "items": [
    { "productId": 1, "quantity": 2, "unitPrice": 1500, "costSource": "MANUAL", "unitCost": 650 }
  ]
}
```

El costo manual es explícito por detalle y queda guardado como dato histórico. El módulo de Costos incorporará la selección de estimaciones; `costEstimateId` devuelve `null` en esta entrega. Los precios y costos unitarios admiten hasta dos decimales y se calculan en centavos enteros antes de guardarse como `numeric`. El servidor calcula subtotales, costos y margen. Los detalles repetidos de un producto se acumulan cuando coinciden el precio y el costo; diferencias devuelven `400`.

La confirmación responde `201` y guarda cabecera, detalles y movimientos en una transacción. Inventario bloquea todos los productos en orden de identificador antes de crear los detalles, verifica que estén activos y comprueba el saldo. Un producto inexistente devuelve `404`, uno inactivo devuelve `400` y existencias insuficientes devuelven `409`. Cada POST confirmado crea una operación nueva.

Anular exige `ADMINISTRADOR` y `{ "reason": "Error de carga" }`. Responde `200`, restituye las unidades y registra usuario, fecha y motivo. Solo se permite sobre una venta `CONFIRMADA` sin devoluciones; una segunda anulación devuelve `409`.

Devolver exige `ADMINISTRADOR` y `{ "reason": "Producto devuelto", "items": [{ "saleItemId": 1, "quantity": 1 }] }`. Responde `201` con la venta actualizada. Las cantidades deben pertenecer a la venta y respetar las unidades pendientes. El estado pasa a `PARCIALMENTE_DEVUELTA` o `DEVUELTA`; una venta `ANULADA` impide devoluciones. Las restituciones incluyen productos que fueron desactivados después de venderlos.

Las consultas incluyen detalles, devoluciones, unidades devueltas por detalle y responsables. Los filtros de fecha incluyen ambos días en `America/Argentina/Buenos_Aires`. Los totales de la venta conservan sus valores originales después de anulaciones o devoluciones; el estado y las cantidades devueltas permiten calcular los resultados netos.

`SalesService` concentra el ciclo de vida, los cálculos y las reglas de las ventas. Inventario conserva la responsabilidad sobre las existencias mediante `fulfillSale` y `restoreSale`, usando el cliente de la misma transacción. Las consultas de ventas leen una instantánea consistente para que estado, detalles y devoluciones correspondan al mismo momento.

La [migración de Ventas](supabase/migrations/20261122133649_ventas_anulaciones_devoluciones.sql) agrega ventas, detalles y devoluciones, amplía los movimientos comerciales y protege las tablas con RLS y permisos exclusivos del backend.

## Estructura y convenciones

```text
src/
├── config/                  # Validación de entorno y configuración HTTP
├── infrastructure/
│   ├── database/            # Pool PostgreSQL, consultas y transacciones
│   └── supabase/            # Fábrica de clientes, sin sesiones compartidas
└── modules/                 # auth (incluye usuarios), products, costs, inventory,
                            # sales, expenses, reports y health
supabase/
├── config.toml
├── migrations/              # Única fuente de cambios SQL
└── seed.sql                 # Datos ficticios de desarrollo
```

Los imports locales terminan en `.js` aunque el archivo fuente sea `.ts`. Las dependencias de infraestructura se importan explícitamente. Los módulos exportan operaciones de negocio y mantienen sus repositories internos. Ver [diseño del módulo de acceso](../4_docs/autenticacion.md).

Usá SQL parametrizado (`$1`, `$2`) para valores. En transacciones, ejecutá todas las consultas sobre el cliente recibido en `DatabaseService.transaction()` y pasalo a los repositories necesarios; no abras otra conexión para una parte de la operación.

## Verificar

```powershell
npm run build
npm run lint
npm test
npm run test:e2e
```

Para ejecutar lo compilado: `npm run start:prod` después de `npm run build`.

Para incluir las pruebas de acceso, catálogo, inventario y ventas con PostgreSQL real, configurá `AUTH_TEST_DATABASE_URL` con una base local vacía llamada `auth_test` antes de ejecutar `npm run test:e2e`. La suite crea y elimina sus esquemas de prueba.

## Migraciones

Ejecutá los comandos desde `2_backend`. Ver [documentación de base de datos](../3_database/README.md) para reconstrucción local, aplicación remota y bases que ya ejecutaron el script inicial manualmente.

```powershell
npm run db:migration:new -- agregar_costos
npm run db:start
npm run db:reset
```

`db:reset` apunta explícitamente a la base **local** y borra sus datos. Para el proyecto remoto, primero revisá `npm run db:push:dry`; `npm run db:push` aplica las migraciones pendientes y modifica ese proyecto.

`supabase/config.toml` configura el entorno local: su configuración de Auth apunta al frontend Vite y tiene el registro público deshabilitado para el MVP. Los ajustes de Auth del proyecto remoto deben configurarse en su Dashboard.

Referencias: [conexiones Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres), [migraciones](https://supabase.com/docs/guides/local-development/database-migrations), [transacciones pg](https://node-postgres.com/features/transactions).
