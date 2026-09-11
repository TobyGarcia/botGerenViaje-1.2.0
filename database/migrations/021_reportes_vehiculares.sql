BEGIN;

CREATE TABLE IF NOT EXISTS reportes_vehiculares (
  id_reporte BIGSERIAL PRIMARY KEY,
  folio VARCHAR(30) UNIQUE NOT NULL,
  id_vehiculo INTEGER NOT NULL REFERENCES vehiculos(id_vehiculos) ON DELETE CASCADE,
  id_conductor INTEGER REFERENCES conductores(id_conductores) ON DELETE SET NULL,
  id_inspeccion BIGINT REFERENCES inspecciones_vehiculares(id_inspeccion) ON DELETE SET NULL,
  fecha_reporte DATE NOT NULL DEFAULT CURRENT_DATE,
  detalles TEXT NOT NULL,
  urgencia VARCHAR(20) NOT NULL DEFAULT 'MEDIA',
  estatus VARCHAR(30) NOT NULL DEFAULT 'REPORTADO',
  responsable_atencion VARCHAR(150),
  dias_estimados INTEGER DEFAULT 0,
  fecha_cierre DATE,
  observaciones TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_reporte_urgencia CHECK (urgencia IN ('CRITICA', 'ALTA', 'MEDIA', 'BAJA')),
  CONSTRAINT chk_reporte_estatus CHECK (estatus IN ('REPORTADO', 'EN_REPARACION', 'ESPERANDO_REFACCION', 'ATENDIDO', 'CANCELADO'))
);

CREATE INDEX IF NOT EXISTS idx_reportes_vehiculo_fecha
  ON reportes_vehiculares(id_vehiculo, fecha_reporte DESC);

CREATE INDEX IF NOT EXISTS idx_reportes_estatus
  ON reportes_vehiculares(estatus, creado_en DESC);

CREATE OR REPLACE FUNCTION generar_folio_reporte()
RETURNS TRIGGER AS $$
DECLARE
    year_str TEXT;
    seq_num INT;
BEGIN
    IF NEW.folio IS NULL OR NEW.folio = '' THEN
        year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
        SELECT COALESCE(MAX(id_reporte), 0) + 1 INTO seq_num FROM reportes_vehiculares;
        NEW.folio := 'REP-' || year_str || '-' || LPAD(seq_num::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generar_folio_reporte ON reportes_vehiculares;
CREATE TRIGGER trg_generar_folio_reporte
BEFORE INSERT ON reportes_vehiculares
FOR EACH ROW
EXECUTE FUNCTION generar_folio_reporte();

COMMIT;
