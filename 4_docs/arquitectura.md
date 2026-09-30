# Eleccion de Arquitectura

Responsabilidades:
- React [FRONTEND]:
  - interfaz;
  - formularios;
  - validaciones de experiencia de usuario;
  - manejo de sesión.
- NestJS [BACKEND]:
  - autorización;
  - validaciones definitivas;
  - reglas de negocio;
  - transacciones;
  - exposición de la API mediante controladores, servicios y módulos.
- Supabase [DATABASE]:
  - autenticación;
  - PostgreSQL;
  - imágenes;
  - RLS;
  - copias y administración de datos.

## FRONTEND

Definir WIREFRAMES de referencia, que al menos sean esquemas sencillo con rectangulos y aclaraciones.

## BACKEND

El backend se implementará con NestJS. Definir los endpoints antes de implementar y documentarlos con OpenAPI/Swagger.

En `POST /sales`, `saleType` es obligatorio y admite solo `MAYORISTA` o `MINORISTA`. Es un dato de la cabecera de la venta, común a todos sus detalles; se conserva en el historial y se devuelve en las consultas. `GET /sales` permite filtrar por `saleType` y período. El resumen del dashboard muestra ingresos, costos, margen y unidades desglosados por tipo de venta, con un total general conciliable. Los precios unitarios efectivos se guardan en cada detalle, independientemente del precio de referencia del producto.

POST   /auth/login
GET    /auth/me

GET    /products
POST   /products
GET    /products/:id
PATCH  /products/:id
PATCH  /products/:id/status

GET    /products/:id/cost-estimates
POST   /products/:id/cost-estimates
PATCH  /cost-estimates/:id/current

GET    /stock
GET    /products/:id/stock-movements
POST   /stock/production
POST   /stock/adjustments

GET    /sales
POST   /sales
GET    /sales/:id
POST   /sales/:id/cancellation
POST   /sales/:id/returns

GET    /reports/summary?from=...&to=...&saleType=...
