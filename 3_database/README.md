# Base de datos inicial

Motor: **PostgreSQL en Supabase**.

El archivo [001_inicial.sql](001_inicial.sql) crea una primera parte del [diagrama entidad-relación](../4_docs/diagrama-entidad-relacion.md):

| Tabla | Contenido |
| --- | --- |
| `roles` | Roles del sistema; incluye el registro inicial ADMINISTRADOR. |
| `profiles` | Perfil de cada usuario, asociado a `auth.users` y a un rol. |
| `product_categories` | Categorías para organizar los productos. |
| `products` | Datos básicos del producto, categoría, precio y usuario creador. |

## Ejecución en Supabase

1. Abrir el proyecto de Supabase y entrar al **SQL Editor**.
2. Crear una consulta, copiar el contenido completo de `001_inicial.sql` y ejecutarlo una sola vez, en una base que todavía no tenga estas tablas.
3. Comprobar en el **Table Editor** que se crearon las cuatro tablas y que `roles` contiene ADMINISTRADOR.

El script utiliza una transacción: si alguna instrucción falla, no se confirma una creación parcial. No elimina ni reemplaza tablas existentes. Requiere las tablas de autenticación y los roles que Supabase ya proporciona.

Para cargar productos de prueba desde el SQL Editor, primero se debe crear un usuario en Supabase Auth, agregar su perfil con el mismo UUID y el rol ADMINISTRADOR, y crear una categoría. El script no crea usuarios ni perfiles automáticamente.

## Alcance y próximos pasos

Esta versión es inicial y parcial. Más adelante se agregarán costos, movimientos de stock, ventas, devoluciones y gastos. No incluye funciones, disparadores ni reglas de negocio completas. Los campos `updated_at` se inicializan al crear el registro; la aplicación deberá actualizarlos cuando modifique sus datos.

Las cuatro tablas tienen RLS habilitado y no conceden acceso a los roles de cliente `anon` y `authenticated`. Se pueden administrar desde el SQL Editor; el acceso desde la aplicación requerirá definir permisos y políticas según los roles del sistema. Referencia: [seguridad por filas en Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

Los cambios posteriores sobre una base ya creada se incorporarán en nuevos scripts numerados, conservando este archivo como punto de partida.
