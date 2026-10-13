# Base de datos — documentación

Motor: **PostgreSQL en Supabase**. Esta carpeta conserva documentación; el SQL ejecutable vive exclusivamente en [`2_backend/supabase/migrations`](../2_backend/supabase/migrations/).

## Migración inicial

[`20261009231732_schema_inicial.sql`](../2_backend/supabase/migrations/20261009231732_schema_inicial.sql) contiene el SQL fue creada con `supabase migration new schema_inicial`.

| Tabla | Contenido |
| --- | --- |
| `roles` | Roles del sistema; incluye ADMINISTRADOR. |
| `profiles` | Perfil asociado a `auth.users` y a un rol. |
| `product_categories` | Categorías de productos. |
| `products` | Catálogo, categoría, precio de referencia y usuario creador. |

Es una implementación parcial del [DER](../4_docs/diagrama-entidad-relacion.md). Costos, movimientos, ventas, devoluciones y gastos se agregarán en nuevas migraciones.

Las tablas tienen RLS habilitado y acceso revocado a `anon` y `authenticated`. El frontend no puede hacer CRUD directo mediante la Data API de Supabse. Nest accederá mediante PostgreSQL y deberá implementar autorización.

## Reconstrucción local para desarrollo

Requisitos: Node.js, npm y Docker Desktop iniciado. Desde `2_backend`:

```powershell
npm ci
npm run db:start
npm run db:reset
npm run db:status
```

`db:reset` ejecuta `supabase db reset --local`: descarta los datos locales y reconstruye la base usando todas las migraciones, seguidas de `seed.sql`. Supabase local crea previamente `auth.users` y los roles internos necesarios. El seed está preparado para datos ficticios y por ahora solo contiene comentarios.

Para conectar Nest al entorno local, copiá la URL PostgreSQL y los valores de API de `db:status` a tu `.env`, usá `DATABASE_SSL=false` y dejá `DATABASE_CA_PATH` vacío. No publiques las claves mostradas por ese comando.

## Crear cambios

```powershell
npm run db:migration:new -- agregar_costos
```

La CLI genera `supabase/migrations/<timestamp>_agregar_costos.sql`. Agregá el SQL ahí, revisalo y probalo reconstruyendo la base local. Una migración compartida y aplicada no se edita: la corrección se incorpora en otra migración.

Versioná migraciones, `config.toml`, `seed.sql` y documentación. No mantengas una segunda copia del SQL en `3_database`, ni subas dumps con datos reales, contraseñas o archivos de `.temp`.

## Aplicación remota

Desde `2_backend`, vinculá el checkout si todavía no está vinculado:

```powershell
npm run supabase -- login
npm run supabase -- link --project-ref TU_PROJECT_REF
npm run db:migration:list
npm run db:push:dry
```

Después de comprobar el proyecto y las migraciones pendientes:

```powershell
npm run db:push
```

Ese último comando modifica la base remota. El arranque de Nest no aplica SQL automáticamente. Esta configuración inicial no ejecutó migraciones remotas.

## Si ya ejecutaste `001_inicial.sql` desde el SQL Editor

No vuelvas a aplicar la migración inicial sobre esas tablas. Primero compará el esquema completo con el archivo de migración.

Solo si coincide exactamente, registrá esa versión como aplicada:

```powershell
npm run supabase -- migration repair 20261009231732 --status applied --linked
npm run db:migration:list
npm run db:push:dry
```

`migration repair` cambia el historial remoto, no ejecuta el SQL. No lo uses para ocultar diferencias de esquema. Si existen diferencias, revisá el esquema remoto mediante `supabase db pull` y acordá una migración de referencia antes de hacer `db push`.

Referencias: [migraciones de Supabase](https://supabase.com/docs/guides/local-development/database-migrations), [CLI](https://supabase.com/docs/reference/cli/introduction), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
