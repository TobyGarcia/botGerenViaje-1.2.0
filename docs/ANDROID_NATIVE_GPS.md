# GPS Android: entrega de pruebas

Esta implementación está limitada a `https://gvmobility.aspromex.mx`.
No habilitar stable/producción antes de completar las pruebas de campo.

## Responsabilidades

- `GpsTrackingService`: servicio foreground de tipo location. Recibe GPS/red
  cada 30 segundos solicitados al sistema; guarda en SQLite antes de enviar.
  No depende del temporizador JavaScript. Android puede entregar con otra frecuencia.
- `GpsDatabase`: cola privada con UUID, viaje, hora original y estado; los
  rechazados quedan para revisión, nunca se descartan como enviados.
- `GpsSync` / `GpsSyncJob`: lotes de 100, confirmaciones completas antes de borrar,
  exclusión de envíos concurrentes y reintentos con conectividad y backoff.
  Las credenciales de envío se cifran con Android Keystore. Una sesión vencida
  conserva la cola hasta renovar el acceso. No se incluyen PIN en el servicio.
  Las capturas nuevas conservan el trabajo de red ya programado: no reinician
  su espera ni el backoff. Durante el viaje, recuperar una red validada activa
  también un envío nativo, aunque la pantalla esté bloqueada. Sin internet
  se conserva la captura y se evita iniciar HTTP desde el servicio.
- `NativeGpsPlugin`: puente para la pantalla, migración desde IndexedDB y cierre
  duradero. La PWA conserva su almacenamiento y comportamiento web.
- `cierre-nativo`: endpoint autenticado; verifica propietario, fecha y kilometraje,
  serializa operaciones y conserva el resultado por UUID para reintentos.

## Instalación y actualización

El workflow construye con `ANDROID_BUNDLED=true`: pantallas empaquetadas, sin
service worker, API HTTPS mediante CapacitorHttp. El hostname del contenido
local coincide con el servidor de pruebas para conservar el origen del WebView
y acceder al localStorage/IndexedDB existente. Verificar esta migración en un
teléfono con la APK anterior antes de distribuir.

El inicio offline sigue requiriendo un acceso previo y los permisos operativos
del conductor/vehículo ya vigentes. No se omiten inspecciones ni autorizaciones.
El viaje offline nuevo se mapea al ID de servidor cuando vuelve a abrir la app
y se sincroniza el inicio; las ubicaciones permanecen en SQLite mientras tanto.

El endpoint requiere aplicar `040_android_native_gps.sql` antes de instalar la
APK. Los clientes anteriores siguen siendo compatibles.

## Actualizador dentro de la APK

Desde 1.2.6, la modal descarga por HTTPS al caché privado y muestra el progreso,
sin abrir el navegador. Sigue únicamente redirecciones HTTPS hacia los hosts de
assets de GitHub, limita tamaño/tiempo y comprueba SHA-256, paquete, versión
superior y mismos firmantes antes de abrir el instalador. Una descarga fallida
se puede reintentar; las copias incompletas no se instalan. La copia completa
se reutiliza si se cancela la instalación o falta autorizar esta fuente.

La primera instalación desde GV Mobility puede abrir los ajustes de Android
para «Permitir desde esta fuente»; al volver se pulsa «Instalar actualización».
Android solicita la confirmación final: no es una instalación silenciosa.
Actualizar sobre 1.2.5 requiere una última descarga externa para incorporar
este código nativo. No desinstalar ni borrar datos para actualizar.

Validar en teléfono: progreso, caída de internet/reintento, permiso de fuente,
cancelación del instalador y actualización real sobre una versión anterior.

## Aviso durante el viaje

Durante el viaje: folio, tiempo transcurrido, antigüedad GPS, cola y acceso a
abrir/finalizar. Finalizar abre el odómetro, nunca cierra sin confirmación.
Recordatorio a las 2 horas y como máximo una vez por hora, persistiendo el
último recordatorio. Los canales de Android pueden silenciarse por el usuario.
El aviso distingue ubicaciones por enviar de capturas rechazadas para revisión.
La escritura local se comprueba: un fallo de disco no se informa como guardado.

El cierre positivo queda en SQLite y detiene la captura aunque no haya red.
Primero se envían los GPS pendientes y después el cierre con hora original.
Los viajes locales negativos conservan el flujo de cierre offline existente.
Si se reinicia el teléfono se avisa que hay un viaje pendiente: abrir la app
permite reanudar con los permisos exigidos por Android. Una detención forzada
puede impedir servicios y avisos hasta abrir nuevamente la aplicación.

## Validación obligatoria antes de publicar

1. Actualizar sobre la APK anterior, conservar sesión y migrar GPS pendientes.
2. Iniciar un viaje de pruebas; bloquear 15 minutos y recorrer un trayecto.
3. Activar modo avión, registrar una parada y finalizar; cerrar y reabrir offline.
4. Recuperar internet; verificar GPS, parada y cierre, sin UUID duplicados.
5. Probar cancelar un viaje activo sin internet y confirmar después en servidor.
6. Retirar permisos/apagar GPS: no mostrar captura reciente inexistente.
7. Reiniciar: recibir recordatorio y reanudar al abrir la app.
8. Intentar actualizar/cerrar sesión con viaje o cola pendientes: debe bloquear.

Una compilación correcta no reemplaza estas pruebas con dispositivos reales.

El workflow ejecuta además pruebas Robolectric de persistencia tras reabrir
SQLite, confirmación por UUID, retención de rechazados, fallo de escritura,
cierre offline y programación de red sin aplazamientos por nuevas capturas.
