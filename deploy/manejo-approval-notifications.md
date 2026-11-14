# Solicitudes de manejo comentado en pruebas

- Al intentar iniciar un viaje con manejo comentado vencido o no registrado, la solicitud existente genera un evento `manejo`.
- Solo Gerente, Gerente General y Administrador reciben o consultan estos avisos, incluso para un local diurno. Los demás roles conservan sus avisos actuales.
- La APK muestra una solicitud con sonido normal del teléfono. El MP3 GV permanece reservado al aviso prioritario por horario/estado.
- En Pendientes aparece Manejo comentado; permite revisar folio, conductor, unidad y ruta, y autorizar/rechazar con firma. La autorización es por viaje.
- Las decisiones y cancelaciones retiran silenciosamente el aviso específico sin retirar otras solicitudes del viaje. No se borran autorizaciones históricas.
- La migración 048 registra eventos y agrega una vez los pendientes existentes de viajes todavía pendientes. No reproduce solicitudes ya resueltas o canceladas.
- Desplegar desde `gv-fix`, compilar el panel y actualizar solo backend/panel de staging. Aplicar 048 únicamente a `gerenciamiento_viajes_stg`. Preservar montaje Firebase y frontend conductor.
- Publicar una APK de aprobadores posterior a 0.1.17 para reconocer la categoría nueva. Mantener paquete y firma existentes.

Validación: pruebas aisladas SQL/API de roles, duplicados, cancelación, decisiones y limpieza; políticas Android; QA con datos simulados en 320, 390 y 768 px, firma y actualización remota.
