BEGIN;
CREATE TABLE IF NOT EXISTS viaje_inspeccion_uso (
  id_viajes INTEGER PRIMARY KEY REFERENCES viajes(id_viajes) ON DELETE CASCADE,
  id_inspeccion INTEGER NOT NULL REFERENCES inspecciones_vehiculares(id_inspeccion) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS viaje_inspeccion_uso_inspeccion_idx ON viaje_inspeccion_uso(id_inspeccion);

-- Los permisos offline conservan la inspección exacta usada al iniciar.
INSERT INTO viaje_inspeccion_uso(id_viajes,id_inspeccion)
SELECT id_viajes,id_inspeccion FROM viajes_offline ON CONFLICT DO NOTHING;

-- Recuperar viajes anteriores al registro explícito. No cruzar conductor,
-- unidad, fecha operativa ni una utilización posterior por otro conductor.
INSERT INTO viaje_inspeccion_uso(id_viajes,id_inspeccion)
SELECT v.id_viajes, elegida.id_inspeccion FROM viajes v
JOIN LATERAL (
  SELECT i.id_inspeccion FROM inspecciones_vehiculares i
  WHERE i.id_vehiculos=v.id_vehiculos AND i.id_conductores=v.id_conductores
    AND i.fecha_operativa=(v.hora_salida + INTERVAL '2 hours')::date
    AND i.creado_en <= v.hora_salida
    AND i.estado IN ('APROBADA','PENDIENTE_APROBACION')
    AND NOT EXISTS (SELECT 1 FROM viajes otro
      WHERE otro.id_vehiculos=v.id_vehiculos AND otro.id_conductores<>v.id_conductores
        AND otro.hora_salida>i.creado_en AND otro.hora_salida<v.hora_salida)
  ORDER BY i.creado_en DESC,i.id_inspeccion DESC LIMIT 1
) elegida ON TRUE
WHERE v.hora_salida IS NOT NULL ON CONFLICT DO NOTHING;
COMMIT;
