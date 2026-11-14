# Publicación de APK productivas — 14 de noviembre de 2026

Autorización posterior al despliegue: «ya hazlo todo para quede listo». Se publicaron los binarios previamente validados, sin recompilarlos ni cambiar su firma, origen o almacenamiento.

| Aplicación | Versión | Código | Publicación |
| --- | --- | --- | --- |
| Conductor | 1.3.0 | 51 | [Release estable](https://github.com/TobyGarcia/botGerenViaje-1.2.0/releases/tag/android-stable-v1.3.0-51) |
| Aprobadores | 1.0.0 | 1 | [Release estable](https://github.com/TobyGarcia/botGerenViaje-1.2.0/releases/tag/android-supervisor-stable-v1.0.0-1) |

- Activos APK y update.json subidos primero a borradores, verificando tamaño y digest SHA256 de GitHub, y después publicados sin prerelease.
- Descarga pública de ambas APK comprobada byte a byte por SHA256 contra sus manifiestos y candidatos validados.
- Conductor SHA256: `f71d333a65e21e9226d77ff60a1525ee1187ce9bcf873a8f1703620565e4fc32`.
- Aprobadores SHA256: `767bc793999e8a6d393b90cc2a84c3d6201cdd8c2c0ecfbddc673265ccbd68c7`.
- Se reutilizó la verificación de firma de los candidatos CI, cuyos bytes son idénticos. No se afirma una nueva verificación local con apksigner: la instalación Java disponible en Windows estaba incompleta.
- Ambos endpoints de `https://gv.aspromex.mx/api/android/update?channel=stable&application=driver|supervisor` devolvieron available=true y versión, código y SHA correctos.
- Sin cambios de base de datos, reinicios ni edición de configuración para publicar. Los clientes reciben la actualización por el descubrimiento estable existente.

El conductor puede actualizar sobre su instalación productiva, conservando datos. No desinstalar ni borrar almacenamiento. La APK productiva de aprobadores usa `com.aspromex.gvmobility.supervisor`; la de pruebas tiene otro paquete y canal, y no se convierte en productiva mediante su actualizador testing.

La prueba con personas y teléfonos reales sigue pendiente: acceso Microsoft, registro del dispositivo, permisos, recepción push con app cerrada, actualización y conservación de pendientes. Los endpoints y binarios verificados no sustituyen esa prueba; no se enviaron notificaciones a terceros para comprobarla.

## Integración y comprobación final

`gv-fix` se integró en `main` mediante avance directo, sin forzar historial: `4ffcfc029174eb64dd31408e800a652d88d3a08d`. No aparecieron ejecuciones de Actions para ese commit durante la comprobación. En AWS se compararon contenedores, imágenes, fechas de inicio y entornos antes/después: idénticos y saludables. La integración no recreó ni reinició los servicios observados.

La evidencia privada está en `before-main-integration.json` y `after-main-integration.json` dentro del directorio del corte. Esto demuestra el resultado observado, pero no concede acceso a los webhooks/GitHub Apps ni garantiza ausencia de automatizaciones externas futuras. Se mantiene esa limitación administrativa documentada.

El contenido funcional de los servicios productivos coincide con el integrado; los commits posteriores al build a43a284 son de preparación, herramientas de validación y documentación. Las APK mantienen sus SHA de fuente propios, documentados en sus manifiestos de validación.
