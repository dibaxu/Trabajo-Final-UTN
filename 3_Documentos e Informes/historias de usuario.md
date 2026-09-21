# Historias de Usuario

| Historia | Prioridad |
|---|---:|
| HU01 Iniciar sesión | Alta |
| HU02 Gestionar productos | Alta |
| HU03 Estimar costos | Alta |
| HU04 Registrar producción | Alta |
| HU05 Consultar stock | Alta |
| HU06 Ajustar stock | Baja |
| HU07 Registrar venta | Alta |
| HU08 Registrar gastos | Alta |
| HU09 Consultar dashboard | Alta |
| HU10 Anular venta | Alta |
| HU11 Registrar devolución | Normal |
| HU12 Seleccionar costo de venta | Alta |
| HU13 Administrar parámetros de costos | Normal |
| HU14 Consultar movimientos de stock | Baja |
| HU15 Gestionar usuarios y roles | Baja |

### HU01 Iniciar sesión

Como integrante del emprendimiento, quiero iniciar sesión para acceder a la información administrativa.

Criterios:
- Dado un usuario activo con credenciales válidas, cuando inicia sesión, accede al sistema.
- El sistema identifica su rol: administrador u operador.
- Con credenciales incorrectas se muestra un mensaje genérico, sin indicar qué dato falló.
- Un usuario deshabilitado no puede ingresar.
- Un usuario no autenticado que intenta acceder a una pantalla privada es redirigido al login.
- Al cerrar sesión, el token local se elimina y las pantallas privadas dejan de estar disponibles.
- La sesión puede recuperarse al recargar la página mientras el token siga vigente.

### HU02 Gestionar productos

Como usuario autorizado, quiero administrar productos para mantener actualizado el catálogo.

Criterios:
- Se puede crear un producto con nombre, categoría y estado activo.
- El nombre es obligatorio.
- El producto puede incluir descripción, código interno, imagen y costo estimado.
- Los valores de peso, costo y precio no pueden ser negativos.
- El código interno, si se utiliza, debe ser único dentro del emprendimiento.
- Se puede consultar y filtrar el catálogo por nombre, categoría y estado.
- Se pueden modificar los datos de un producto existente.
- Un producto relacionado con ventas no se elimina físicamente; se desactiva.
- Los productos inactivos no pueden utilizarse en nuevas ventas ni producciones.
- La modificación del costo actual no altera ventas anteriores.

### HU03 Estimar el costo de un producto

Como operador, quiero calcular el costo de fabricación para definir un precio de venta conveniente.

Criterios:
- El formulario permite ingresar:
  - peso de la pieza;
  - precio del filamento por kilogramo;
  - horas y minutos de impresión;
  - consumo eléctrico;
  - costo del kWh;
  - desgaste por hora;
  - horas de trabajo manual;
  - valor de la hora de trabajo;
  - costos extras.
- Los minutos deben estar entre 0 y 59.
- Ningún valor numérico puede ser negativo.
- El tiempo total se calcula como horas + minutos / 60.
- Electricidad y desgaste utilizan el tiempo total, no solamente las horas enteras.
- El costo total muestra por separado material, electricidad, desgaste, mano de obra y extras.
- El sistema muestra precios sugeridos según márgenes o multiplicadores definidos.
- El resultado utiliza una regla de redondeo uniforme.
- El usuario puede guardar la estimación vinculada con un producto.
- La estimación conserva los parámetros utilizados y la fecha de cálculo.
- Una nueva estimación no sobrescribe el historial anterior.

### HU04 Registrar producción

Como operador, quiero registrar unidades producidas para actualizar las existencias disponibles.

Criterios:
- Solo se puede registrar producción para un producto activo.
- La cantidad producida debe ser un número entero mayor que cero.
- Al confirmar, se crea un movimiento de stock de tipo PRODUCCION.
- El movimiento incrementa el stock exactamente en la cantidad indicada.
- Se registra fecha, usuario, producto, cantidad y observación opcional.
- La operación no modifica directamente un campo de stock sin dejar movimiento.
- Si la operación falla, no se debe modificar el stock.
- Al finalizar, se muestra la existencia resultante.

### HU05 Consultar stock

Como usuario, quiero consultar las existencias actuales para conocer qué productos están disponibles.

Criterios:
- Se muestra cada producto activo con su cantidad disponible.
- Se puede buscar por nombre o código.
- Se puede filtrar por categoría.
- El stock mostrado coincide con la suma de sus movimientos.
- Los productos sin movimientos muestran stock cero.
- El sistema diferencia productos disponibles y sin stock.
- La consulta se actualiza después de una producción, venta o ajuste.
- El operador no puede modificar la cantidad directamente desde esta pantalla.

### HU06 Ajustar stock

Como administrador, quiero ajustar el inventario para corregir diferencias entre el sistema y el stock físico.

Criterios:
- Solo un administrador puede realizar ajustes.
- Debe seleccionarse un producto activo.
- La cantidad del ajuste debe ser distinta de cero.
- El usuario indica si el ajuste incrementa o reduce existencias.
- Es obligatorio ingresar un motivo.
- No se permite que el resultado genere stock negativo.
- Se crea un movimiento AJUSTE_POSITIVO o AJUSTE_NEGATIVO.
- Se registra el usuario responsable, fecha, cantidad y motivo.
- Los movimientos anteriores no se modifican ni eliminan.
- El sistema muestra el stock anterior y el stock resultante antes de confirmar.

### HU07 Registrar una venta

Como operador, quiero registrar una venta para descontar stock y calcular el margen obtenido.

Criterios:
- La venta debe contener al menos un producto.
- Cada detalle contiene producto, cantidad y precio unitario.
- La cantidad debe ser un entero mayor que cero.
- No se pueden vender productos inactivos.
- No se puede vender una cantidad superior al stock disponible.
- Un mismo producto no debe aparecer duplicado; si se selecciona nuevamente, se acumula la cantidad.
- Se debe indicar si es venta mayorista o minorista.
- Se calcula el subtotal de cada detalle y el total de la venta.
- Se guarda el costo unitario vigente como dato histórico.
- Se calcula el margen bruto:
margenDetalle =
cantidad × (precioUnitarioVenta - costoUnitarioHistorico)
- Al confirmar se crean:
  - la venta;
  - sus detalles;
  - los movimientos de salida de stock.
- Toda la operación es atómica: si falla una parte, no se guarda nada.
- La venta queda asociada con fecha y usuario.
- El stock se actualiza inmediatamente.
- Dos ventas simultáneas no pueden consumir las mismas últimas unidades.

### HU08 Registrar gastos

Como administrador, quiero registrar gastos para calcular el resultado económico del período.

Criterios:
- Se puede registrar fecha, categoría, importe y descripción.
- El importe debe ser mayor que cero.
- La categoría es obligatoria.
- Se puede distinguir entre insumos, servicios, transporte, feria y otros.
- El usuario puede consultar gastos por período y categoría.
- Se registra quién creó el gasto y cuándo.
- Un gasto puede modificarse mientras no pertenezca a un período cerrado, si implementan cierres.
- La eliminación debe restringirse a administradores o reemplazarse por anulación.
- Los gastos operativos no se suman nuevamente al costo de un producto si ya fueron incluidos en su estimación.

### HU09 Consultar dashboard y resultados

Como administrador, quiero consultar indicadores por período para conocer el resultado del emprendimiento.

Criterios:
- El período predeterminado es el mes actual.
- Se permite seleccionar fecha desde y fecha hasta.
- Se muestran como mínimo:
  - ingresos por ventas;
  - tipo de venta (mayorista / minorista)
  - costo de productos vendidos;
  - margen bruto;
  - gastos operativos;
  - resultado neto;
  - cantidad de unidades vendidas.
- Los cálculos utilizan ventas confirmadas, no anuladas.
- El resultado neto se calcula así: resultadoNeto = ingresos - costoProductosVendidos - gastosOperativos
- Los resultados cambian al modificar el período.
- Si no existen operaciones, se muestran valores cero.
- Los totales coinciden con las ventas y gastos consultables para el mismo período.
- La zona horaria y los límites de fecha se aplican uniformemente.
- Operadores pueden acceder solamente si se decide habilitar ese permiso.


### HU10 Anular una venta

Como administrador
Quiero anular una venta confirmada
Para corregir una operación errónea y restituir el stock.

Criterios:
- Solo puede anularse una venta confirmada.
- Una venta no puede anularse más de una vez.
- El motivo de anulación es obligatorio.
- La anulación registra usuario, fecha y motivo.
- Se crean movimientos positivos por todas las unidades vendidas.
- La venta y sus detalles originales no se eliminan.
- La venta anulada se excluye de ingresos, costos y margen.
- Toda la operación es atómica.
- Recomiendo impedir la anulación si existen devoluciones previas.

### HU11 Registrar una devolución

Como administrador
Quiero registrar una devolución vinculada con una venta
Para restituir productos al stock y mantener resultados correctos.

Criterios:
- Debe seleccionarse una venta existente y no anulada.
- La devolución contiene al menos un producto.
- Solo pueden devolverse productos incluidos en la venta.
- La cantidad debe ser mayor que cero.
- No puede superar la cantidad vendida menos devoluciones anteriores.
- Cada detalle referencia al detalle original.
- Se crea un movimiento positivo de stock.
- Una devolución parcial cambia la venta a PARCIALMENTE_DEVUELTA.
- Una devolución total cambia la venta a DEVUELTA.
- La devolución registra fecha, motivo y usuario.
- Toda la operación es atómica.

### HU12 Seleccionar el costo aplicado a una venta

Como administrador
Quiero seleccionar una estimación o ingresar un costo manual
Para calcular el margen con el costo que corresponda.

Criterios:
- Cada detalle debe tener un costo unitario.
- El usuario puede elegir una estimación del producto.
- También puede ingresar un costo manual.
- Si selecciona una estimación, esta debe pertenecer al producto vendido.
- El costo no puede ser negativo.
- El origen queda registrado como ESTIMACION o MANUAL.
- El costo queda guardado en el detalle y no cambia posteriormente.
- El margen se recalcula al cambiar el costo antes de confirmar.
- Una venta confirmada no permite modificar el costo.

### HU13 Administrar parámetros de costos

Como administrador
Quiero configurar los valores utilizados en el cálculo
Para evitar ingresarlos manualmente en cada estimación.

Criterios:
- Se pueden registrar precio del filamento, electricidad, desgaste y mano de obra.
- Los valores no pueden ser negativos.
- Cada configuración tiene fecha de vigencia.
- Una configuración nueva no elimina las anteriores.
- El simulador carga inicialmente los valores vigentes.
- El usuario puede modificar los valores para una estimación particular.
- Una modificación particular no cambia la configuración general.
- Las estimaciones históricas conservan los valores utilizados.

### HU14 Consultar historial de movimientos de stock
Como administrador
Quiero consultar los movimientos de un producto
Para comprender cómo se obtuvo su stock actual.

Criterios:
- Se muestran fecha, tipo, cantidad, usuario y motivo.
- Se puede filtrar por producto, tipo y período.
- Las entradas se diferencian de las salidas.
- Los movimientos de venta permiten identificar la venta relacionada.
- Los movimientos de devolución identifican la devolución relacionada.
- Los movimientos no pueden modificarse ni eliminarse.
- La suma de los movimientos coincide con el stock mostrado.

### HU15 Gestionar usuarios y roles

Como administrador
Quiero consultar usuarios y asignarles un rol
Para preparar el sistema para diferentes niveles de acceso.

Criterios del MVP:
- Todo usuario posee un rol obligatorio.
- Inicialmente solo existe ADMINISTRADOR.
- El sistema muestra el rol del usuario autenticado.
- Un usuario no puede modificar su propio rol directamente.
- Los usuarios deshabilitados no pueden acceder.
- No se puede deshabilitar al último administrador activo.
