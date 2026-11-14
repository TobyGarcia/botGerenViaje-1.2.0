# Revisión de automatización del servidor — 14 de noviembre de 2026

Revisión SSH de solo lectura en `10.255.20.1`. Sin reinicios, cambios de configuración, SQL, merge ni publicación.

## Resultado

No se identificó un mecanismo local que despliegue GV al actualizar GitHub. Se revisaron unidades systemd, temporizadores, cron del sistema/usuarios, contenedores y etiquetas, puertos, procesos, configuraciones nginx y archivos de automatización en `/etc`, `/opt`, `/usr/local/bin`, `/home`, `/root`, `/srv`, scripts de cloud-init y `/var/www`. Búsqueda acotada por tipos/tamaño de archivo, excluyendo dependencias, adjuntos, respaldos y directorios privados.

- Sin unidades de GitHub runner, webhook, Watchtower, Jenkins, CodeDeploy u otros gestores de despliegue identificados.
- Sin coincidencias de despliegue/sincronización Git en las tareas programadas revisadas.
- Sin contenedores ni etiquetas de actualización automática identificados.
- Sin rutas nginx con indicadores GitHub/webhook/deploy. Los procesos web adicionales identificados pertenecen a myskills y medical-kpi; no se encontraron indicadores de despliegue en la búsqueda de `/var/www`.
- Las coincidencias en directorios GV corresponden a scripts de OSRM, Compose y antiguos scripts de rollback. Su existencia no prueba que estén programados; no se encontró un disparador automático local que los invoque.
- El comando forzado de la clave SSH de root es la restricción habitual de login de la imagen, sin indicadores de despliegue.
- Hay agente Amazon SSM activo. Esto permite administración remota y **no prueba un despliegue automático**. AWS CLI no está instalada; no se auditó el plano de control de AWS.

Se compararon al finalizar las imágenes, fechas de inicio, entorno y montajes de los cuatro contenedores productivos contra la referencia previa, normalizando el orden de montajes. Sin cambios.

## Alcance y pendiente

Junto con la revisión de workflows de main y gv-fix, no hay evidencia encontrada de despliegue automático por merge en el repositorio/servidor examinados. **No equivale a una garantía de ausencia:** un servicio externo puede conectarse por SSH o SSM sin tener un receptor local.

Para cerrar la verificación completa siguen pendientes los webhooks/GitHub Apps con acceso administrador, o la revisión del plano de control de AWS (CodePipeline/CodeBuild, EventBridge, Lambda y automatizaciones/asociaciones de SSM en cuentas y regiones relevantes). No se deben desactivar SSM, claves SSH ni servicios para probar esta hipótesis. No realizar un merge de prueba.

El lanzamiento permanece sin autorización. Esta auditoría no modifica la decisión de mantener main, servicios y APK sin publicar.
