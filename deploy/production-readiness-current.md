# Preparación vigente — 14 de noviembre de 2026

**PREPARADO, SIN AUTORIZACIÓN DE LANZAMIENTO.** No fusionar main, desplegar ni publicar APK hasta indicación del usuario. Este documento sustituye los pendientes de las revisiones históricas.

## Preparado y verificado

- Se utiliza el ambiente de pruebas existente `gvmobility`, https://gvmobility.aspromex.mx. Backend, frontend, panel y PostgreSQL observados saludables. No se creó otro ambiente en esta preparación. El usuario confirmó allí la corrección del aviso de rechazo.
- Tres imágenes nuevas desde `a43a28413577b3f0605f9e4c776a95a53fd89d5b`: [build privado correcto](https://github.com/TobyGarcia/botGerenViaje-1.2.0/actions/runs/43632610850), incluyendo pruebas de backend, frontend y panel. Construcción limpia desde node/nginx, sin reutilizar imágenes de staging.
- Linux/amd64, compatible con servidor x86_64. Archivo de imágenes de 139508302 bytes, inventario, etiquetas, revisión OCI y checksums verificados. Copia local ignorada por Git: `output/releases/a43a28413577b3f0605f9e4c776a95a53fd89d5b/`, con código, manifiesto e imágenes.
- APK conductor privada **1.3.0 (51)**, firma compatible y API/GPS productivos: [evidencia](driver-production-candidate.md).
- APK aprobadores privada **1.0.0 (1)**, paquete/API/Firebase productivos: [evidencia](approver-production-candidate.md). Cada APK conserva su SHA propio; los cambios posteriores corresponden a preparación del servidor y construcción de imágenes.
- Archivo de imágenes y configuración inactiva en `/home/mblanquet/.gv-production-ready/a43a28413577b3f0605f9e4c776a95a53fd89d5b/`. No se cargaron imágenes en Docker ni se iniciaron contenedores candidatos.
- `compose.candidate.json`: imágenes fijadas por ID, conexión y secretos actuales conservados, solo tres servicios de aplicación. Sin PostgreSQL ni montaje de su volumen. Adjuntos en el volumen externo actual.
- Credencial Firebase productiva protegida en ese directorio privado (archivo 0600/directorios 0700); montaje futuro de solo lectura. No está montada en servicios activos, en Git ni en las APK. Push productivo no activado.
- Arranque controlado con migraciones automáticas, tareas de fondo, polling Telegram, push y retención desactivados. `compose.activate.json` preparado, sin aplicar: activa únicamente tareas de fondo, polling y push tras validar el corte. Migraciones y borrado por retención permanecen desactivados.
- `compose.rollback.json` preparado con imágenes/configuración originales; sin restaurar base ni borrar escrituras. Configuraciones renderizadas y checksums verificados, sin aplicar.

Las comprobaciones de solo lectura confirman imágenes, fechas de inicio, entorno y montajes productivos sin cambios. Los montajes se comparan por destino porque Docker puede devolverlos en distinto orden. No se ejecutó SQL productivo ni se modificaron servicios activos durante esta preparación.

La validación funcional utiliza pruebas existentes y sus evidencias. El ensayo previo de restauración/migraciones está en el plan histórico: 042–048 aplicadas dos veces y contenido de 26 tablas originales conservado. No se repitió ese clon ni se copiaron datos productivos a staging.

## Git y automatización

- Trabajo en `gv-fix`, sin merge a main. `origin/main` revisado: `ae77b7ef4f88a417d9923bcd373366c1457c946d`. Simulación de integración del candidato sin conflictos.
- Los workflows revisados no despliegan por push/merge a main. Publicación de APK manual; candidato privado omite publicación. Build de imágenes solo guarda artefactos privados, sin SSH a AWS.
- **Antes de fusionar falta verificar webhooks/automatizaciones externas con acceso administrador.** La API de webhooks respondió 404; no permite garantizar su ausencia. Las búsquedas de cron y nombres de unidades del servidor no identificaron despliegues automáticos, pero no sustituyen esa comprobación.
- Artefactos de Actions con retención de 14 días; hay copias locales y archivo de imágenes en servidor. Revalidar hashes en el corte.

## Pendientes para el lanzamiento

1. Autorización explícita y ventana de corte; coordinar viajes en curso y teléfonos con movimientos sin sincronizar. No cancelar viajes ni borrar colas como preparación.
2. Verificar automatizaciones externas y diferencias finales antes del merge. Esta preparación no autoriza fusionar ni publicar.
3. Revalidar configuración/inventario y capacidad del servidor. Observados 5.0 GB libres: comprobar espacio suficiente para respaldo, imágenes descomprimidas y logs antes de cargar nada. Si cambian metadatos activos, revisar nuevamente; no sobrescribir con configuración desactualizada.
4. Respaldo consistente NUEVO de base, adjuntos y configuración en el corte, con pausa coordinada de escrituras, hashes, copia protegida fuera del servidor y comprobación de restauración. El ensayo anterior no lo reemplaza.
5. Aplicar explícitamente solo migraciones 042–048 con errores detenidos y espera de bloqueo limitada. Comparar contenido histórico antes de continuar. No usar init-db, seeds ni restaurar sobre producción.
6. Tras autorización, cargar imágenes y reemplazar únicamente backend, frontend y panel, conservando PostgreSQL, OSRM y volúmenes. Validar backend antes de interfaces. Activar tareas externas después de los controles y revisar eventos antiguos para evitar avisos masivos.
7. Canarios productivos autorizados: Microsoft/roles, SharePoint, PDF, rechazo compartido, aprobación conjunta, sincronización sin duplicados y push con app cerrada. Existe SHAREPOINT_URL y resolución por código aunque no estaba definido SHAREPOINT_SITE_ID: validar acceso real preservando la configuración actual.
8. Publicar APK/manifiestos estables después de validar backend/web y recibir autorización. Comprobar actualización sobre instalación existente sin desinstalar ni borrar datos.

Compilar no prueba Microsoft ni recepción push en dispositivos productivos. El rollback normal conserva base y ampliaciones aditivas. Después de distribuir clientes nuevos, comprobar compatibilidad antes de retroceder el backend; preferir corrección hacia adelante. Restaurar un respaldo sobre producción no forma parte del rollback normal.
