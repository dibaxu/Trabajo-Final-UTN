# Acceso por invitación

La aplicación es interna: solo un administrador activo puede invitar a otra persona. En el MVP todos los miembros tienen el rol `ADMINISTRADOR`. No existe registro público ni un rol enviado por el cliente.

## Límites del módulo

`AuthModule` maneja el acceso completo: credenciales, sesiones, pertenencia a la aplicación, invitaciones y desactivación. Protección automática de rutas y `@CurrentUser()`. Se integra la administración de usuarios en este módulo para evitar repartir las mismas reglas de acceso entre `auth` y `users`.

Supabase guarda contraseñas, verifica correos, emite y renueva tokens, envía invitaciones y recuperaciones. PostgreSQL guarda el nombre, rol, estado y administrador que invitó en `public.profiles`. Una identidad en `auth.users` por sí sola no habilita acceso a la aplicación. El rol y estado se consultan en la base, nunca en `user_metadata`.

## Contrato HTTP

Todos los endpoints llevan el prefijo `/api`. Los tokens se transportan como JSON y el access token como `Authorization: Bearer <token>`. Las respuestas de acceso usan `Cache-Control: no-store`.

| Método y ruta | Acceso | Entrada / resultado |
| --- | --- | --- |
| `POST /auth/login` | Público | `{email,password}` → sesión y perfil |
| `POST /auth/refresh` | Público | `{refreshToken}` → nuevos tokens y perfil |
| `POST /auth/verify` | Público | `{tokenHash,type: "invite" o "recovery"}` → sesión y perfil |
| `PATCH /auth/password` | Miembro activo | `{password,refreshToken}` → cambia la contraseña y devuelve la sesión vigente |
| `POST /auth/forgot-password` | Público | `{email}` → respuesta genérica sin revelar si existe |
| `POST /auth/logout` | Miembro activo | Revoca la sesión actual; `204` |
| `GET /auth/me` | Miembro activo | Perfil actual |
| `GET /users` | Administrador | Miembros y estado de invitación |
| `POST /users/invitations` | Administrador | `{email,displayName}` → envía o reenvía invitación pendiente |
| `PATCH /users/:id/status` | Administrador | `{isActive}` → habilita o deshabilita acceso |

Las rutas de negocio requieren autenticación por defecto. `@Public()` marca excepciones deliberadas, como salud. `@AdminOnly()` exige un perfil administrador activo. Los cuerpos se validan y rechazan propiedades desconocidas. Se limitan las peticiones, con límites más estrictos para acceso y correos.

## Invitación y fallos parciales

1. Un administrador solicita la invitación. El correo se normaliza y el rol se elige en el servidor.
2. Se crea una cuenta Supabase sin contraseña y sin confirmar el correo. Si ya existe una cuenta pendiente, se reutiliza; una cuenta confirmada produce `409`.
3. Se crea su perfil con el rol fijo y `invited_by`. Una repetición no modifica el estado, nombre o rol de un perfil existente ni reactiva uno deshabilitado.
4. Se envía la invitación con `inviteUserByEmail`. El perfil existe antes de que el correo pueda utilizarse.
5. El correo abre la pantalla del frontend para aceptar la invitación. El frontend extrae `token_hash` del fragmento, lo elimina de la URL y hace `POST /auth/verify` con tipo `invite`.
6. Con la sesión devuelta, la persona define su contraseña mediante `PATCH /auth/password` y conserva los tokens vigentes devueltos por esa operación. El enlace solo puede verificarse una vez. Si la contraseña es rechazada, se conserva la sesión para corregirla sin volver a consumir el enlace.

Crear la cuenta/perfil y enviar correo no es una transacción distribuida. Ante un fallo se conservan los pasos ya completados y se puede repetir la invitación pendiente. No se borra una identidad como compensación ni se guarda un token de invitación propio. Si una llamada de creación compite con otra, se recupera la cuenta pendiente desde la base. Un perfil desactivado produce `403` y exige reactivación explícita.

Un enlace de invitación verificado acredita el correo y permite acceso al miembro activo aunque aún no tenga contraseña; definirla habilita los siguientes inicios de sesión por correo y contraseña.

## Sesión y autorización

Cada petición valida el access token con Supabase Auth y comprueba `session_id` contra `auth.sessions`, además del perfil y rol activos. Esto hace efectivo el cierre de sesión en la API aunque el JWT todavía no haya expirado. Los cambios de estado o rol no esperan a la renovación del JWT. Se comprueba también `auth.sessions.not_after` cuando está definido.

RLS permanece habilitado y las tablas de negocio siguen sin permisos para `anon` y `authenticated`: el frontend accede por Nest. La conexión PostgreSQL del servidor debe poder leer perfiles, roles y las columnas necesarias de `auth.users` y `auth.sessions`.

## Configuración y puesta en marcha

Se requiere `SUPABASE_SECRET_KEY` en el entorno del backend, además de la clave publicable. Se admite la clave secreta actual o la `service_role` heredada.

En Supabase remoto hay que deshabilitar **Allow new users to sign up**, deshabilitar usuarios anónimos, configurar Site URL/orígenes, exigir contraseñas de al menos 12 caracteres y configurar SMTP. `supabase/config.toml` solo afecta al entorno local. Copiar las plantillas de `supabase/templates` en los tipos Invite user y Reset password del Dashboard. Los enlaces apuntan al frontend y este entrega el hash a la API por POST.

Primer administrador (operación del propietario, sin endpoint público): crear una cuenta con **Invite user** desde el Dashboard y, antes de consumir el correo, crear su perfil con el siguiente SQL, reemplazando correo y nombre:

```sql
INSERT INTO public.profiles (id, role_id, display_name)
SELECT u.id, r.id, 'Nombre del administrador'
FROM auth.users AS u
CROSS JOIN public.roles AS r
WHERE lower(u.email) = lower('administrador@example.com')
  AND r.code = 'ADMINISTRADOR' AND r.is_active
ON CONFLICT (id) DO NOTHING;
```

La migración de acceso agrega únicamente la auditoría del invitador. No crea contraseñas, perfiles automáticos para cualquier alta ni políticas que permitan saltarse Nest. Aplicar las migraciones con el procedimiento de `3_database/README.md`.
