BEGIN;

-- Conservamos datos legibles para el historial antes de desvincular el catálogo.
ALTER TABLE viajes
  ADD COLUMN IF NOT EXISTS conductor_nombre_historico VARCHAR(150),
  ADD COLUMN IF NOT EXISTS vehiculo_nombre_historico VARCHAR(150),
  ADD COLUMN IF NOT EXISTS vehiculo_numero_economico_historico VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vehiculo_placas_historico VARCHAR(20);

UPDATE viajes v
SET conductor_nombre_historico = COALESCE(v.conductor_nombre_historico, c.nombre)
FROM conductores c
WHERE c.id_conductores = v.id_conductores;

UPDATE viajes v
SET vehiculo_nombre_historico = COALESCE(v.vehiculo_nombre_historico, vh.nombre),
    vehiculo_numero_economico_historico = COALESCE(v.vehiculo_numero_economico_historico, vh.numero_economico),
    vehiculo_placas_historico = COALESCE(v.vehiculo_placas_historico, vh.placas)
FROM vehiculos vh
WHERE vh.id_vehiculos = v.id_vehiculos;

ALTER TABLE viajes ALTER COLUMN id_conductores DROP NOT NULL;
ALTER TABLE viajes ALTER COLUMN id_vehiculos DROP NOT NULL;
ALTER TABLE viajes DROP CONSTRAINT IF EXISTS fk_viaje_conductor;
ALTER TABLE viajes DROP CONSTRAINT IF EXISTS fk_viaje_vehiculo;
ALTER TABLE viajes ADD CONSTRAINT fk_viaje_conductor
  FOREIGN KEY (id_conductores) REFERENCES conductores(id_conductores) ON DELETE SET NULL;
ALTER TABLE viajes ADD CONSTRAINT fk_viaje_vehiculo
  FOREIGN KEY (id_vehiculos) REFERENCES vehiculos(id_vehiculos) ON DELETE SET NULL;

-- El usuario de Telegram pertenece al conductor y se elimina con él.
ALTER TABLE usuarios_telegram DROP CONSTRAINT IF EXISTS fk_usuario_telegram_conductor;
ALTER TABLE usuarios_telegram ADD CONSTRAINT fk_usuario_telegram_conductor
  FOREIGN KEY (id_conductores) REFERENCES conductores(id_conductores) ON DELETE CASCADE;

-- La evidencia de inspección y kilometraje permanece, pero queda desvinculada.
ALTER TABLE inspecciones_vehiculares ALTER COLUMN id_conductores DROP NOT NULL;
ALTER TABLE inspecciones_vehiculares ALTER COLUMN id_vehiculos DROP NOT NULL;
ALTER TABLE inspecciones_vehiculares DROP CONSTRAINT IF EXISTS inspecciones_vehiculares_id_conductores_fkey;
ALTER TABLE inspecciones_vehiculares DROP CONSTRAINT IF EXISTS inspecciones_vehiculares_id_vehiculos_fkey;
ALTER TABLE inspecciones_vehiculares ADD CONSTRAINT inspecciones_vehiculares_id_conductores_fkey
  FOREIGN KEY (id_conductores) REFERENCES conductores(id_conductores) ON DELETE SET NULL;
ALTER TABLE inspecciones_vehiculares ADD CONSTRAINT inspecciones_vehiculares_id_vehiculos_fkey
  FOREIGN KEY (id_vehiculos) REFERENCES vehiculos(id_vehiculos) ON DELETE SET NULL;

ALTER TABLE historial_kilometraje_vehiculos ALTER COLUMN id_vehiculos DROP NOT NULL;
ALTER TABLE historial_kilometraje_vehiculos DROP CONSTRAINT IF EXISTS historial_kilometraje_vehiculos_id_vehiculos_fkey;
ALTER TABLE historial_kilometraje_vehiculos ADD CONSTRAINT historial_kilometraje_vehiculos_id_vehiculos_fkey
  FOREIGN KEY (id_vehiculos) REFERENCES vehiculos(id_vehiculos) ON DELETE SET NULL;

COMMIT;
