# Contrato de API para frontend

La documentación se genera desde los controladores y DTO de NestJS. Los mismos metadatos producen Swagger UI, los documentos OpenAPI HTTP y el archivo versionado para trabajar en paralelo.

## Acceso

Con el backend iniciado mediante `npm run start:dev` desde `2_backend`:

| Recurso | URL con el puerto predeterminado |
| --- | --- |
| Swagger UI interactivo | <http://localhost:3000/api/docs> |
| OpenAPI JSON | <http://localhost:3000/api/docs-json> |
| OpenAPI YAML | <http://localhost:3000/api/docs-yaml> |
| Contrato para consultar desde Git | [`2_backend/openapi/openapi.json`](../2_backend/openapi/openapi.json) |

Si se configura otro `PORT`, usarlo en esas URLs. El documento usa OpenAPI **3.0.3**, declara un servidor relativo `/` e incluye el prefijo `/api` en cada ruta. Al generar un cliente para otro origen, configurar la URL base de Nest; no volver a agregar `/api` a las rutas generadas.

Swagger y los documentos de contrato son públicos dentro del servidor de la API. Cada operación indica su propio requisito de autenticación. Los ejemplos son ficticios y no incluyen claves ni sesiones reales.

## Autenticación desde Swagger o frontend

1. Iniciar sesión con `POST /api/auth/login`, o verificar un enlace mediante `POST /api/auth/verify`.
2. En Swagger, abrir **Authorize** y pegar únicamente el valor de `accessToken`. Swagger agrega `Authorization: Bearer <token>` al ejecutar operaciones protegidas.
3. En frontend, enviar esa misma cabecera. Consultar `GET /api/auth/me` para obtener el perfil y rol actuales.
4. Renovar con `POST /api/auth/refresh`, conservar el nuevo par de tokens y evitar renovaciones simultáneas. Al cambiar la contraseña, conservar también la sesión devuelta por esa operación.
5. Al cerrar sesión, borrar los tokens y el perfil guardados por el cliente. El `204` de logout no tiene cuerpo; no intentar leerlo como JSON.

La autorización cargada en Swagger se conserva solo mientras la página permanezca abierta. Para los pasos de invitación, recuperación y primer administrador, ver [autenticación](autenticacion.md). **Try it out** ejecuta peticiones reales contra el origen seleccionado, incluido el envío de correos al invitar o recuperar acceso.

## Endpoints disponibles

| Método y ruta | operationId | Acceso | Respuesta exitosa |
| --- | --- | --- | --- |
| `POST /api/auth/login` | `authLogin` | Público | `200 SessionDto` |
| `POST /api/auth/refresh` | `authRefreshSession` | Público | `200 SessionDto` |
| `POST /api/auth/verify` | `authVerifyLink` | Público | `200 SessionDto` |
| `PATCH /api/auth/password` | `authChangePassword` | Miembro activo | `200 SessionDto` |
| `POST /api/auth/forgot-password` | `authRequestPasswordReset` | Público | `202 MessageDto` |
| `POST /api/auth/logout` | `authLogout` | Miembro activo | `204` sin cuerpo |
| `GET /api/auth/me` | `authGetCurrentUser` | Miembro activo | `200 AccessUserDto` |
| `GET /api/users` | `usersList` | Administrador activo | `200 MemberDto[]` |
| `POST /api/users/invitations` | `usersInvite` | Administrador activo | `202 MessageDto` |
| `PATCH /api/users/{id}/status` | `usersSetStatus` | Administrador activo | `200 MemberDto` |
| `GET /api/health` | `healthCheck` | Público | `200 HealthDto` |

El documento OpenAPI contiene las propiedades requeridas, restricciones, ejemplos, errores y descripciones de cada operación. Los módulos de productos, ventas, stock y reportes todavía no exponen endpoints. Su planificación continúa en [arquitectura](arquitectura.md).

## Respuestas y errores

Las respuestas exitosas son objetos o listas directos, sin un envoltorio `data`. Los tokens usan nombres camelCase: `accessToken`, `refreshToken`, `expiresIn` y `expiresAt`. Los vencimientos están expresados en segundos; para construir un `Date` de JavaScript usar `new Date(expiresAt * 1000)`.

El formato habitual de error es:

```json
{
  "statusCode": 401,
  "message": "Se requiere una sesión válida.",
  "error": "Unauthorized"
}
```

`message` puede ser una lista de strings para validaciones. `error` es opcional: por ejemplo, el limitador de intentos puede devolver solo `statusCode` y `message`. Usar el estado HTTP para decidir la acción del cliente; los textos no son códigos estables de negocio.

Los códigos se documentan por operación: `400` para validaciones, `401` para credenciales/enlaces/sesiones inválidos, `403` para falta de acceso o acciones prohibidas, `404` para un usuario inexistente, `409` para conflictos de invitación, `429` para límites de intentos y `500`/`503` para fallos de servicio. Los clientes deben contemplar también errores de red o respuestas de infraestructura ajenas a Nest.

`GET /api/health` tiene un cuerpo propio en `503`:

```json
{"status":"error","database":"down"}
```

Los cuerpos de entrada rechazan propiedades desconocidas. El cliente no elige el rol al invitar; el MVP asigna `ADMINISTRADOR`. `GET /api/users` devuelve la lista completa sin paginación. Desactivar un miembro bloquea sus siguientes peticiones; reactivarlo permite usar sesiones que todavía sigan vigentes.

## Registrar y compartir cambios

Al agregar o modificar un endpoint:

1. Definir sus DTO de entrada y salida. En entradas, mantener las validaciones y sus restricciones documentadas con `@ApiProperty`; las interfaces de TypeScript por sí solas no generan un esquema de respuesta.
2. En el controlador, agregar `@ApiTags`, `@ApiOperation` con un `operationId` único y estable, descripción, respuesta exitosa tipada y los errores aplicables con `@ApiErrors` de `src/common/api-errors.ts`.
3. Documentar Bearer mediante `@ApiBearerAuth()` cuando corresponda. Las rutas son protegidas por defecto: `@Public()` es una decisión de acceso y `@ApiBearerAuth()` describe el contrato; ambos deben coincidir.
4. Documentar parámetros UUID, restricciones, ejemplos y efectos que cambian el comportamiento del frontend. Incluir el cuerpo real de las respuestas `202` y dejar sin contenido las `204`.
5. Regenerar el contrato y revisar el diff junto al cambio:

```powershell
# Desde 2_backend
npm run openapi:generate
npm run openapi:check
npm run test:e2e
```

La generación compila el backend y obtiene sus metadatos usando configuración ficticia. No inicia un servidor, ejecuta hooks de conexión ni requiere PostgreSQL o Supabase disponibles. `openapi:check` falla si el archivo versionado difiere de los metadatos actuales; permite usar el mismo control en CI.

Versionar el contrato en el mismo cambio que los controladores y DTO. Mantener los `operationId` al renombrar métodos internos evita cambios innecesarios en clientes generados. Swagger se actualiza desde los metadatos al reiniciar o recompilar el backend. La [colección de Postman](../2_backend/postman/README.md) conserva el flujo manual y sus scripts; revisar las peticiones afectadas cuando cambia el contrato.

Referencias: [documentación de operaciones en NestJS](https://docs.nestjs.com/openapi/operations), [tipos y parámetros](https://docs.nestjs.com/openapi/types-and-parameters).
