\set ON_ERROR_STOP on

\ir ../migrations/001_initial_schema.sql
\ir ../migrations/002_usuarios_telegram.sql
\ir ../migrations/003_usuarios_admin.sql
\ir ../migrations/004_ubicaciones_cliente_idempotentes.sql
\ir ../migrations/005_historial_kilometraje_vehiculos.sql
\ir ../migrations/006_datos_y_disponibilidad_vehiculos.sql
\ir ../migrations/007_inspecciones_vehiculares.sql
\ir ../migrations/008_supervisores_telegram.sql
\ir ../migrations/009_roles_perfiles_y_conservacion_historial.sql
