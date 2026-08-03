# Actualización de vehículos en Render

Esta actualización incorpora marca, modelo, póliza y vigencia del seguro, número de serie, tipo de vehículo, tipo de propiedad y control de mantenimiento.

## Orden de despliegue

1. Obtén una copia de seguridad de la base de datos de Render.
2. Conéctate a la base de datos de producción y ejecuta el script de actualización:

   ```bash
   psql "$DATABASE_URL" -f database/scripts/update-render-vehiculos.sql
   ```

3. Despliega el backend actualizado en Render.
4. Despliega el panel administrativo actualizado en Render.
5. Verifica que en **Unidades** se muestre el estado de disponibilidad y que el detalle de cada vehículo abra correctamente.
6. Completa en las unidades existentes los datos que no podían inferirse automáticamente: póliza, vencimiento de seguro, número de serie y tipo de vehículo.

## Efecto sobre los datos existentes

- La migración no borra datos.
- El valor histórico de `nombre` se conserva por compatibilidad con los viajes existentes.
- Se intenta separar el nombre actual: la primera palabra se copia a `marca` y el resto a `modelo`.
- Las unidades existentes se clasifican inicialmente como `EMPRESARIAL` y no quedan en mantenimiento.
- Las columnas de póliza, seguro, número de serie y tipo de vehículo quedan vacías en registros existentes hasta que se capturen con información real.

## Estados de disponibilidad

El panel muestra uno de los siguientes estados:

- **Disponible**: unidad activa, sin mantenimiento y sin un viaje en curso.
- **No disponible: mantenimiento**: la unidad está marcada para mantenimiento.
- **No disponible: en viaje**: existe un viaje con estado `EN_CURSO` para esa unidad.
- **Inactivo**: unidad dada de baja administrativamente.

La Mini App excluye de su catálogo las unidades en mantenimiento o con un viaje en curso y el backend rechaza la creación/inicio de viaje cuando una unidad se encuentra en mantenimiento.
