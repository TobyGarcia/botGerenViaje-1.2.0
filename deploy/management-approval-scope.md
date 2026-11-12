# Visibilidad de gerencia y aprobación posterior

- GERENTE y GERENTE_GENERAL: todos los viajes con gerenciamiento; locales con salida antes de 06:00 o desde 18:00, hora de Ciudad de México. En pendientes sin salida se toma la creación del viaje. Se conserva el horario existente del sistema.
- Supervisor, QHSE, coordinadores, instructor y administrador conservan todos sus viajes locales. No se modifican las restricciones propias del operador.
- El mismo filtro se aplica al listado de inspecciones y contador de pendientes; una inspección diaria compartida aparece si cualquiera de sus viajes vinculados cumple la regla.
- Se mantiene una sola autorización según el nivel de riesgo. No se añaden bloqueos para iniciar ni aprobaciones independientes para remolques.
- La decisión requiere sesión administrativa. El autorizador se toma de la sesión, no del formulario.
- Una decisión sólo cambia un gerenciamiento pendiente; se bloquea la fila durante la transacción.
- Aprobar después de un recorrido no cambia su estado. Rechazar sólo cancela un viaje que aún está pendiente, conservando la historia de recorridos iniciados o finalizados.
- La aprobación compartida sólo afecta inspecciones pendientes del mismo conductor, vehículo y fecha operativa original, incluso si se autoriza días después.

## Verificación

Pruebas aisladas con el esquema real de migraciones: límites de horario, roles, inspección compartida, aprobación posterior, vehículo y día distintos, decisión repetida, rutas sin sesión e intento de suplantar al autorizador. Las pruebas no usan la base remota ni envían Telegram.

El filtro es del servidor y aplica también a la APK instalada. El selector del autorizador se elimina del panel web; una APK anterior puede conservar el selector visual, pero el servidor ignora sus valores. No se publica una nueva APK como parte de este despliegue.
