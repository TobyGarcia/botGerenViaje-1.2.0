# Recuperación de acceso en Android — 14 de noviembre de 2026

El usuario reportó Microsoft confirmado en el navegador y «No fue posible conectar con el servidor» en la APK productiva de aprobadores. Los logs mostraban start/poll con HTTP 200 y canje OAuth correcto, sin errores CORS o de proceso. No se obtuvo el error nativo original del teléfono, por lo que no se afirma haber identificado su causa de red exacta.

Se corrigieron dos fallos comprobados del flujo: la APK descartaba el ticket ante un error temporal de transporte; el broker borraba el resultado en el primer poll, aunque Android no recibiera la respuesta. Ahora:

- El acceso pendiente se conserva localmente hasta confirmar, cancelar o expirar. Puede retomarse al reabrir la APK.
- Fallos de red, timeout y HTTP transitorios mantienen el intento y se reintentan; errores definitivos de credenciales/permisos/expiración lo cierran.
- La consulta periódica se pausa mientras la APK está inactiva y se retoma al regresar del navegador.
- El broker permite recuperar el mismo resultado durante los cinco minutos de vida del ticket, exigiendo siempre su secreto original. No permite completar dos veces el estado OAuth, cambiar la sesión entregada ni acceder con otro secreto.

## Evidencias

- Código funcional: `52bbf5b6aa41a65e08200e5f9f09b167c12b4331`.
- Pruebas locales: 4 del broker y 14 del panel correctas; build web correcto.
- [CI de imágenes](https://github.com/TobyGarcia/botGerenViaje-1.2.0/actions/runs/43638976810): correcta, con suite completa de backend, frontend y panel. Artefacto 14131033785; archivo de imágenes SHA256 `68e1133534beeb7f7d932d7c0edb8a49c2b1e251e8c47f72cbe8c2d62aac5241`.
- [CI de APK](https://github.com/TobyGarcia/botGerenViaje-1.2.0/actions/runs/43638978898): correcta, incluidas pruebas Android y verificación de firma. Artefacto privado 14131127335.
- APK **1.0.1 (2)**, paquete productivo `com.aspromex.gvmobility.supervisor`. API nativa productiva y código nuevo de recuperación comprobados en el binario. Certificado DER del bloque v2 comparado con la firma GV: `bb7eed6e260e018468ed300945312734c0bf05270415c6c7ac984c1e4e5849e4`.
- APK SHA256 `bfa3f212ff88b80fb368c1f4a36727ed4b608ce98362904dfaa9c6e8ff7cd169`.

## Aplicación y publicación

Se actualizó únicamente backend en el staging existente, verificando recuperación de respuesta perdida, expiración, rechazo de secreto inválido y consultas HTTP repetidas. Después se aplicó la misma imagen en producción. Sin migraciones ni cambios de datos; entornos y montajes comprobados idénticos, con sus credenciales de cada ambiente.

Imagen backend local: `sha256:7f329ccf22d6843fb6430d0310b6e6f6afb9c7b9aabcf84e09e3efc5a6148a92`. Se compararon sus capas y configuración contra el inventario CI antes de usarla. Frontend, panel y PostgreSQL productivos no se recrearon ni reiniciaron. Todos quedaron saludables.

Configuración efectiva del backend productivo y reversión privadas: `/home/mblanquet/.gv-login-fix-52bbf5b/viajes-backend/candidate.json` y `rollback.json`. Snapshot anterior/posterior, entorno y logs en el mismo directorio, protegido. Para staging, subdirectorio `gvmobility-backend`. No reutilizar el archivo de backend anterior al hotfix para un reinicio posterior, pues retrocedería la corrección.

[APK 1.0.1 publicada](https://github.com/TobyGarcia/botGerenViaje-1.2.0/releases/tag/android-supervisor-stable-v1.0.1-2): activos y descarga pública verificados por SHA256. El actualizador productivo devuelve available=true, 1.0.1, código 2 y hash correcto. Conductor no cambió.

Queda la confirmación del usuario en su teléfono, actualizando sobre 1.0.0 sin desinstalar ni borrar datos, e intentando Microsoft de nuevo. La prueba real no se sustituye por los tests de broker/HTTP; si persiste el fallo, se necesita el motivo nativo de conexión del dispositivo para continuar el diagnóstico.
