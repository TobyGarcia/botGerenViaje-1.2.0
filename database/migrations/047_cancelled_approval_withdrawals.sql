BEGIN;
-- Reconcile already-cancelled requests. These internal events only remove device notices;
-- they never change inspections, signatures, PDFs, management decisions or trip history.
INSERT INTO aprobador_eventos(id_viajes,categoria,entidad,estado)
SELECT v.id_viajes,'withdrawal',v.id_viajes,'CANCELADO'
FROM viajes v JOIN estados_viaje ev USING(id_estado_viaje)
WHERE ev.nombre='CANCELADO'
 AND (EXISTS(SELECT 1 FROM gerenciamiento_viajes g WHERE g.id_viaje=v.id_viajes AND g.estado='PENDIENTE')
 OR EXISTS(SELECT 1 FROM inspecciones_vehiculares i WHERE i.estado='PENDIENTE_APROBACION' AND (i.id_viajes=v.id_viajes OR EXISTS(SELECT 1 FROM viaje_inspeccion_uso u WHERE u.id_viajes=v.id_viajes AND u.id_inspeccion=i.id_inspeccion))))
 AND NOT EXISTS(SELECT 1 FROM aprobador_eventos e WHERE e.id_viajes=v.id_viajes AND e.categoria='withdrawal' AND e.estado='CANCELADO');
COMMIT;
