# Frontend — Ohana del Sur

React + Vite + Tailwind CSS 4.

## Puesta en marcha

```bash
npm install
npm run dev
```

Por defecto corre en **modo demo** (`VITE_API_MODE=mock`): un backend simulado en el navegador con datos de ejemplo, para desarrollar y probar sin servidor.

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@demo.com` | `Admin1234` |
| Operador | `operador@demo.com` | `Operador1234` |

El banner superior permite restablecer los datos de ejemplo. Para usar el backend real: `cp .env.example .env` y poner `VITE_API_MODE=http` (ver **INTEGRACION.md**).

Scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm test` (reglas de negocio y cálculo, con el runner de Node).

## Marca

El nombre y el logo se definen en `src/config/brand.js` y `public/logo.png` / `public/favicon.png`. Cambiando esos valores la aplicación se adapta a otro emprendimiento. Las fechas se muestran como día/mes/año.

## Módulos y rutas

El proyecto se entrega en dos partes que **no comparten archivos**: la parte 2 solo agrega archivos nuevos sobre la parte 1.

| Ruta | Historia | Acceso | Parte |
| --- | --- | --- | --- |
| `/login` | HU01 | público | 1 |
| `/productos`, `/productos/nuevo`, `/productos/:id` | HU02 | todos | 1 |
| `/costos`, `/costos/historial` | HU03 | todos | 1 |
| `/costos/parametros` | HU13 | administrador | 1 |
| `/stock` (consulta + producción) | HU04, HU05 | todos | 1 |
| `/stock` (ajuste) | HU06 | administrador | 1 |
| `/stock/movimientos` | HU14 | administrador | 1 |
| `/ventas`, `/ventas/nueva`, `/ventas/:id` | HU07, HU12 | todos | 2 |
| anular / devolver (en `/ventas/:id`) | HU10, HU11 | administrador | 2 |
| `/gastos` | HU08 | administrador | 2 |
| `/dashboard` | HU09 | administrador* | 2 |
| `/usuarios` | HU15 | administrador | 2 |

\* Los operadores pueden habilitarse con `OPERATOR_CAN_VIEW_DASHBOARD` en `src/features/auth/permissions.js`.

## Estructura y cómo se suma un módulo

```
src/
  modules.js           descubre src/features/*/module.js (rutas, menú, pantalla inicial)
  config/brand.js      nombre y logo
  lib/                 cliente HTTP (renovación de token), sesión, fechas, formatos
  components/          layout, modales, DateField y componentes base (Tailwind)
  services/
    index.js           ÚNICO punto de acceso a datos: `import { api } from 'services'`
    mock/              backend simulado
      ops/             reglas de negocio por módulo (puras, con tests)
      slices/          operaciones de la API por módulo
      seeds/           datos de ejemplo por módulo (se ejecutan por orden de nombre)
    http/modules/      implementaciones reales, una por módulo del backend
  features/<modulo>/   pantallas + module.js
```

Un módulo nuevo = su carpeta en `features/` (con `module.js`) + sus archivos en `services/mock/{ops,slices,seeds}` y, cuando exista el backend, `services/http/modules/`. No hay que editar `App.jsx`, el menú ni los registros.
