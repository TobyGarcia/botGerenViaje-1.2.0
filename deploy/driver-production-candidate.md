# Candidato productivo del conductor — sin publicación ni despliegue

La instrucción vigente es preparar y validar, sin publicar la APK ni desplegar servicios. Durante esta preparación no se accede a la base productiva ni se instalan APK en teléfonos con datos reales.

## Identidad y actualización

- Candidato: **1.3.0, código 49**, canal `stable`.
- Paquete conservado: `com.aspromex.gerenciamientoviajes`.
- API, GPS y origen del WebView: `https://gv.aspromex.mx`; contenido web empaquetado en la APK.
- Referencia publicada: `android-stable-v1.2.22-28`, versión 1.2.22, código 28. Se descargó desde GitHub para comparar identidad y certificado, sin ejecutar la app ni llamar al backend productivo.
- Certificado de referencia GV SHA256: `bb7eed6e260e018468ed300945312734c0bf05270415c6c7ac984c1e4e5849e4`.
- `candidate_only=true` conserva APK y manifiesto como artefactos privados de Actions; omite la creación de releases. El environment de firma `android-testing` se usa para recuperar el mismo certificado GV de la APK estable existente; API y canal de compilación se fijan expresamente a producción.

Los nuevos validadores de Capacitor y Gradle rechazan combinaciones de servidor/canal incompatibles. El workflow no se conecta por SSH, no ejecuta SQL ni arranca servicios productivos.

## Conservación de datos del teléfono

No se cambian el nombre de la base `gv-native-gps.db`, las tablas existentes, el paquete ni el alias de cifrado `gv-gps-token`. La actualización de SQLite de versión 1 a 2 añade la tabla de trabajos de movimientos; no elimina GPS, sesiones, estado del viaje ni cierres pendientes.

Las pruebas nativas comprueban la conservación de identificadores y horarios de GPS, sesión cifrada, origen, folio y cierre pendiente al actualizar el esquema. También comprueban que movimientos e inspecciones sobreviven al cierre/reapertura y que solo se retiran operaciones confirmadas por el servidor. La sincronización rechaza un origen diferente al compilado, antes de abrir una conexión.

Estas comprobaciones automáticas no sustituyen un ensayo de actualización en un teléfono controlado. En el lanzamiento no se debe desinstalar la app, borrar datos, cambiar claves ni usar teléfonos con colas de pruebas como si fueran producción. Coordinar sincronización de pendientes y actualización fuera de viajes activos; después de actualizar, abrir la app para verificar sesión y GPS. No prometer seguimiento ininterrumpido durante la instalación.

## Corrección prioritaria del aviso de inspección rechazada

Incluida en el nuevo candidato:

- El acuse se identifica por el evento de rechazo; no por `actualizado_en`, que puede cambiar al generar documentos.
- Cerrar el último aviso no inicia una cadena de rechazos históricos. Un marcador por conductor evita volver a avisos más antiguos.
- Se reconocen los acuses existentes de la versión anterior cuando coinciden; el fallback para servidores anteriores tampoco depende de cambios posteriores de `actualizado_en`.
- Un rechazo nuevo sí se muestra, incluso si vuelve a rechazarse la misma inspección.
- El backend consulta el último rechazo aplicable y omite el anterior cuando ya existe una inspección nueva enviada o aprobada del mismo conductor y vehículo. Telegram puede consultar expresamente una decisión histórica sin alterar el historial.
- No se borran inspecciones, decisiones, documentos ni historial. No requiere otra migración SQL.

Validación: 79 pruebas del frontend, suite completa del backend y verificación visual del modal en 320, 390 y 768 px. Se cerró el aviso, se esperó otro ciclo de consulta con `actualizado_en` distinto y se recargó: el aviso no reapareció. Posteriormente el usuario autorizó aplicar esta corrección únicamente en pruebas: ya está desplegada allí y publicada en la APK de pruebas 1.2.43 (50). Las instalaciones anteriores requieren actualizar; producción permanece bloqueada.

## Condiciones para el lanzamiento posterior

Distribuir únicamente después de actualizar y validar el backend/web productivos con las migraciones revisadas y el respaldo del corte. Hacer un canario autorizado de login, viaje, GPS, movimientos, inspección y cierre offline, incluida la ausencia de avisos repetidos. No probar rechazos ni cancelaciones usando viajes reales sin autorización.

Mantener APK y manifiesto locales sin publicar. El enlace del manifiesto corresponde a la publicación futura y no debe activarse en el actualizador hasta la autorización expresa del usuario.

## Resultado verificado

- Código funcional: `f3c001c0d1cead3c4314fdc402bf85752e6b4b5d`. Incluye la corrección del aviso repetido, cuyo commit es `f173b7b`.
- [Compilación privada](https://github.com/TobyGarcia/botGerenViaje-1.2.0/actions/runs/43629929885): correcta; pruebas nativas y verificación de firma correctas; publicación omitida. Los intentos anteriores de esta preparación no son candidatos aprobados.
- APK 1.3.0 (49), paquete `com.aspromex.gerenciamientoviajes`, canal `stable`.
- SHA256: `e02fd4709292d651c81abbbc4c77be17141e95b251b0d6f7dd462817ca327bb9`.
- Firma comparada con la APK publicada 1.2.22 (28): idéntica. Origen del WebView: mismo dominio productivo. GPS y API web verificados como productivos; no se encontró la URL GPS de pruebas en el DEX.
- El código de acuse estable del rechazo está dentro de la APK; no se incluyeron claves privadas ni keystores.
- Archivos privados locales, ignorados por Git: `output/releases/f3c001c0d1cead3c4314fdc402bf85752e6b4b5d/driver/`: `gv-mobility.apk`, `update.json` y `validation.json`.
- Frontend: 79 pruebas correctas. Backend con la corrección: 149 pruebas correctas. Modal comprobado con consultas repetidas y recarga en 320, 390 y 768 px. Compilación nativa y pruebas de conservación de datos correctas.
- No existe release `android-stable-v1.3.0-49`; el candidato estable sigue privado y producción no cambió. Tras la autorización específica para pruebas se publicó 1.2.43 (50) y se desplegó la corrección solo en staging. Antes de publicar una versión productiva se debe reconstruir el candidato con código superior al mayor distribuido (ahora al menos 51), sin desinstalar ni borrar datos. Ver `rejection-read-once-staging.md`.
