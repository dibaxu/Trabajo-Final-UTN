# Eleccion de Arquitectura

Responsabilidades:
- React [FRONTEND]:
  - interfaz;
  - formularios;
  - validaciones de experiencia de usuario;
  - manejo de sesión.
- Express [BACKEND]:
  - autorización;
  - validaciones definitivas;
  - reglas de negocio;
  - transacciones;
  - exposición de la API.
- Supabase [DATABASE]:
  - autenticación;
  - PostgreSQL;
  - imágenes;
  - RLS;
  - copias y administración de datos.

## FRONTEND

Definir WIREFRAMES de referencia, que al menos sean esquemas sencillo con rectangulos y aclaraciones.

## BACKEND

Definir los endpoints antes de implementar cualquier cosa y documentar con OpenAPI/Swagger. Creo que faltarian.

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
