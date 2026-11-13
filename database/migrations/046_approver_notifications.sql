BEGIN;
CREATE TABLE IF NOT EXISTS aprobador_dispositivos (
 id_dispositivo UUID PRIMARY KEY, id_usuario BIGINT NOT NULL REFERENCES usuarios_admin(id_usuarios_admin) ON DELETE CASCADE,
 secreto_hash TEXT NOT NULL, fcm_token TEXT, push_cursor BIGINT NOT NULL DEFAULT 0, critical_hash TEXT,
 envio_en TIMESTAMPTZ, reintentar_en TIMESTAMPTZ, fallos INTEGER NOT NULL DEFAULT 0, creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ultimo_acceso TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, revocado BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_aprobador_fcm_unico ON aprobador_dispositivos(fcm_token) WHERE fcm_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aprobador_dispositivos_usuario ON aprobador_dispositivos(id_usuario);
CREATE TABLE IF NOT EXISTS aprobador_eventos (
 id_evento BIGSERIAL PRIMARY KEY, id_viajes BIGINT NOT NULL, categoria TEXT NOT NULL,
 entidad BIGINT NOT NULL, estado TEXT NOT NULL, creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_aprobador_eventos_viaje ON aprobador_eventos(id_viajes,id_evento);
CREATE OR REPLACE FUNCTION registrar_evento_aprobador() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE trip_id BIGINT; entity_id BIGINT; category TEXT; status TEXT;
BEGIN
 IF TG_TABLE_NAME='viajes' THEN
  IF TG_OP='UPDATE' AND NEW.id_estado_viaje IS NOT DISTINCT FROM OLD.id_estado_viaje THEN RETURN NEW; END IF;
  trip_id:=NEW.id_viajes;entity_id:=NEW.id_viajes;category:='trip';
  SELECT nombre INTO status FROM estados_viaje WHERE id_estado_viaje=NEW.id_estado_viaje;
 ELSIF TG_TABLE_NAME='inspecciones_vehiculares' THEN
  IF TG_OP='UPDATE' AND NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
  trip_id:=NEW.id_viajes;entity_id:=NEW.id_inspeccion;category:='inspection';status:=NEW.estado;
 ELSIF TG_TABLE_NAME='gerenciamiento_viajes' THEN
  IF TG_OP='UPDATE' AND NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
  trip_id:=NEW.id_viaje;entity_id:=NEW.id_gerenciamiento;category:='management';status:=NEW.estado;
 ELSIF TG_TABLE_NAME='ubicaciones_viaje' THEN
  IF NOT COALESCE(NEW.es_punto_intermedio,FALSE) THEN RETURN NEW; END IF;
  trip_id:=NEW.id_viajes;entity_id:=NEW.id_ubicaciones_viaje;category:='stop';status:='PARADA_TECNICA';
 END IF;
 IF trip_id IS NOT NULL THEN INSERT INTO aprobador_eventos(id_viajes,categoria,entidad,estado) VALUES(trip_id,category,entity_id,COALESCE(status,'')); END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_aprobador_viaje ON viajes;
CREATE TRIGGER trg_aprobador_viaje AFTER INSERT OR UPDATE OF id_estado_viaje ON viajes FOR EACH ROW EXECUTE FUNCTION registrar_evento_aprobador();
DROP TRIGGER IF EXISTS trg_aprobador_inspeccion ON inspecciones_vehiculares;
CREATE TRIGGER trg_aprobador_inspeccion AFTER INSERT OR UPDATE OF estado ON inspecciones_vehiculares FOR EACH ROW EXECUTE FUNCTION registrar_evento_aprobador();
DROP TRIGGER IF EXISTS trg_aprobador_gerenciamiento ON gerenciamiento_viajes;
CREATE TRIGGER trg_aprobador_gerenciamiento AFTER INSERT OR UPDATE OF estado ON gerenciamiento_viajes FOR EACH ROW EXECUTE FUNCTION registrar_evento_aprobador();
DROP TRIGGER IF EXISTS trg_aprobador_parada ON ubicaciones_viaje;
CREATE TRIGGER trg_aprobador_parada AFTER INSERT ON ubicaciones_viaje FOR EACH ROW EXECUTE FUNCTION registrar_evento_aprobador();
COMMIT;
