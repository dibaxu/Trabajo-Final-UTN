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
| `DATABASE_CA_PATH` | Ruta opcional del certificado CA, relativa al directorio de ejecución. |
| `DATABASE_POOL_MAX` | Máximo de conexiones por proceso; predeterminado `5`. |
| `SUPABASE_URL` | URL HTTP del proyecto para Auth y Storage. |
| `SUPABASE_PUBLISHABLE_KEY` | Clave publicable; no uses una clave secreta. |
| `SUPABASE_SECRET_KEY` | Clave secreta del backend para crear cuentas e invitar (`sb_secret_...` o `service_role` heredada). Nunca en el frontend. |

Los parámetros SSL de `DATABASE_URL` se reemplazan por `DATABASE_SSL` y `DATABASE_CA_PATH`. Sin una CA configurada se usa la confianza predeterminada de Node; se conserva la verificación del servidor.

## Ejecutar

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

El acceso por invitación está implementado. Incluye login, renovación, verificación de enlaces, contraseña, recuperación, logout, perfil, listado de miembros, invitaciones y cambio de estado. Las rutas de negocio requieren una sesión válida y un perfil activo por defecto. Los CRUD de productos, ventas y demás módulos siguen pendientes. Ver el [contrato, diseño y puesta en marcha de autenticación](../4_docs/autenticacion.md).

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
