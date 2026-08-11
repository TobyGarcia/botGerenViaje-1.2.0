BEGIN;
ALTER TABLE conductores ADD COLUMN IF NOT EXISTS empresa VARCHAR(20);
ALTER TABLE conductores DROP CONSTRAINT IF EXISTS chk_conductores_empresa;
ALTER TABLE conductores ADD CONSTRAINT chk_conductores_empresa
  CHECK (empresa IS NULL OR empresa IN ('ITZAMNA','MCCLICK','AQUARIO','ASPROMEX','BALAM','AGROKOOL'));
COMMIT;
