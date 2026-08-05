# Supervisores: aprobación de viajes desde Telegram

## Flujo implementado

1. El supervisor entra al grupo cuyo ID está en `TELEGRAM_GROUP_SUPRVISOR_ID` y usa `/start` (no `/star`). Los comandos `/registro` y `/viaje` muestran una indicación para iniciar el flujo de supervisor.
2. El bot registra su ID de Telegram como elegible y muestra la Mini App.
3. En la Mini App se registra con nombre, usuario, teléfono, correo y contraseña. Solo se permite `@itzamna.mx` durante las pruebas.
4. Se envía un correo de bienvenida con enlace de confirmación válido por 24 horas.
5. Tras confirmar, el supervisor vuelve a abrir la Mini App desde Telegram. Solo ve inspecciones pendientes, puede revisarlas, firmar, aprobar o rechazar.
6. Al aprobar se reutiliza el generador PDF existente; el archivo, con firma de conductor y supervisor, queda guardado y visible desde el panel administrativo. Al rechazar se cancela el viaje y se notifica al conductor.

## Configuración necesaria

Configura en el backend/Render:

| Variable | Uso |
|---|---|
| `TELEGRAM_GROUP_SUPRVISOR_ID` | ID numérico del grupo de supervisores. |
| `TELEGRAM_SUPERVISOR_WEB_APP_URL` | URL HTTPS de la Mini App; puede ser la misma que `TELEGRAM_WEB_APP_URL`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Servidor SMTP. |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Credenciales y remitente SMTP. |
| `SUPERVISOR_EMAIL_CONFIRM_URL` | URL pública completa de `https://<api>/api/telegram/supervisor/confirmar-correo`. |

Ejecuta primero la migración `008_supervisores_telegram.sql` en cada base ya existente. El script `database/scripts/migrate.sql` ya la incluye para instalaciones nuevas.

## Respuestas a las decisiones técnicas

1. No se requiere otro servicio de Render: API, Mini App y panel actual reutilizan el servicio PDF. Solo agregue las variables SMTP al servicio API.
2. El flujo conductor no cambia: se selecciona el portal de supervisor únicamente para usuarios previamente habilitados desde el grupo de supervisores. Los endpoints administrativos existentes siguen intactos.
3. Es escalable para una primera fase: el vínculo se hace por ID inmutable de Telegram, las credenciales tienen hash bcrypt, el correo usa token de un solo uso y la autorización se verifica en cada acción. Para crecimiento mayor, conviene separar colas de correo/notificaciones y añadir auditoría detallada.
4. Cree una rama nueva desde `feature/render-deploy` (por ejemplo `codex/supervisores-telegram`), pruebe y haga merge de esta funcionalidad hacia `feature/render-deploy`. No es recomendable mezclarla directamente mientras el despliegue Render sigue en validación.

## Verificación manual

1. Ejecuta la migración y configura todas las variables anteriores.
2. Agrega el bot al grupo de supervisores y habilita que lea mensajes/comandos.
3. Con un usuario de prueba, ejecuta `/start` dentro de ese grupo y completa el registro con correo `@itzamna.mx`.
4. Confirma el correo, reabre la Mini App y revisa una inspección pendiente.
5. Firma, aprueba y comprueba que el conductor recibe la notificación y que el PDF aparece en el panel administrativo.
