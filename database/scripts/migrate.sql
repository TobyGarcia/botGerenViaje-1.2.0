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
\ir ../migrations/010_eliminacion_fisica_catalogos_con_historial.sql
\ir ../migrations/011_empresa_conductor.sql
\ir ../migrations/012_color_y_personal_asignado_vehiculos.sql
\ir ../migrations/013_sharepoint_y_tenant_auth.sql
\ir ../migrations/014_manejo_comentado.sql
\ir ../migrations/015_supervisor_telegram_group_nullable.sql
\ir ../migrations/016_puntos_intermedios_viaje.sql
\ir ../migrations/017_inspeccion_dia_siguiente.sql
\ir ../migrations/018_gerenciamiento_viajes.sql
\ir ../migrations/019_fix_inspecciones_autorizador.sql
\ir ../migrations/020_conductor_pin_and_approval.sql





