# Actualizaciones Android

El workflow `Android firmado` se ejecuta manualmente desde Actions. Construye
desde la rama seleccionada y publica un **borrador** en GitHub Releases con
`gv-mobility.apk` y `update.json`. No publica automáticamente versiones a conductores.

GitHub requiere que el workflow exista en la rama predeterminada para ofrecer
el botón de ejecución manual. Este trabajo se prepara en `gv-fix`; incorporar
el workflow mediante el proceso normal de revisión antes de usar ese botón.

Crear los environments `android-testing` y `android-stable`. En cada uno:

- Variable `ANDROID_WEB_URL`: dirección HTTPS del conductor en ese ambiente.
- Secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD`.
- Usar la misma firma de las APK ya distribuidas. No generar una nueva sin
  verificar el certificado anterior. Respaldar la clave fuera de GitHub.

Elegir versión `X.Y.Z` y un código entero mayor que **todos** los códigos
distribuidos; no reutilizar códigos entre canales. Ambos canales comparten
applicationId. Para aislar datos de pruebas, usar otro teléfono/perfil Android.

Publicar el borrador solo después de verificar firma, instalación sobre la
versión anterior y conservación de datos. Copiar el contenido de `update.json`
a `ANDROID_UPDATE_TESTING` o `ANDROID_UPDATE_STABLE` en el entorno del backend.
Recrear el backend conservando las demás variables. La consulta pública es
`GET /api/android/update?channel=testing` (o stable), sin credenciales de GitHub.
Si la variable no está configurada devuelve `available:false`.

El enlace de descarga requiere un release publicado y accesible al usuario.
Si el repositorio es privado, esta distribución necesita alojamiento autenticado
de APK en el backend; no incrustar tokens de GitHub en la app.

La APK actual usa `server.url`: carga las pantallas web del servidor. Cambios
web pueden llegar sin instalar otra APK. Cambios nativos requieren otra APK.
Esto todavía no equivale a una aplicación con SQLite y rastreo autónomo nativo.

No iniciar una instalación durante un viaje ni con datos pendientes. El aviso
de la aplicación debe comprobar ambas condiciones inmediatamente antes de
abrir la descarga; Android conserva el control final de la instalación.
