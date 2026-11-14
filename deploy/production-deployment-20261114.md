# Despliegue productivo — 14 de noviembre de 2026

Autorización del usuario: «okey desplieguemos ya de una vez en prod». Se desplegaron backend, frontend de conductor y panel desde `a43a28413577b3f0605f9e4c776a95a53fd89d5b`. No se fusionó main ni se publicaron APK o manifiestos estables durante este despliegue.

## Respaldo y datos

- Corte iniciado alrededor de las 14:02, hora de Ciudad de México. Pausa del backend para respaldar con escrituras de aplicación detenidas. PostgreSQL permaneció activo.
- Respaldo privado `/home/mblanquet/.gv-cutover-20261114T200209Z`: dump de 252022827 bytes, adjuntos, configuración y metadatos originales. Checksums correctos. Copia externa protegida en `C:/Users/Soporte TI Junior/.codex/secrets/gv-production-backups/.gv-cutover-20261114T200209Z`, verificada por SHA256. No guardar contenido de ese directorio en Git.
- Restauración verificada reutilizando exclusivamente el clon aislado anterior `gv-rehearsal-20261114t182947z-3626515`, sin red ni puertos; se volvió a detener. La base `rehearsal` del clon se recreó para evitar dependencias de las migraciones del ensayo previo. Nunca se restauró sobre la base productiva.
- Las huellas de datos se normalizaron a UTC: la representación JSON de TIMESTAMPTZ depende de la zona de la sesión; comparar sesiones de zonas distintas daba diferencias sin cambios de datos.
- Migraciones 042–048 aplicadas con parada ante errores y límite de espera de bloqueo. Cantidades y huellas de todas las columnas de las 26 tablas originales: iguales antes/después. Evidencias `before.txt`, `restored-fingerprints.txt`, `after-migrations.txt`, `migration-hashes.txt` y `migrations.log`.
- PostgreSQL conservó exactamente su contenedor, fecha de inicio y montajes. Adjuntos siguen en `viajes_backend_uploads_prod`; base en `viajes_postgres_data_prod`.

## Imágenes y arranque

El primer intento de arranque encontró que los IDs del inventario CI no eran los IDs locales del almacén Docker receptor. Compose intentó descargar una referencia sha256 y falló; la reversión automática recuperó las imágenes anteriores sin restaurar la base. Se corrigió antes de reintentar.

Se compararon todas las capas RootFS, arquitectura/SO y configuración de ejecución de cada imagen cargada contra el inventario CI: idénticas, normalizando campos vacíos/ausentes equivalentes. Se preparó `compose.loaded-images.json` con IDs locales y `pull_policy: never`.

| Servicio | ID local activo |
| --- | --- |
| backend | sha256:469c7a8f2751f14e868cec0c082241e34df3a237f37799a0afa1ec7bc242063e |
| frontend | sha256:90e0849861c69ce7cc651636408978cb83cf07028fde9e81adb3d00b3f153e68 |
| panel-admin | sha256:0ee22f9e0f9fe96843ff9b76402082c9877c88bcb1251c3b32bca5a007e837bb |

Configuración efectiva: `compose.candidate.json` + `compose.loaded-images.json` + `compose.activate.json`, proyecto `botgerenviaje-120`, en el directorio privado de preparación. Actualizar únicamente servicios de aplicación con `--no-deps`. No usar archivos del checkout antiguo para un reinicio posterior.

Arranque inicial sin trabajos externos; después de las comprobaciones se activaron tareas de fondo, polling Telegram y push estable. Permanecen desactivadas las migraciones automáticas y la eliminación por retención. Los tres servicios y PostgreSQL quedaron saludables.

## Verificación

- `/health`, `/conductor/` y panel públicos: HTTP 200; health conectado a `gerenciamiento_viajes_prod`.
- Sesiones sin autenticación: HTTP 401 esperado.
- Consulta de los tres viajes EN_CURSO correcta. Recuento observado: 414 finalizados, 51 cancelados y 3 en curso; no se cancelaron viajes manualmente durante el despliegue.
- Listas de gerenciamiento, consultas de pendientes y feeds para roles probados: correctos.
- PDF de inspección y gerenciamiento generados en memoria, buffers con firma `%PDF` válida (1115946 y 40284 bytes). Sin subir documentos de prueba ni modificar registros.
- Broker Microsoft de APK responde y genera redirección productiva; obtención de token de servicio Microsoft correcta. Esto no equivale a iniciar sesión con una persona real.
- Lectura de sitio y biblioteca documental SharePoint por Microsoft Graph: correcta. No se subieron archivos ni se modificó contenido para comprobarlo.
- Credencial Firebase del proyecto productivo validada desde montaje privado de solo lectura. No había dispositivos registrados ni movimientos pendientes de entrega al activar. No se envió una notificación de prueba.
- Sin conflicto de polling ni fallos no controlados identificados en la comprobación de arranque.

Se observó un teléfono reintentando el cierre nativo del viaje 580, que ya estaba CANCELADO y no tenía cierre nativo. Se preservó ese estado y su historial; no se forzó una finalización ni se alteró la cola del teléfono. El código de validación de ese cierre coincide con el anterior; queda como incidencia de conciliación independiente.

## Pendiente

Las APK productivas siguen privadas: conductor 1.3.0 (51) y aprobadores 1.0.0 (1). No se modificaron los actualizadores públicos. Falta comprobación en dispositivos reales de Microsoft, permisos, push y actualización sin borrar colas. La prueba completa de la APK antigua durante un corte real no se ejecutó por ausencia de dispositivo; ver el informe específico.

Main permanece sin fusionar; la revisión de automatización local no encontró despliegues automáticos, pero sigue sin acceso administrador para descartar webhooks externos. El despliegue se hizo desde las imágenes verificadas de gv-fix, sin provocar un push a main.

Rollback normal: imágenes/configuración originales de `compose.rollback.json`, conservando datos y ampliaciones del esquema. No restaurar el dump sobre producción como rollback normal: descartaría escrituras posteriores al corte.
