# Preguntas sobre Reglas de Negocio y Tareas

## Preguntas

Cómo se calcula el precio sugerido:
- multiplicador??
- porcentaje de margen??
- o carga manual de precio?
Una devolución reintegra siempre el precio original?
Se permite stock negativo? es decir, vender productos sin stock.
Moneda? imagino que peso argentino.


## Armar un diccionario de Datos

armar una tabla con las columnas de las entidades y completar con los siguientes datos:
- Nombre.
- Descripción.
- Tipo PostgreSQL.
- Obligatoria u opcional.
- Valor predeterminado.
- Restricciones.
- Clave primaria o foránea.
- Regla de eliminación.
- Ejemplo.

Algo como:
| Tabla | Campo | Tipo | Obligatorio | Regla |
|---|---|---|---:|---|
| `products` | `name` | `text` | Sí | No puede estar vacío |
| `products` | `reference_sale_price` | `numeric(12,2)` | No | Mayor o igual a cero |
| `sale_items` | `quantity` | `integer` | Sí | Mayor que cero |
| `sale_items` | `unit_cost` | `numeric(12,2)` | Sí | Mayor o igual a cero |
| `stock_movements` | `quantity_delta` | `integer` | Sí | Distinto de cero |