# Acompañantes y remolques durante el viaje

Rama de integración: `gv-fix`. Ambiente: `gvmobility.aspromex.mx`.

Durante un viaje activo, la sección Acompañantes y remolques permite agregar un acompañante por nombre, dejar cualquiera de los presentes, enganchar un remolque y desengancharlo. Los acompañantes iniciales y el remolque declarado en la inspección inicial también aparecen y pueden retirarse.

Al enganchar, el conductor puede usar la inspección existente, completar el formulario `InspeccionRemolqueModal` existente o continuar con una advertencia. La nueva inspección se conserva como evidencia inmutable del enganche en `trip_operation_items.inspection`; no reemplaza una inspección vehicular aprobada. Las observaciones no bloquean la operación.

Cada operación manual obtiene GPS actual y hora del servidor. Los elementos iniciales conservan la hora original disponible y no inventan coordenadas. Al cerrar el viaje, los elementos restantes se cierran en la misma transacción y el aviso distingue el último GPS disponible de una captura manual.

Las operaciones requieren la sesión del conductor propietario. Cada envío lleva una clave idempotente; si se pierde la respuesta, la interfaz ofrece reintentar el mismo registro. Los eventos de Telegram se guardan en la misma transacción y se reintentan cada 15 segundos con espera progresiva. El inicio y finalización conservan sus avisos existentes. Consultar o completar inspecciones no genera avisos adicionales desde este módulo.

## Despliegue en pruebas

1. Subir el commit validado a `gv-fix` y empaquetar esa revisión con `git archive`.
2. Extraer el release en un directorio nuevo dentro de `/home/mblanquet/gv-staging-plan`.
3. Conservar los archivos compose de pruebas y sus overrides activos; añadir `compose.trip-operations.staging.yml` al final, con `TRIP_OPERATIONS_SOURCE` apuntando al release y `TRIP_OPERATIONS_VERSION` al commit.
4. Construir exclusivamente backend y frontend de pruebas.
5. Ejecutar la migración 042 exclusivamente en `gerenciamiento_viajes_stg` antes de actualizar el backend. El script `migrate-trip-operations-staging.js` comprueba el nombre de base.
6. Actualizar exclusivamente backend y frontend con `--no-deps`, manteniendo PostgreSQL y panel existentes.
7. Comprobar health, autenticación, migración e interfaz publicada.

El script de migración requiere que `database/migrations/042_trip_operations.sql` esté disponible dentro de `/app/database/migrations` al ejecutar el contenedor de migración.

## Validación

`node --test src/tests/trip-operation-input.test.js src/tests/trip-operations.integration.test.js` en backend cubre validaciones, baja inicial, reintento, propiedad, inspección nueva con observaciones, desenganche, reutilización y cierre. Ejecutar también `npm run test:isolated`, las pruebas frontend y `npm run build`.

La entrega de Telegram tiene semántica de al menos una vez: un corte después de aceptar Telegram el mensaje y antes de confirmar la transacción puede provocar duplicación. Las acciones nuevas requieren conexión; el seguimiento offline existente mantiene su comportamiento.
