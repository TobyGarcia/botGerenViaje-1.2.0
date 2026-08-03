# Módulo de inspección vehicular

## Flujo

1. El conductor crea un viaje en estado `PENDIENTE`.
2. La API comprueba si la unidad ya tiene una inspección aprobada para el día operativo.
3. Si no existe, la Mini App muestra carátula, cuatro vistas de daños, checklist, observaciones y firma.
4. Al enviar, la inspección queda en `PENDIENTE_APROBACION` y aparece en la campana del panel administrativo.
5. Un usuario `ADMINISTRADOR` o `SUPERVISOR` aprueba o rechaza.
6. Al aprobar, el backend genera el PDF, lo guarda en PostgreSQL y habilita el inicio del viaje.
7. Los siguientes viajes de esa unidad durante el mismo día operativo reutilizan la aprobación.

El día operativo usa la zona `America/Mexico_City` y cambia a las 22:00. Las inspecciones enviadas fuera de 07:00 a 12:00 se marcan para autorización fuera de horario.

## Actualización de Render

Antes de desplegar el código actualizado, ejecutar:

```bash
psql "$DATABASE_URL" -f database/scripts/update-render-inspecciones.sql
```

Después se despliegan API, Mini App y panel administrativo desde `feature/render-deployment`.

## Reporte PDF

El reporte usa la versión 2.2, área responsable Logística y número documental `SII-MX-AÑO-LOG-ID_VIAJE`. El documento se almacena en `inspecciones_vehiculares.pdf_documento` para que no dependa del almacenamiento temporal de Render.
