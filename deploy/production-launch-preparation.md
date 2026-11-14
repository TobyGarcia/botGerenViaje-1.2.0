# Preparación de lanzamiento — 14 de noviembre de 2026

**Estado: NO AUTORIZADO PARA DESPLEGAR.** El usuario pidió preparar y esperar su indicación. No ejecutar migraciones, reiniciar producción, fusionar `main`, publicar releases estables ni instalar APK de pruebas como productiva.

**Actualización de preparación:** la APK productiva de aprobadores y el backend ya fueron adaptados y validados sin despliegue. Candidato funcional actualizado: `94a3471f68e8352285972913c78040aa84b70932`. Ver `approver-production-candidate.md` para artefactos, firma y evidencias. Las referencias de abajo al candidato inicial y a Firebase faltante describen la revisión inicial; la configuración Firebase ya se recibió, se validó y está fuera de Git. Permanecen vigentes la autorización de lanzamiento, respaldo nuevo del corte/copia externa, ventana y canarios reales de Microsoft y dispositivos después del despliegue autorizado.

**Actualización posterior — conductor y aviso repetido:** el candidato funcional del backend/conductor pasa a `f3c001c0d1cead3c4314fdc402bf85752e6b4b5d`. La APK productiva privada 1.3.0 (49) está firmada y validada, incluida la corrección para que el aviso de rechazo no reaparezca ni recorra rechazos antiguos. Ver `driver-production-candidate.md`. No se ha publicado, no se ha desplegado ni se han modificado datos de producción. El candidato de aprobadores 1.0.0 permanece válido; las nuevas correcciones son del frontend de conductor y de la consulta de avisos del backend.

**Candidato vigente de conductor:** tras la validación del usuario en pruebas 1.2.43 (50), se reconstruyó y validó **1.3.0 (51)** desde `7c65995744c234079b747cf308894d26bfdbf800`. Sustituye al candidato privado de código 49. Queda firmado y almacenado sin publicación ni despliegue; ver el apartado «Resultado vigente» en `driver-production-candidate.md`. La autorización productiva sigue pendiente.

## Candidato e inventario

- Código funcional candidato: `5f07c58818ac4ee05366c804a33073e9841c6ce7`, rama `gv-fix`. `origin/main` (`ae77b7e`) es ancestro; hay 157 commits nuevos. No asumir que el merge de la rama equivale a autorizar el lanzamiento.
- Producción: `https://gv.aspromex.mx`, proyecto Compose `botgerenviaje-120`; pruebas: `https://gvmobility.aspromex.mx`, proyecto `gvmobility`.
- Imágenes observadas en producción: backend `gv-production-backend:160eb38`, conductor `gv-production-frontend:bfdf6e6`, panel `gv-production-panel-admin:8b09c3f`. Conservar también sus identificadores de imagen del respaldo para evitar depender de etiquetas mutables.
- Configuración productiva observada: `/home/mblanquet/production-release-79ac1b3/compose.prod.yml`, `compose.release.yml`, `compose.candidate-160eb38.yml`. PostgreSQL fue creado desde otro checkout; no recrearlo usando el checkout de pruebas.
- Base original: `gerenciamiento_viajes_prod`; volumen `viajes_postgres_data_prod`. Adjuntos: `viajes_backend_uploads_prod` en `/app/uploads`. No usar ni sustituir por volúmenes de staging.
- Consulta de solo lectura: 466 viajes (412 finalizados, 51 cancelados, 3 en curso), 231 inspecciones, 34 conductores y 22 vehículos; base de aproximadamente 249 MiB y adjuntos de aproximadamente 9 MiB. Son cifras de observación, no una barrera de consistencia ni cantidades esperadas el día del lanzamiento.

## Protección y ensayo

`scripts/production/rehearse.sh` lee producción con `pg_dump`, guarda un respaldo privado y el archivo de adjuntos, y restaura en un contenedor NUEVO PostgreSQL 16, sin red ni puertos, con volumen propio, 256 MiB de memoria y 0.5 CPU. No arranca backend, bots, workers, correos ni SharePoint. El clon se detiene al terminar; su volumen y los respaldos se conservan para revisión.

Compara cantidad y huella del contenido de **todas las columnas originales de todas las tablas originales** antes y después de migrar. Aplica las migraciones dos veces para verificar repetición sin alterar el contenido original. Comprueba lectura del archivo de adjuntos y checksums. No imprime datos personales ni credenciales y guarda los archivos con permisos privados.

El ensayo no reemplaza el respaldo del corte. Antes del lanzamiento se necesita un respaldo nuevo, una copia protegida fuera del servidor y su verificación de restauración. También deben protegerse la configuración real del despliegue y sus secretos, sin subirlos a Git. Un dump de PostgreSQL y un tar de archivos tomados con escrituras activas no forman por sí solos un snapshot simultáneo: coordinar la pausa de escrituras en el corte.

### Resultado del ensayo ejecutado

- Respaldo privado en AWS: `/home/mblanquet/.private-gv-release-backups/20261114T182947Z-3626515/` (directorio 0700, archivos 0600, propietario root). No se subió ningún dump a Git ni se copió información productiva a la base de staging.
- Restauración de PostgreSQL: correcta. Migraciones 042–048: ambas pasadas correctas. Cantidades y huellas de las 26 tablas originales: idénticas en ambas comparaciones. Adjuntos: archivo legible y checksum correcto.
- Clon `gv-rehearsal-20261114t182947z-3626515`: detenido al terminar, sin red, puertos ni aplicaciones. Se conservó su volumen aislado para revisión; no comparte el volumen productivo.
- Evidencias: `before.txt`, `after-1.txt`, `after-2.txt`, `restore.log`, `migrations-1.log`, `migrations-2.log`, `SHA256SUMS` y `application-images.txt`, dentro del directorio privado.
- No se modificó el esquema, los datos, las imágenes activas ni los volúmenes de producción. El ensayo sí creó archivos de respaldo y recursos aislados en el servidor.
- El inventario de configuración confirmó push desactivado, montaje de credencial Firebase sin configurar y descubrimiento Android sin configurar en el backend productivo. Hay secreto Microsoft y token Telegram configurados; su presencia no equivale a validar la integración. `SHAREPOINT_SITE_ID` no estaba configurado y debe revisarse antes del lanzamiento.

## Migraciones incrementales previstas

Solo las siguientes, en orden, sobre una copia primero y sobre producción exclusivamente tras la autorización:

| Archivo | Efecto esperado |
| --- | --- |
| 042_trip_operations.sql | Añade tablas de movimientos y bandeja de Telegram. |
| 043_trip_stop_description.sql | Amplía `ubicaciones_viaje.nombre_punto` a `TEXT`; conserva valores, pero requiere bloqueo de tabla. |
| 044_trip_telegram_start_messages.sql | Añade referencias a mensajes de inicio. |
| 045_viaje_inspeccion_uso.sql | Añade vínculos históricos sin sobrescribir los existentes; incluye recuperación de usos antiguos. |
| 046_approver_notifications.sql | Añade dispositivos, eventos y triggers de aprobación. |
| 047_cancelled_approval_withdrawals.sql | Añade eventos internos de retirada para cancelaciones antiguas. |
| 048_manejo_approval_notifications.sql | Añade trigger y eventos de solicitudes de manejo pendientes. |

No ejecutar `database/scripts/init-db.sql`, el manifiesto completo desde 001, seeds, restauraciones sobre la base original ni scripts de staging. No `compose down -v`, `docker volume rm`, limpieza de imágenes de rollback, `DROP DATABASE` ni `TRUNCATE`. Ante una diferencia no explicada o un error de migración, detener el corte; no borrar ni intentar reparar automáticamente datos históricos.

Usar `psql -X -v ON_ERROR_STOP=1`, límite corto de espera de bloqueo y transacciones de cada migración. Ejecutar las migraciones como un paso explícito, no al iniciar el backend. Conservar hashes de cada archivo aplicado y su salida privada. Las tablas nuevas y los registros de recuperación son adiciones esperadas; las tablas originales deben conservar sus valores.

## Pendientes que bloquean afirmar «listo para producción»

1. **APK de aprobadores:** hoy fija `com.aspromex.gvmobility.supervisor.testing`, servidor de pruebas, canal `testing` y Firebase `gv-mobility-pruebas`. El Java nativo también fija la API de pruebas. El workflow reutilizable y el endpoint de actualización solo aceptan aprobadores en testing. Preparar soporte estable completo, paquete productivo y registro Firebase correspondiente, validarlos con firma, actualización, Microsoft y notificaciones. No basta cambiar el nombre visible. No publicar ni enviar una notificación real durante esta preparación.
2. **Credenciales y servicios productivos:** validar Microsoft/redirecciones, cookies, CORS, Telegram/grupos, SharePoint, montaje privado Firebase y canal estable del actualizador. Mantener los datos y dispositivos de pruebas fuera de la base productiva. Nunca copiar `.env.staging` ni sus tokens sobre producción.
3. **APK de conductor:** generar posteriormente con API `https://gv.aspromex.mx`, canal `stable`, versión/código superior al estable instalado y firma compatible. No reutilizar el binario testing 1.2.42; tiene otro ambiente. No cambiar claves que harían ilegibles credenciales o colas locales.
4. **Ventana de corte:** acordar qué hacer con viajes en curso y teléfonos offline. Revisar tres viajes activos de la observación nuevamente, sin cancelarlos ni finalizarlos por preparación. Evitar un cambio de ambiente o reinstalación que borre movimientos pendientes en dispositivos.
5. **Respaldo del corte y copia externa:** generar y verificar inmediatamente antes de migrar. El ensayo anterior es evidencia, no un punto de recuperación futuro.

## Secuencia de lanzamiento, solo cuando el usuario lo indique

1. Fijar SHA final, aprobar diferencias y manifiesto, cerrar los pendientes anteriores y validar todas las pruebas. Repetir inventario/esquema porque producción puede haber cambiado desde el ensayo.
2. Construir imágenes NUEVAS e inmutables sin tocar los servicios ni volúmenes originales. No basar la versión productiva en imágenes etiquetadas `gv-staging-*`. Renderizar la configuración con secretos protegidos y revisar proyecto, montajes, URLs e imágenes sin imprimir credenciales.
3. Coordinar pausa controlada de escrituras y procesos externos; conservar un acceso de consulta. Generar respaldo consistente de base, adjuntos y configuración; verificar checksums, copia externa y restauración. Tomar huellas/cantidades del punto de corte.
4. Aplicar únicamente las migraciones revisadas con límites de bloqueo. Comparar datos históricos. Si no coinciden, no continuar con el cambio de aplicación.
5. Actualizar solo `backend`, `frontend` y `panel-admin` del proyecto PRODUCTIVO con `--no-build --no-deps`; no recrear PostgreSQL ni OSRM. Los comandos Compose finales deben revisarse sobre la configuración real, no copiar los de staging.
6. Comprobar salud, versión, inicio de sesión de conductor y cada rol, listas/filtros, PDF e inspecciones compartidas; validar movimientos offline y su idempotencia en el entorno de ensayo. Hacer canarios productivos identificados únicamente si el usuario los autoriza; no usar viajes reales para probar rechazos.
7. Reabrir escrituras y observar errores, colas y latencia. Publicar APK y manifiestos estables solo tras validar backend y web; verificar que los actualizadores separan ambientes.

## Reversión sin perder datos

Antes de distribuir los nuevos clientes, volver a las tres imágenes anteriores si se validó su compatibilidad, manteniendo la base y sus volúmenes actuales. Dejar las ampliaciones aditivas de esquema; no ejecutar migraciones inversas que eliminen tablas ni registros nuevos.

Después de distribuir APK nuevas, un rollback al backend antiguo puede romper sus endpoints y colas offline. Preferir una corrección hacia adelante o una versión compatible que mantenga esos endpoints. No prometer que reiniciar imágenes antiguas es seguro para clientes nuevos sin probarlo.

Restaurar un respaldo sobre producción elimina escrituras posteriores al respaldo: **no forma parte del rollback normal**. Solo contemplarlo como recuperación extraordinaria, con autorización específica y plan para recuperar todas las escrituras posteriores.

## Paquete revisable

### Configuración Android de Firebase recibida

Se validó `gvnot-prod.json` proporcionado por el usuario: es configuración **Android**, proyecto `gvmobilityproduccion`, paquete `com.aspromex.gvmobility.supervisor`, con identificador de app y API key presentes. Copia de preparación fuera de Git: `C:/Users/Soporte TI Junior/.codex/secrets/gv-mobility-production/google-services.json`. El original permanece intacto. No se activaron servicios ni se publicaron APK productivas.

El archivo Android no es una cuenta de servicio. Posteriormente se recibió la cuenta de servicio de `gvmobilityproduccion`; se validaron su tipo, proyecto, identidad de servicio y formato de clave privada RSA, sin autenticar contra Firebase ni enviar notificaciones. La copia protegida está fuera del repositorio en `C:/Users/Soporte TI Junior/.codex/secrets/gv-mobility-production/firebase-service-account.json`, junto a la configuración Android, con acceso limitado al usuario actual y SYSTEM. El original se conserva. No se copió a AWS ni se activó push productivo. Los dos archivos corresponden al mismo proyecto. Sigue pendiente adaptar y validar el flujo estable de aprobadores, montar la credencial como solo lectura en el despliegue productivo y probar permisos reales cuando se autorice.

`node scripts/production/package-candidate.mjs 5f07c58818ac4ee05366c804a33073e9841c6ce7` crea un archivo de código y un manifiesto con hashes en `output/releases/<SHA>`. No contiene dumps ni secretos locales y no despliega, no fusiona y no publica. Su estado sigue siendo `NOT_AUTHORIZED_FOR_PRODUCTION`.
