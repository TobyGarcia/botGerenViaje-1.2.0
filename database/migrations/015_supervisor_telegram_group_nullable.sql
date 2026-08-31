BEGIN;

ALTER TABLE accesos_supervisor_telegram
  ALTER COLUMN telegram_group_id DROP NOT NULL;

COMMIT;
