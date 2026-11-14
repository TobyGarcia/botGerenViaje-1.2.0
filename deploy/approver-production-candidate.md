# Candidato productivo de aprobadores — no desplegado

La instrucción vigente es preparar y validar, sin desplegar ni publicar una actualización estable. No se modifican datos ni configuración activa de producción.

## Separación de ambientes

| Componente | Producción | Pruebas |
| --- | --- | --- |
| Paquete Android | `com.aspromex.gvmobility.supervisor` | `com.aspromex.gvmobility.supervisor.testing` |
| API / origen WebView | `https://gv.aspromex.mx` | `https://gvmobility.aspromex.mx` |
| Proyecto Firebase | `gvmobilityproduccion` | `gv-mobility-pruebas` |
| Canal de actualizaciones | `stable` | `testing` |
| Enlace de retorno de Microsoft | `gvsupervisorprod://auth` | `gvsupervisor://auth` |

Producción y pruebas pueden instalarse como aplicaciones distintas. No se migra ni se borra el almacenamiento de la app de pruebas. Se conserva la firma GV existente para el nuevo paquete; futuras actualizaciones productivas deben mantener ese certificado.

El build se selecciona con `ANDROID_UPDATE_CHANNEL=stable`; la configuración Android se entrega mediante `APPROVER_GOOGLE_SERVICES_FILE`. Un proyecto Android generado para otro paquete se rechaza: compilar cada ambiente en un checkout limpio. Se validan el proyecto Firebase y el paquete antes de preparar los archivos nativos.

La API de notificaciones nativa, el origen del WebView, los enlaces de Microsoft y el actualizador se generan para el mismo ambiente. Los validadores de actualizaciones exigen paquete, canal, repositorio, archivo, versión y SHA256 correctos; el instalador nativo mantiene las comprobaciones de firma y paquete.

## Backend preparado

El overlay `compose.approver-production-candidate.yml` añade exclusivamente configuración de aprobadores al backend. No redefine PostgreSQL, `DATABASE_URL`, volúmenes de datos ni adjuntos. `PRODUCTION_APPROVER_FIREBASE_FILE` debe apuntar a una cuenta de servicio privada del proyecto productivo y se monta como **solo lectura**. No copiarla al código ni a la APK.

`APPROVER_ENVIRONMENT=stable` y `APPROVER_FIREBASE_PROJECT_ID=gvmobilityproduccion` impiden arrancar el cliente de envío con una cuenta de pruebas. Push queda desactivado por defecto; `PRODUCTION_APPROVER_PUSH_ENABLED=true` se establecerá únicamente durante el lanzamiento autorizado. El actualizador productivo de aprobadores rechaza consultas del canal de pruebas.

Verificación reproducible de Compose, sin iniciar contenedores:

```text
node scripts/production/validate-approver-compose.mjs
```

## Archivos y validaciones de Firebase

Ambos archivos del usuario están fuera de Git en `C:/Users/Soporte TI Junior/.codex/secrets/gv-mobility-production/`, con acceso restringido al usuario actual y SYSTEM. La configuración Android se guardó además como secreto cifrado de GitHub Actions `ANDROID_SUPERVISOR_PRODUCTION_GOOGLE_SERVICES_BASE64` para el build. La cuenta de servicio **no se transfirió a GitHub Actions ni a AWS**.

La cuenta productiva se autenticó correctamente y FCM aceptó una solicitud en modo `dryRun=true`: **sin entrega de notificaciones y sin acceso a base de datos**. Ese modo usa la validación sin entrega documentada por [Firebase](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send). El script de validación no importa servicios de base de datos y no se ejecuta al iniciar el backend.

Comando explícito de validación (requiere `GOOGLE_APPLICATION_CREDENTIALS` apuntando al archivo privado):

```text
node backend/src/scripts/validate-production-firebase.js
```

## Compilación privada y publicación bloqueada

El workflow existente `android-release.yml` acepta `application=supervisor`, `channel=stable`, `candidate_only=true`, versión `1.0.0` y código `1`. Usa el certificado GV configurado; el environment de firma se llama `android-testing`, pero el binario se genera con el **paquete, Firebase y API productivos** indicados arriba. El nombre del environment de firma no define el ambiente de la aplicación.

La ejecución conserva la APK en un artefacto de Actions, accesible con autenticación y retención de 14 días; no crea release ni modifica manifiestos públicos. El build de aprobadores estable falla si no se selecciona `candidate_only=true`. El job de conductor se omite para este candidato.

No instalar este candidato para trabajar con viajes reales antes del corte. La validación completa en un teléfono —Microsoft, registro del dispositivo, recepción con app cerrada, sonido GV y flujo de aprobación— se hará después del despliegue autorizado y con canarios explícitamente autorizados. No se afirma que esas pruebas reales estén ejecutadas por el solo hecho de compilar o validar Firebase.

El lanzamiento sigue sujeto al plan de conservación de datos, respaldo del corte y autorización del usuario en `production-launch-preparation.md`.

## Resultado del candidato validado

- APK firmada **1.0.0, código 1**, compilada desde `94a3471f68e8352285972913c78040aa84b70932`.
- [Ejecución privada de compilación](https://github.com/TobyGarcia/botGerenViaje-1.2.0/actions/runs/43628763608): correcta. Pruebas nativas correctas; paso de publicación omitido. No se creó release estable ni de pruebas.
- SHA256: `767bc793999e8a6d393b90cc2a84c3d6201cdd8c2c0ecfbddc673265ccbd68c7`.
- Certificado GV SHA256: `bb7eed6e260e018468ed300945312734c0bf05270415c6c7ac984c1e4e5849e4`.
- Se verificaron en el binario el paquete productivo, `android_update_channel=stable`, Firebase `gvmobilityproduccion`, el origen del WebView, el enlace de retorno y la API nativa de notificaciones. El DEX no contiene la URL nativa de pruebas. Se comprobó que la clave privada de servicio no está dentro de la APK.
- Archivos locales, ignorados por Git: `output/releases/94a3471f68e8352285972913c78040aa84b70932/approvers/`: `gv-supervisor.apk`, `update.json` y `validation.json`. El `downloadUrl` del manifiesto identifica la publicación futura; todavía no se publicó ese manifiesto ni su URL.
- Backend: 148 pruebas sin fallos; panel: 12; configuración Android: 2; build web productivo y pruebas nativas de Android correctos. Configuración Compose validada sin iniciar servicios. Firebase validado en modo sin entrega.
- Durante esta adaptación la cuenta permaneció local. Posteriormente se preparó una copia protegida en AWS, sin montarla en servicios activos ni activar push; consultar `production-readiness-current.md`. No se ejecutó SQL productivo durante esta adaptación.
