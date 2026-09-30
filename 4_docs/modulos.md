# Módulos del sistema

La aplicación administrativa para el emprendimiento de impresión 3D se dividirá en los siguientes módulos:

## 1. Usuarios y acceso

Permitirá iniciar y cerrar sesión mediante Supabase Auth, consultar el perfil y administrar el estado y rol de los usuarios. En el MVP todos los usuarios tendrán el rol ADMINISTRADOR; más adelante se podrán incorporar otros roles y permisos.

## 2. Gestión de productos

Permitirá crear, consultar, modificar y desactivar productos y sus categorías. Incluirá nombre, código interno, descripción, imagen y precio de referencia. Los productos con operaciones históricas se desactivarán para conservar sus registros.

## 3. Costos de producción

Permitirá configurar los precios de filamento, electricidad, desgaste y mano de obra, y estimar el costo de fabricar un producto según su peso, tiempo de impresión y gastos adicionales. Guardará el historial de estimaciones y permitirá seleccionar la vigente.

## 4. Producción y stock

Permitirá registrar unidades producidas, consultar existencias y realizar ajustes con un motivo. El stock se calculará a partir de las entradas y salidas registradas, conservando el historial de movimientos de cada producto.

## 5. Gestión de ventas

Permitirá registrar ventas mayoristas y minoristas con sus productos, cantidades, precios y costos aplicados. Calculará los totales y el margen, actualizará el stock y permitirá registrar anulaciones y devoluciones sin borrar el historial.

## 6. Gestión de gastos

Permitirá registrar y consultar gastos del emprendimiento por fecha y categoría, indicando importe, descripción y usuario responsable. También contemplará su modificación o anulación para mantener actualizada la información económica.

## 7. Reportes y dashboard

Mostrará resúmenes por período y producto, incluyendo ingresos, costos, margen bruto, gastos, resultado neto y unidades vendidas. Permitirá distinguir las ventas mayoristas de las minoristas y consultar el total general.

## Alcance del primer script de base de datos

El [script inicial](../3_database/001_inicial.sql) implementa únicamente roles, perfiles de usuario, categorías de productos y productos del [diagrama entidad-relación](diagrama-entidad-relacion.md). Las tablas de costos, stock, ventas, devoluciones y gastos se incorporarán durante el desarrollo. Este listado describe el sistema previsto, no funcionalidades ya implementadas.
