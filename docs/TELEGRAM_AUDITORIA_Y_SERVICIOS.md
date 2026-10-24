# Auditoría por temas y alertas de servicios

Implementación local, 9 de octubre de 2026. No desplegada ni activada. No se enviaron mensajes reales durante las pruebas.

## Organización del supergrupo

| Tema | Contenido | Comportamiento |
| --- | --- | --- |
| Generales | Eventos INFO de la aplicación (incluyendo actividad GPS) | Resumen con cantidad de eventos cada 5 minutos si hubo actividad; sin sonido. El detalle sigue en la bitácora. |
| Advertencias | WARN: rechazos de validación, conflictos, solicitudes denegadas | Primer aviso en el siguiente turno de envío; repeticiones agrupadas durante 5 minutos. |
| Errores | ERROR: fallos de funciones, SQL, integraciones y reportes de dispositivos | Primer aviso en el siguiente turno; repeticiones agrupadas durante 5 minutos. |
| Críticos / servicios | Fallo al escribir auditoría, servicio no disponible, recuperación, caída prolongada | Prioridad sobre los demás temas. Confirmación de caída y recuperación mediante monitor independiente. |

Una operación puede producir eventos en varios pasos; sus alertas pueden ser distintas. Agrupar no significa deduplicar incidentes: se agrupa por nivel, paso, código y resultado. Cada aviso incluye un identificador de operación de muestra. Los eventos INFO se resumen globalmente; Telegram no es una copia fila por fila de la BD.

Los mensajes contienen ambiente, paso, resultado, código, cantidad, horario de CDMX y el ID de viaje/operación cuando existe. No incluyen cuerpos, nombres, correos, PIN, tokens, coordenadas ni texto libre de las excepciones. Los errores recibidos de dispositivos se marcan como no verificados.

El panel sigue restringido a `ADMINISTRADOR`. Los permisos de un grupo Telegram son independientes: el propietario debe limitar ese supergrupo a los administradores que puedan consultar estos avisos. El código no administra miembros ni cambia permisos de Telegram.

## Configuración explícita

En el archivo privado `.env` del backend, configurar las variables de `.env.example`:

```dotenv
AUDIT_TELEGRAM_ENABLED=false
AUDIT_TELEGRAM_BOT_TOKEN=
AUDIT_TELEGRAM_CHAT_ID=
AUDIT_TELEGRAM_TOPIC_GENERAL=0
AUDIT_TELEGRAM_TOPIC_WARN=
AUDIT_TELEGRAM_TOPIC_ERROR=
AUDIT_TELEGRAM_TOPIC_CRITICAL=
AUDIT_ENVIRONMENT=produccion
```

Crear el supergrupo con temas, agregar un bot autorizado para enviar allí y obtener el `chat_id` y los `message_thread_id` de los temas. Es recomendable un bot dedicado. No se usa automáticamente el token ni el grupo operativo existente; no se ejecuta `getUpdates` con el bot de auditoría.

`GENERAL=0` envía al tema General nativo omitiendo `message_thread_id`. También puede ser un ID positivo si se crea otro tema para generales. Los otros tres temas deben tener IDs positivos distintos. Los cuatro destinos deben diferir. No se crean, reabren ni eliminan temas automáticamente; si un tema no admite envíos se registra el fallo y se reintenta, sin redirigir a otro grupo.

Después de completar los valores, cambiar `AUDIT_TELEGRAM_ENABLED=true` y reiniciar el backend habilita el envío. Un token/formato/destino incompleto deshabilita esta integración con un mensaje de configuración en stdout, sin impedir que arranque la aplicación. La validación sintáctica no confirma permisos ni existencia del tema.

La API utilizada es `sendMessage` con `chat_id` y `message_thread_id`, según la [documentación oficial de Telegram](https://core.telegram.org/bots/api#sendmessage).

## Caída y recuperación de servicios

El script `backend/src/scripts/monitor-services.js` es un proceso separado. No importa `app.js`, no necesita PostgreSQL y no arranca bots operativos. Un backend detenido no puede avisar por sí mismo.

El ejemplo monitorea:

- Backend mediante `/health`.
- PostgreSQL mediante el resultado de esa comprobación de salud.
- PWA mediante su respuesta HTTP.
- Panel mediante su respuesta HTTP.

Se admiten hasta 10 destinos HTTP configurados. Para frontend/panel se mide disponibilidad HTTP, no funcionamiento completo de JavaScript o inicio de sesión. Una caída de Telegram/Microsoft/SharePoint no se prueba de manera activa con credenciales: las operaciones instrumentadas reportan los errores que reciban al utilizarlos.

Cada comprobación tiene timeout de 8 segundos. Se inicia otro ciclo 30 segundos después de terminar el anterior. Tres fallos consecutivos confirman indisponibilidad (habitualmente alrededor de 1–2 minutos). Dos respuestas correctas confirman recuperación. Un fallo aislado no dispara caída; no se manda “recuperado” por el primer arranque saludable.

Si backend responde con su JSON de salud y `database.connected=false`, se alerta de PostgreSQL. Si no responde o el cuerpo no corresponde al endpoint esperado, se alerta del backend y el estado de BD queda **desconocido**: no se inventa su caída o recuperación. Un servicio que permanece caído genera un recordatorio cada 6 horas.

Estas alertas indican **indisponibilidad observada desde el monitor**; una falla de DNS, red o proxy puede producir ese síntoma sin que el proceso destino se haya detenido.

### Ejecución en proceso independiente

Copiar `.env.monitor.example` a un `.env.monitor` privado. Tiene ambos interruptores desactivados. Completar Telegram y URLs antes de activar:

```dotenv
SERVICE_MONITOR_ENABLED=true
AUDIT_TELEGRAM_ENABLED=true
MONITOR_STATE_FILE=./monitor-state/state.json
```

Desde `backend`, usando Node 22:

```powershell
node --env-file=../.env.monitor src/scripts/monitor-services.js
```

El script no carga `.env` automáticamente. También existe `npm run monitor:services` cuando el entorno ya está inyectado. El estado local se conserva en `MONITOR_STATE_FILE`; usar una ruta escribible y mantener una sola instancia por archivo. El directorio `monitor-state/` y `.env.monitor` están excluidos de Git.

### Ejecución con Docker

`compose.monitor.yml` prepara un contenedor independiente, sin `depends_on` del backend o de PostgreSQL, con volumen propio para el estado y rotación de stdout. El nombre de la red interna es configurable con `MONITOR_DOCKER_NETWORK`.

El archivo requiere `.env.monitor` y una red existente. No se ejecutó en esta entrega. Para una instalación futura sobre el mismo host, el comando es:

```sh
docker compose -f compose.monitor.yml up -d --build
```

**Para avisar si se cae el servidor completo, ejecutar el monitor en otra máquina o infraestructura.** En esa instalación usar URLs HTTPS públicas y retirar del compose la red externa interna, utilizando la red predeterminada del monitor. En el mismo host solo protege contra caídas de procesos/contenedores, no contra la pérdida de energía, red, Docker o del host completo. El monitor también necesita supervisión/reinicio propio.

## Entrega, reintentos y límites

El backend publica a Telegram de forma no bloqueante y antes del intento de persistencia de auditoría. Una BD caída puede avisarse sin depender de escribir en esa misma BD. Una falla al enviar Telegram solo genera un diagnóstico fijo en stdout; no se reinyecta como otra alerta, evitando bucles.

La cola de aplicación conserva hasta 500 grupos y prioriza los graves, pudiendo descartar un grupo menos grave al llenarse. Agrupa duplicados y respeta 6.5 segundos entre envíos del proceso, con reintento por falla y `retry_after` si Telegram indica límite. La configuración supone un backend emisor y un monitor: más réplicas requieren un emisor central para coordinar límites y duplicados.

La cola del backend es **en memoria**: un reinicio puede perder avisos pendientes de envío, aunque los eventos persistidos continúan en la bitácora. No hay replay automático del histórico a Telegram. Saturación o pérdida de red no bloquean viajes/GPS.

El monitor guarda estados y avisos pendientes en un archivo antes de enviar, mediante escritura temporal y rename. Al reiniciarse recupera pendientes, hasta 1000 transiciones; si se llena, descarta la más antigua y lo informa en stdout. Si no puede escribir su estado, conserva en memoria y no envía hasta poder persistirlo. Necesita un volumen duradero.

La entrega no es exactamente una vez: si Telegram acepta y la confirmación se pierde, un reintento puede duplicar un aviso. Si Telegram o la conexión saliente fallan, no es posible notificar por ese mismo canal hasta recuperarse. Los avisos conservan la hora de la transición original, incluso si se entregan después.

## Verificación local

Pruebas específicas: `node --test src/tests/telegram-alerts.test.js src/tests/service-monitor.test.js` desde backend. Usan transportes simulados, tiempos controlados y destinos ficticios; nunca llaman Telegram real.

14 casos verifican configuración desactivada/incompleta, temas y General nativo, ausencia de datos sensibles, resumen de INFO, prioridad, duplicados, saturación, reintentos 429, eventos que llegan durante el envío, validación de URLs, diferenciación backend/BD, caída/recuperación, restauración de pendientes, recordatorio prolongado, disco fallando y comprobaciones superpuestas.

También se ejecuta la suite aislada del backend (PGlite en memoria), verificación de imports y compilación/lint del panel. No se requiere migración adicional de BD para Telegram o el monitor; sigue siendo necesaria la 038 para la auditoría local del cambio anterior.

Pendiente antes de activar: configurar destinos reales, comprobar permisos del bot y decidir el host del monitor. No se han validado una entrega real, Docker en ejecución ni una caída real del servidor.
