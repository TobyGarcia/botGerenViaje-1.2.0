# Aprobación conjunta de gerenciamiento e inspección

Desde el detalle de Gerenciamientos o de la inspección vinculada, **Aprobar ambos** registra una firma para ambos documentos en una transacción. Si falta la inspección, hay una decisión rechazada, falla una actualización o el rol no corresponde al riesgo, no se aprueba ninguno. El servidor obtiene la identidad del aprobador de la sesión y consulta su rol activo.

| Riesgo | Roles habilitados |
| --- | --- |
| Bajo | Supervisor, QHSE, Instructor, Coordinación, Gerencia y Administración |
| Medio | Coordinación, Gerencia y Administración |
| Alto | Gerencia y Administración |

Una inspección ya aprobada conserva su firma. La reutilización diaria exige el mismo conductor, vehículo y día operativo, sin un uso intermedio por otro conductor. Si hay varios gerenciamientos candidatos y no existe un vínculo directo, se debe seleccionar el viaje en Gerenciamientos. La aprobación no cambia viajes en curso o finalizados a pendientes. Los viajes locales mantienen su flujo independiente. Las inspecciones de remolques por enganche no cambian.

Después de confirmar se regeneran los PDF y se intenta actualizar SharePoint y avisar al conductor por Telegram. Estas tareas ocurren después del commit. Un fallo externo no revierte la decisión; los PDF pueden regenerarse desde la descarga.

La app del conductor consulta el estado pendiente cada siete segundos mientras está visible, al recuperar foco o conexión y al volver a primer plano en Android. Descarta respuestas de pantallas anteriores y elimina el estado pendiente local al recibir la aprobación. Sin conexión conserva la última información hasta consultar el servidor.

Validación: pruebas aisladas de permisos, firma previa, reutilización diaria, falta de inspección, concurrencia y rollback. Verificación visual de ambos puntos de aprobación en los tamaños soportados. No se aprueban documentos reales como prueba del despliegue.

La app de aprobadores actualiza sus listas, contadores y el documento abierto cada cinco segundos mientras está visible, y al recuperar conexión o regresar a primer plano. Los cambios hechos por otro aprobador se reflejan sin navegar ni generar avisos nuevos. El refresco conserva filtros, observaciones y firma mientras la solicitud sigue pendiente; si ya fue atendida, actualiza su estado y deja de ofrecer acciones de aprobación. Si no hay conexión, conserva los últimos datos hasta poder consultar de nuevo.
