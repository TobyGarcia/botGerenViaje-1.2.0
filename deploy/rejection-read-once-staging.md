# Corrección del aviso repetido — aplicada solo en pruebas

Autorización del usuario: desplegar la corrección en pruebas y publicar la APK de pruebas, manteniendo producción sin cambios.

- Código desplegado: `3bbb0dc447c992a7d9003591e41d8764ddf26ec7`, rama `gv-fix`; incluye la corrección `f173b7b`.
- Backend: `gv-staging-trip-operations-backend:read-once-3bbb0dc`.
- Web del conductor: `gv-staging-trip-operations-frontend:read-once-3bbb0dc`.
- Proyecto Compose: `gvmobility`; destino validado: `gerenciamiento_viajes_stg`.
- Solo se recrearon backend y frontend de pruebas. No se ejecutaron migraciones SQL, rechazos, cancelaciones ni borrados de historial para verificar el cambio.
- Ambos servicios saludables; `/health` devuelve 200; bundle público coincide por SHA256. `conductor/version.json` anuncia `rejection-read-once-f173b7b`.
- La consulta de avisos se verificó en solo lectura con datos existentes de pruebas: como máximo un aviso aplicable por conductor; los rechazos sustituidos por una inspección posterior no se vuelven a mostrar.
- Imágenes e instantes de arranque de backend, frontend, panel y PostgreSQL productivos: idénticos antes y después del despliegue. No se reiniciaron ni modificaron.

## APK publicada

- Conductor **1.2.43, código 50**, paquete `com.aspromex.gerenciamientoviajes`, canal `testing`.
- API y WebView: `https://gvmobility.aspromex.mx`.
- [Compilación](https://github.com/TobyGarcia/botGerenViaje-1.2.0/actions/runs/43630652368), firma y pruebas nativas: correctas.
- Certificado GV SHA256: `bb7eed6e260e018468ed300945312734c0bf05270415c6c7ac984c1e4e5849e4`.
- SHA256 APK: `30fb582b64a9415d23c277a63d8d59f9cfc6da7126f0753e709a55154076171f`.
- Se verificaron en el APK el servidor de pruebas, el canal y los marcadores del acuse estable. Manifiesto y firma correctos.
- [APK de pruebas](https://github.com/TobyGarcia/botGerenViaje-1.2.0/releases/download/android-testing-v1.2.43-50/gv-mobility.apk). Publicada como prerelease; el actualizador de pruebas anuncia versión 1.2.43/código 50.

## Comprobación en el teléfono

Actualizar conservando datos, sin desinstalar. Si aparece un rechazo aplicable, pulsar **Entendido**, esperar otra consulta y cerrar/abrir la app: ese mismo rechazo no debe repetirse ni abrir otros más antiguos. Una nueva decisión real de rechazo sí debe avisar. Los rechazos históricos ya sustituidos por una inspección nueva pueden dejar de aparecer directamente. No se generó un rechazo sobre un viaje real para esta validación.

## Producción permanece bloqueada

No se publicó la APK estable ni se cambió producción. Como pruebas ahora publicó código 50 y el candidato estable privado del conductor era código 49, antes del lanzamiento productivo se debe reconstruir y validar el candidato estable con un código superior al mayor distribuido entonces (actualmente, al menos 51). No intentar resolver diferencias de versión desinstalando ni borrando datos del teléfono.
