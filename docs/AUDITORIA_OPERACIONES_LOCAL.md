# Auditoría de operaciones — implementación local

Fecha: 9 de octubre de 2026. Rama de trabajo: `gv-fix`, sobre `0903007`.

## Estado y acceso

Implementado en la copia local. No desplegado, sin push y sin cambios en producción.
La nueva pantalla **Auditoría y errores** es exclusiva del rol `ADMINISTRADOR`:

- El menú, el módulo renderizado y la navegación por `#auditoria` verifican el rol.
- `GET /api/admin/auditoria` y `GET /api/admin/auditoria/issues` verifican sesión vigente y rol en el backend.
- Sin sesión: 401. Otros roles administrativos: 403. Ocultar el menú no es la protección principal.
- Los conductores y supervisores pueden subir sus diagnósticos autenticados, pero eso no les permite consultar la bitácora.

## Qué se registra

Se reutiliza `bitacora_auditoria`. Cada solicitud tiene un `request_id`; cada evento un `event_id` distinto.
Un encabezado `X-Request-Id` válido permite relacionar el error visto en el dispositivo con la operación del servidor.
Un identificador inválido se reemplaza. Es un dato de correlación, no una credencial ni una prueba de identidad.

| Área | Eventos instrumentados |
| --- | --- |
| HTTP | Resultado, duración, ruta sin parámetros de consulta, identidad autenticada y desconexión antes de responder (499). Se excluyen health y la subida de diagnósticos para evitar recursión. |
| Viajes | Crear, iniciar, finalizar, cancelar, caducar pendientes; resultado de transacciones. |
| Inspecciones y gerenciamiento | Guardar, verificar requisito/aprobación, crear y aprobar. |
| Asignaciones | Resolución del uso de unidad y cambios desde administración. |
| GPS | Primera ubicación, punto, lote, duplicados y errores; no se copian coordenadas a esta auditoría. |
| Offline | Sincronización del viaje; errores de persistencia local y de envío GPS. |
| Acceso y administración | Autenticación por PIN, registro de conductor, operaciones Microsoft, cambios de conductores y vehículos. |
| Integraciones | Errores capturados de Telegram, SharePoint y procesamiento de recordatorios. Añadir estos logs no envía mensajes adicionales. |
| Navegador del conductor/supervisor | Errores de API, JavaScript, promesas, renderizado, IndexedDB/localStorage, captura GPS y consulta de versión. |

Los pasos instrumentados registran `INICIADO`, `COMPLETADO`, `RECHAZADO` o `ERROR`, duración y los identificadores disponibles.
Se registran `COMMIT` y `ROLLBACK` donde el servicio ejecuta explícitamente la transacción. **COMPLETADO significa que terminó la función; no implica que una transacción externa haya confirmado.**

La instrumentación es de operaciones seleccionadas, no de cada función del repositorio. El panel web administrativo recibe la auditoría HTTP del servidor; sus errores JavaScript locales no se envían mediante la cola del frontend del conductor.

## Lectura del panel

Filtros por folio exacto, ID de conductor autenticado, nivel, fechas y operación. Paginación de 30 eventos.
Las fechas se muestran en Ciudad de México. El filtro de conductor no equivale al conductor afectado por una acción administrativa: el actor de esa acción es el administrador.

**Ver operación** reúne los eventos con el mismo `request_id`, ordenados del más reciente al más antiguo.
La sección superior agrupa errores de las últimas 24 horas por paso y código; su contador representa eventos, no incidentes únicos. Una excepción propagada por varias funciones puede generar varios eventos.
El resumen de 24 horas es global y no depende de los filtros inferiores.

El envío a Telegram por temas ya está implementado, pero permanece desactivado sin configuración explícita. El panel muestra si el backend lo tiene habilitado; ese indicador no garantiza entrega ni confirma que el monitor independiente esté funcionando. Ver [configuración de supergrupo y servicios](TELEGRAM_AUDITORIA_Y_SERVICIOS.md). No se agregaron avisos invasivos al conductor.

## Datos y tolerancia a fallas

- No se añaden cuerpos completos de solicitudes, PIN, contraseñas, cookies, tokens, firmas, imágenes, PDFs, coordenadas, mensajes de excepción ni `error.detail` de PostgreSQL a los nuevos eventos.
- Los errores se representan con código y metadatos técnicos permitidos (restricción, tabla, rutina y nombre). Los campos sensibles se redactan antes de persistir y antes de emitir el evento estructurado.
- La metadata HTTP conserva la identidad, IP y agente de usuario que ya manejaba la bitácora. Por eso su consulta está restringida.
- Cada evento del backend se emite como JSON a stdout y se intenta guardar mediante una cola de hasta 200 elementos, más uno en curso. La función de negocio no espera esa escritura.
- Si la BD falla o la cola se llena, queda evidencia en stdout; el fallo no cambia el resultado de negocio. Los eventos no persistidos no se recuperan automáticamente en la tabla. La retención y rotación de stdout dependen del entorno donde se ejecute Node/Docker; no se ha configurado un recolector externo.
- La retención de BD existente continúa en 180 días, configurable mediante `AUDIT_RETENTION_DAYS` en el proceso del backend. El planificador existente ejecuta la limpieza.
- El frontend conserva hasta 100 diagnósticos, con antigüedad máxima de 7 días, en la clave separada `gv_diagnostics_v1`. Se agrupan ráfagas iguales de 30 segundos.
- Se envían lotes de 10; se borran únicamente IDs confirmados por el servidor. Hay una sola subida en curso y espera creciente ante fallos, hasta 5 minutos. Se reintenta al recuperar internet y mediante revisión cada 30 segundos.
- Una cola restaurada descarta registros inválidos/caducados y elimina propiedades no permitidas. Si localStorage está lleno, la cola de diagnósticos continúa en memoria; eso no garantiza sobrevivir a un cierre del navegador.
- Los datos y colas reales de viajes/GPS no se borran ni se mezclan con la cola de diagnóstico.
- La API limita diagnósticos a 10 eventos/16 KB por lote y 6 lotes por minuto por remitente y proceso. Es un límite en memoria, no global entre réplicas.
- Los reportes del dispositivo se marcan `CLIENTE_NO_VERIFICADO`. Se registra quién los envió, sin afirmar que esa persona causó un error guardado antes de su sesión.

## Base de datos y configuración

La migración `038_auditoria_eventos.sql`, incluida en `database/scripts/migrate.sql`, añade:

`event_id`, `paso`, `resultado`, `version_app`, `id_viaje` y `codigo_error`, con índices de consulta.

Reemplaza la unicidad de `request_id` por unicidad de `event_id`; así una operación puede contener varios pasos y el reenvío de un mismo evento no lo duplica. Conserva las filas históricas. Se verificó aplicarla dos veces.

Para ejecutar esta versión contra una BD local existente, aplicar primero la migración 038 (y sus predecesoras); después iniciar el código nuevo. **No se ha aplicado ninguna migración a una BD real durante estas pruebas.**

`APP_VERSION` identifica la versión del backend; si no se configura dice `local`. El frontend usa la versión generada por Vite.
`AUDIT_STDOUT=false` silencia los nuevos eventos estructurados y `AUDIT_PERSISTENCE=false` desactiva la persistencia de la cola de operaciones; son interruptores para pruebas, no controles de autorización ni un apagado global de la recepción de diagnósticos.

## Pruebas aisladas y reproducción

En `backend`, ejecutar:

```powershell
npm run test:isolated
npm run verify:imports
```

`test:isolated` carga las migraciones en **PGlite en memoria**, reemplaza el acceso del pool, usa claves ficticias y elimina tokens de bots del entorno del proceso de prueba. No carga `.env`, no importa el servidor de producción y no necesita el servicio Docker ni credenciales reales. Cada proceso destruye su BD al terminar.

La dependencia PGlite es únicamente de desarrollo. El adaptador serializa conexiones: valida SQL y transacciones de las pruebas, pero **no sustituye una prueba de carga o bloqueos concurrentes en PostgreSQL real**.

En `frontend`: `npm test` y `npm run build`. En `panel-admin`: `npm run build` y `npm run lint`.

Cobertura comprobada:

- Regresiones existentes de inspecciones, asignaciones, viajes, registro/PIN, primera ubicación y sincronización.
- Migración repetible, conservación del histórico, correlación de pasos y errores originales.
- Cola saturada, BD caída, protección de datos y clasificación de rechazo frente a falla inesperada.
- Diagnósticos repetidos, validación, límites y permisos reales HTTP (401/403/200).
- Persistencia/reintento tras recarga, almacenamiento lleno, confirmación parcial, descarte de diagnósticos caducados y protección contra envíos simultáneos.
- Navegador con datos ficticios: administrador abre auditoría y filtra por folio/operación; supervisor que entra por `#auditoria` vuelve al inicio y no ve la opción en el menú.

Resultados: 42 pruebas existentes de backend + 6 específicas de auditoría; 24 pruebas de frontend. Compilaciones correctas, verificación de imports correcta y lint del panel sin advertencias. No se presenta un porcentaje de cobertura de líneas porque no se midió.

El equipo ejecutó las pruebas con Node 24.15. El backend declara Node 20–22; antes de un despliegue corresponde repetirlas con la versión de Node del servidor y PostgreSQL aislado de la misma versión de producción.

## Corrección adicional encontrada

Las pruebas detectaron que `registerTelegramDriver` enviaba el segundo parámetro de un UPDATE pero no lo usaba en SQL, provocando `42P18`. Se restituyó `telefono = $2`, manteniendo los parámetros existentes. La prueba del flujo de registro/PIN pasó con esta corrección local.

Se retiraron del Dashboard el componente de aviso “próximamente” sin módulos pendientes y una variable sin uso. La instrumentación nueva está conectada a las llamadas existentes.

## Límites pendientes de validación fuera de esta entrega

No se validaron permisos reales de Microsoft/SharePoint, entrega de Telegram, GPS físico con Android suspendido ni carga sostenida de producción. No se enviaron mensajes de Telegram. Los `console.error` históricos ajenos a los eventos nuevos no han recibido una revisión global de redacción. No se garantiza capturar fallos anteriores a la carga de JavaScript, cierres del proceso o suspensión completa del navegador.
