## Diagrama Entidad Relación del MVP

Consideraciones del DER:

- `auth.users` pertenece a Supabase y gestiona credenciales y sesiones.
- `profiles` contiene los datos propios de la aplicación.
- `profiles.role_id` permite incorporar otro rol sin alterar la tabla de usuarios.
- `roles` tendrá inicialmente una sola fila: ADMINISTRADOR.
- El registro público debería estar deshabilitado durante el MVP.
- El usuario no puede modificar su propio `role_id`.
- Se utilizan `bigint identity` para entidades y UUID únicamente para usuarios de Supabase.
- Los importes deben usar `numeric`, nunca `float`.
- Fechas con hora deben usar `timestamptz`.
- Productos, categorías y roles se desactivan; no se eliminan si tienen relaciones históricas.
- Las estimaciones son históricas. Solo una debería estar marcada como vigente por producto.
- `sales.sale_type` es obligatorio en la cabecera y admite únicamente `MAYORISTA` o `MINORISTA`; no tiene valor predeterminado. Se conserva al anular o devolver la venta.
- `sale_items.unit_price` conserva el precio efectivo por unidad; puede diferir de `products.reference_sale_price`.
- `sale_items.unit_cost` siempre conserva el costo aplicado.
- `cost_estimate_id` es opcional porque el costo puede ser manual.
- No existe una tabla de stock editable.
- El stock actual se calcula sumando `quantity_delta`.
- La venta, sus detalles y movimientos deben guardarse en una única transacción.
- La devolución crea movimientos positivos.
- La anulación conserva la venta y crea movimientos compensatorios.
- Las operaciones históricas no se actualizan ni eliminan directamente.
- Todas las claves foráneas deben tener índices.
- Las tablas deben habilitar RLS, incluso si inicialmente todos los usuarios poseen el mismo rol.

Restricciones:

- `roles.code` único y en mayúsculas.
- `profiles.role_id` obligatorio.
- `products.reference_sale_price >= 0`.
- `cost_estimates.weight_grams >= 0`.
- `cost_estimates.print_duration_minutes >= 0`.
- `cost_estimates.power_watts >= 0`.
- `cost_estimates.extra_cost >= 0`.
- `cost_estimates.total_cost >= 0`.
- `sales.sale_type NOT NULL` con `CHECK (sale_type IN ('MAYORISTA', 'MINORISTA'))`.
- `sale_items.quantity > 0`.
- `sale_items.unit_price >= 0`.
- `sale_items.unit_cost >= 0`.
- `sale_return_items.quantity > 0`.
- `stock_movements.quantity_delta != 0`.
- `expenses.amount > 0`.

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        text email
    }

    ROLES {
        bigint id PK
        text code UK
        text name
        text description
        boolean is_active
        timestamptz created_at
    }

    PROFILES {
        uuid id PK, FK
        bigint role_id FK
        text display_name
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    PRODUCT_CATEGORIES {
        bigint id PK
        text name UK
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    PRODUCTS {
        bigint id PK
        bigint category_id FK
        text sku UK
        text name
        text description
        text image_path
        numeric reference_sale_price
        boolean is_active
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }

    COST_SETTINGS {
        bigint id PK
        numeric filament_price_per_kg
        numeric electricity_price_per_kwh
        numeric wear_cost_per_hour
        numeric labor_cost_per_hour
        timestamptz effective_from
        uuid created_by FK
        timestamptz created_at
    }

    COST_ESTIMATES {
        bigint id PK
        bigint product_id FK
        bigint cost_setting_id FK
        numeric weight_grams
        integer print_duration_minutes
        numeric power_watts
        numeric labor_hours
        numeric filament_price_per_kg
        numeric electricity_price_per_kwh
        numeric wear_cost_per_hour
        numeric labor_cost_per_hour
        numeric extra_cost
        numeric material_cost
        numeric electricity_cost
        numeric wear_cost
        numeric labor_cost
        numeric total_cost
        boolean is_current
        uuid created_by FK
        timestamptz created_at
    }

    SALES {
        bigint id PK
        text status
        text sale_type
        timestamptz sold_at
        numeric total_amount
        numeric total_cost
        numeric gross_margin
        text notes
        text cancellation_reason
        uuid created_by FK
        uuid cancelled_by FK
        timestamptz cancelled_at
        timestamptz created_at
    }

    SALE_ITEMS {
        bigint id PK
        bigint sale_id FK
        bigint product_id FK
        bigint cost_estimate_id FK
        text cost_source
        integer quantity
        numeric unit_price
        numeric unit_cost
        numeric line_total
        numeric line_cost
        numeric line_margin
    }

    SALE_RETURNS {
        bigint id PK
        bigint sale_id FK
        timestamptz returned_at
        text reason
        uuid created_by FK
        timestamptz created_at
    }

    SALE_RETURN_ITEMS {
        bigint id PK
        bigint sale_return_id FK
        bigint sale_item_id FK
        integer quantity
    }

    STOCK_MOVEMENTS {
        bigint id PK
        bigint product_id FK
        bigint sale_item_id FK
        bigint sale_return_item_id FK
        text movement_type
        integer quantity_delta
        text reason
        timestamptz occurred_at
        uuid created_by FK
        timestamptz created_at
    }

    EXPENSE_CATEGORIES {
        bigint id PK
        text name UK
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    EXPENSES {
        bigint id PK
        bigint category_id FK
        date incurred_on
        numeric amount
        text description
        text status
        uuid created_by FK
        uuid voided_by FK
        timestamptz voided_at
        timestamptz created_at
        timestamptz updated_at
    }

    AUTH_USERS ||--|| PROFILES : posee
    ROLES ||--o{ PROFILES : asignado_a

    PROFILES ||--o{ PRODUCTS : crea
    PROFILES ||--o{ COST_SETTINGS : configura
    PROFILES ||--o{ COST_ESTIMATES : calcula
    PROFILES ||--o{ SALES : registra
    PROFILES ||--o{ SALE_RETURNS : registra
    PROFILES ||--o{ STOCK_MOVEMENTS : registra
    PROFILES ||--o{ EXPENSES : registra

    PRODUCT_CATEGORIES ||--o{ PRODUCTS : clasifica

    PRODUCTS ||--o{ COST_ESTIMATES : posee
    COST_SETTINGS o|--o{ COST_ESTIMATES : proporciona

    SALES ||--|{ SALE_ITEMS : contiene
    PRODUCTS ||--o{ SALE_ITEMS : vendido_como
    COST_ESTIMATES o|--o{ SALE_ITEMS : costo_seleccionado

    SALES ||--o{ SALE_RETURNS : recibe
    SALE_RETURNS ||--|{ SALE_RETURN_ITEMS : contiene
    SALE_ITEMS ||--o{ SALE_RETURN_ITEMS : devuelve

    PRODUCTS ||--o{ STOCK_MOVEMENTS : afecta
    SALE_ITEMS ||--o{ STOCK_MOVEMENTS : origina
    SALE_RETURN_ITEMS ||--|| STOCK_MOVEMENTS : origina

    EXPENSE_CATEGORIES ||--o{ EXPENSES : clasifica
```
