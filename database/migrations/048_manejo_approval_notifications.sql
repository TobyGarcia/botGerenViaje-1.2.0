BEGIN;
CREATE OR REPLACE FUNCTION registrar_evento_manejo_aprobador() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
 INSERT INTO aprobador_eventos(id_viajes,categoria,entidad,estado)
 VALUES(NEW.id_viajes,'manejo',NEW.id_autorizacion,NEW.estado);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_aprobador_manejo ON autorizaciones_manejo_comentado_viaje;
CREATE TRIGGER trg_aprobador_manejo AFTER INSERT OR UPDATE OF estado ON autorizaciones_manejo_comentado_viaje
 FOR EACH ROW EXECUTE FUNCTION registrar_evento_manejo_aprobador();
-- Include existing actionable requests once, without replaying resolved or cancelled history.
INSERT INTO aprobador_eventos(id_viajes,categoria,entidad,estado)
SELECT a.id_viajes,'manejo',a.id_autorizacion,a.estado
FROM autorizaciones_manejo_comentado_viaje a JOIN viajes v USING(id_viajes)
JOIN estados_viaje ev USING(id_estado_viaje)
WHERE a.estado='PENDIENTE' AND ev.nombre='PENDIENTE'
AND NOT EXISTS(SELECT 1 FROM aprobador_eventos e WHERE e.categoria='manejo' AND e.entidad=a.id_autorizacion);
COMMIT;
