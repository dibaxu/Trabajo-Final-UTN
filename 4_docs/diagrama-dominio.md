## Interpretación principal

- Representa conceptos y comportamiento del negocio, no tablas.
- Cada usuario tiene un único rol. Inicialmente todos tendrán ADMINISTRADOR.
- Un producto representa un tipo de artículo, no una unidad física.
- La producción no necesita clase propia: es un movimiento positivo de stock.
- El stock se obtiene sumando movimientos.
- Una venta siempre contiene uno o más detalles.
- Cada venta tiene un tipo obligatorio, MAYORISTA o MINORISTA, común a todos sus detalles y conservado históricamente.
- El precio efectivo y el costo se registran individualmente en cada detalle de venta.
- El detalle conserva el costo y precio históricos.
- Una devolución siempre pertenece a una venta y referencia sus detalles.
- La anulación revierte la venta completa; una devolución puede ser parcial.
- ResumenPeriodo es un resultado calculado y no necesariamente una entidad persistida; permite desglosar ventas por tipo.
- El método para calcular precios sugeridos continúa pendiente, por lo que no se representa como regla definitiva.

```mermaid
classDiagram
direction LR

class Usuario {
  +UUID id
  +String nombre
  +String email
  +Boolean activo
  +iniciarSesion()
  +cerrarSesion()
  +tieneRol(codigo)
}

class Rol {
  +Long id
  +String codigo
  +String nombre
  +String descripcion
  +Boolean activo
}

class CategoriaProducto {
  +Long id
  +String nombre
  +Boolean activa
  +activar()
  +desactivar()
}

class Producto {
  +Long id
  +String codigo
  +String nombre
  +String descripcion
  +String imagen
  +Decimal precioReferencia
  +Boolean activo
  +activar()
  +desactivar()
  +obtenerStock()
  +obtenerEstimaciones()
}

class ConfiguracionCostos {
  +Long id
  +Decimal precioFilamentoKg
  +Decimal costoKwh
  +Decimal desgasteHora
  +Decimal valorHoraTrabajo
  +DateTime vigenteDesde
}

class EstimacionCosto {
  +Long id
  +Decimal pesoGramos
  +Integer duracionImpresionMinutos
  +Decimal consumoWatts
  +Decimal horasTrabajo
  +Decimal costosExtras
  +Decimal costoMaterial
  +Decimal costoElectricidad
  +Decimal costoDesgaste
  +Decimal costoManoObra
  +Decimal costoTotal
  +Boolean vigente
  +calcularCostoMaterial()
  +calcularCostoElectricidad()
  +calcularCostoTotal()
}

class Venta {
  +Long id
  +DateTime fecha
  +EstadoVenta estado
  +TipoVenta tipo
  +Decimal totalVenta
  +Decimal costoTotal
  +Decimal margenBruto
  +String observaciones
  +String motivoAnulacion
  +agregarDetalle()
  +calcularTotal()
  +calcularMargen()
  +confirmar()
  +anular()
}

class DetalleVenta {
  +Long id
  +Integer cantidad
  +Decimal precioUnitario
  +Decimal costoUnitario
  +OrigenCosto origenCosto
  +Decimal subtotal
  +Decimal costoSubtotal
  +Decimal margen
  +seleccionarCosto()
  +calcularSubtotal()
  +calcularMargen()
  +cantidadDevuelta()
  +cantidadPendienteDevolucion()
}

class TipoVenta {
  <<enumeration>>
  MAYORISTA
  MINORISTA
}

class EstadoVenta {
  <<enumeration>>
  CONFIRMADA
  PARCIALMENTE_DEVUELTA
  DEVUELTA
  ANULADA
}

class OrigenCosto {
  <<enumeration>>
  ESTIMACION
  MANUAL
}

class DevolucionVenta {
  +Long id
  +DateTime fecha
  +String motivo
  +agregarDetalle()
  +confirmar()
}

class DetalleDevolucion {
  +Long id
  +Integer cantidad
  +validarCantidadDisponible()
}

class MovimientoStock {
  +Long id
  +TipoMovimientoStock tipo
  +Integer cantidad
  +DateTime fecha
  +String motivo
  +esEntrada()
  +esSalida()
}

class TipoMovimientoStock {
  <<enumeration>>
  PRODUCCION
  VENTA
  AJUSTE_POSITIVO
  AJUSTE_NEGATIVO
  DEVOLUCION
  ANULACION_VENTA
}

class CategoriaGasto {
  +Long id
  +String nombre
  +Boolean activa
  +activar()
  +desactivar()
}

class Gasto {
  +Long id
  +Date fecha
  +Decimal importe
  +String descripcion
  +EstadoGasto estado
  +anular()
}

class EstadoGasto {
  <<enumeration>>
  ACTIVO
  ANULADO
}

class ResumenPeriodo {
  <<value object>>
  +Date fechaDesde
  +Date fechaHasta
  +Decimal ingresos
  +Decimal devoluciones
  +Decimal costoProductosVendidos
  +Decimal margenBruto
  +Decimal gastosOperativos
  +Decimal resultadoNeto
  +calcularResultado()
  +desglosarVentasPorTipo()
}

Rol "1" <-- "0..*" Usuario : posee

CategoriaProducto "1" -- "0..*" Producto : clasifica
Producto "1" o-- "0..*" EstimacionCosto : posee
ConfiguracionCostos "0..1" --> "0..*" EstimacionCosto : proporciona valores

Usuario "1" --> "0..*" Producto : crea
Usuario "1" --> "0..*" Venta : registra
Usuario "1" --> "0..*" Gasto : registra
Usuario "1" --> "0..*" MovimientoStock : registra

Venta "1" *-- "1..*" DetalleVenta : contiene
Venta --> EstadoVenta
Venta --> TipoVenta
DetalleVenta "*" --> "1" Producto : referencia
DetalleVenta --> OrigenCosto
DetalleVenta "0..*" --> "0..1" EstimacionCosto : usa como origen

Venta "1" --> "0..*" DevolucionVenta : recibe
DevolucionVenta "1" *-- "1..*" DetalleDevolucion : contiene
DetalleDevolucion "*" --> "1" DetalleVenta : devuelve

Producto "1" --> "0..*" MovimientoStock : afecta
DetalleVenta "1" --> "0..*" MovimientoStock : origina
DetalleDevolucion "1" --> "1" MovimientoStock : origina
MovimientoStock --> TipoMovimientoStock

CategoriaGasto "1" -- "0..*" Gasto : clasifica
Gasto --> EstadoGasto

ResumenPeriodo ..> Venta : resume
ResumenPeriodo ..> DevolucionVenta : resume
ResumenPeriodo ..> Gasto : resume
```
