# Exportación y migración de base de datos al servicio

## Objetivo

Este procedimiento traslada la base PostgreSQL local de Gerenciamiento de Viajes a un servicio de PostgreSQL administrado, como Render PostgreSQL, sin perder datos y con posibilidad de validación y reversión.

Aplica a las tablas de catálogos, viajes, ubicaciones GPS, historiales, usuarios de Telegram y usuarios administrativos.

> Importante: la exportación no modifica la base local. La restauración sí escribe en el servicio destino. Ejecutarla únicamente sobre una base nueva/vacía o tras contar con autorización y un respaldo verificable.

## Estado revisado del proyecto

- PostgreSQL local se expone normalmente en `localhost:5433` desde Docker Compose.
- La base local usa las variables `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD` definidas en `.env`.
- Las migraciones están en `database/migrations/` y el script [migrate.sql](../database/scripts/migrate.sql) incluye las migraciones 001 a 005.
- Los datos semilla están en `database/seeds/`; no se aplican al migrar una base que ya contiene datos reales.
- Existe un respaldo con extensión `.dump` en la raíz del proyecto. Los respaldos pueden contener información sensible y no deben versionarse en Git ni compartirse sin cifrado.

## Estrategia recomendada

Para una base existente con información real, usar una restauración completa:

```text
Base local → pg_dump (formato custom) → archivo .dump cifrado/resguardado
 → pg_restore → PostgreSQL del servicio → validación → backend productivo
```

El formato `custom` de `pg_dump` es recomendado porque permite inspección, restauración detallada y mayor control con `pg_restore`.

Para un servicio totalmente nuevo sin datos locales, no se restaura ningún dump: se ejecutan las migraciones 001–005 y, solo para desarrollo, los seeds.

## 1. Preparación previa

Antes de exportar, confirmar:

- El servicio destino está creado, vacío y en la misma región que el backend.
- Se tiene acceso a la URL externa temporal del servicio. La URL interna se usará posteriormente por el backend desplegado.
- `pg_dump` y `pg_restore` son de una versión compatible con PostgreSQL 16 o superior.
- Se dispone de espacio local suficiente para el archivo de respaldo.
- No hay una migración o carga masiva ejecutándose durante el corte.
- Se eligió una ventana de mantenimiento si el sistema está siendo usado.

### Variables de trabajo seguras

En PowerShell, cargar valores sin escribir contraseñas en comandos, historial o documentación:

```powershell
$env:PGPASSWORD = "CONTRASENA_LOCAL"
$origenHost = "localhost"
$origenPort = "5433"
$origenDb = "gerenciamiento_viajes"
$origenUser = "viajes_user"
$archivoRespaldo = "C:\ruta-segura\viajes-YYYYMMDD-HHMM.dump"
```

Como alternativa, usar un archivo `pgpass.conf` con permisos adecuados. Al terminar, cerrar la consola o limpiar la variable `PGPASSWORD`:

```powershell
Remove-Item Env:PGPASSWORD
```

No guardar el respaldo dentro del repositorio. Se recomienda añadir `*.dump` y `*.backup` al `.gitignore` si aún no están excluidos.

## 2. Verificación del origen

Iniciar PostgreSQL local y confirmar conectividad:

```powershell
docker compose up -d postgres
docker compose exec -T postgres pg_isready -U viajes_user -d gerenciamiento_viajes
```

Registrar los conteos que servirán para validar la restauración. Ejecutar desde el contenedor evita depender de una instalación local de `psql`:

```powershell
docker compose exec -T postgres psql -U viajes_user -d gerenciamiento_viajes -c "
SELECT
  (SELECT COUNT(*) FROM conductores) AS conductores,
  (SELECT COUNT(*) FROM vehiculos) AS vehiculos,
  (SELECT COUNT(*) FROM lugares) AS lugares,
  (SELECT COUNT(*) FROM viajes) AS viajes,
  (SELECT COUNT(*) FROM ubicaciones_viaje) AS ubicaciones,
  (SELECT COUNT(*) FROM historial_estados_viaje) AS historial_estados,
  (SELECT COUNT(*) FROM historial_kilometraje_vehiculos) AS historial_kilometraje,
  (SELECT COUNT(*) FROM usuarios_telegram) AS usuarios_telegram,
  (SELECT COUNT(*) FROM usuarios_admin) AS usuarios_admin;
"
```

Guardar el resultado junto con la fecha/hora del respaldo. No incluir contraseñas ni tokens en esa evidencia.

## 3. Exportar la base local

Desde una máquina que tenga las herramientas PostgreSQL instaladas, ejecutar:

```powershell
pg_dump --format=custom --verbose --no-owner --no-acl `
  --host $origenHost --port $origenPort `
  --username $origenUser --dbname $origenDb `
  --file $archivoRespaldo
```

Opciones utilizadas:

| Opción | Motivo |
|---|---|
| `--format=custom` | Produce un archivo manejable por `pg_restore`. |
| `--no-owner` | Evita restaurar propietarios locales inexistentes en el servicio. |
| `--no-acl` | Evita restaurar permisos locales no aplicables al proveedor. |
| `--verbose` | Deja evidencia útil ante un fallo. |

Comprobar que el dump no está dañado:

```powershell
pg_restore --list $archivoRespaldo
```

El listado debe mostrar tablas, datos, índices y restricciones. Conservar una copia de ese archivo en almacenamiento seguro y, si sale de la máquina local, cifrarlo antes de transferirlo.

## 4. Crear y preparar el servicio destino

### Render PostgreSQL

1. Crear una instancia PostgreSQL 16 en la misma región donde se desplegará el backend.
2. Esperar a que figure disponible.
3. Copiar temporalmente su **External Database URL** para la restauración desde el equipo local.
4. Conservar su **Internal Database URL** para configurar `DATABASE_URL` del backend ya desplegado.

La URL externa se usa solo durante la migración desde fuera de la red privada del proveedor. No debe insertarse en el repositorio, frontend ni logs.

### Otro proveedor o VPS

Crear una base PostgreSQL 16 compatible, con una base vacía y un usuario con permisos para crear esquema, tablas, datos, índices y restricciones. Asegurar conexión TLS cuando la red lo requiera.

## 5. Restaurar en el servicio

Definir la URL externa del destino solamente en la sesión de consola:

```powershell
$destinoUrl = "postgresql://USUARIO:CONTRASENA@HOST:PUERTO/BASE?sslmode=require"
```

Ejecutar la restauración sobre el servicio vacío:

```powershell
pg_restore --verbose --no-owner --no-acl `
  --dbname $destinoUrl `
  $archivoRespaldo
```

No usar `--clean` ni `--create` en una primera migración a producción salvo que se haya aprobado explícitamente el borrado/recreación del destino. Esos parámetros pueden eliminar objetos existentes.

Al finalizar, comprobar conectividad sin mostrar la cadena:

```powershell
psql $destinoUrl -c "SELECT current_database(), version();"
```

## 6. Validación posterior

Ejecutar en el destino los mismos conteos del origen:

```powershell
psql $destinoUrl -c "
SELECT
  (SELECT COUNT(*) FROM conductores) AS conductores,
  (SELECT COUNT(*) FROM vehiculos) AS vehiculos,
  (SELECT COUNT(*) FROM lugares) AS lugares,
  (SELECT COUNT(*) FROM viajes) AS viajes,
  (SELECT COUNT(*) FROM ubicaciones_viaje) AS ubicaciones,
  (SELECT COUNT(*) FROM historial_estados_viaje) AS historial_estados,
  (SELECT COUNT(*) FROM historial_kilometraje_vehiculos) AS historial_kilometraje,
  (SELECT COUNT(*) FROM usuarios_telegram) AS usuarios_telegram,
  (SELECT COUNT(*) FROM usuarios_admin) AS usuarios_admin;
"
```

Además validar:

- Las cinco migraciones están representadas: la columna `client_location_id` existe y la tabla `historial_kilometraje_vehiculos` existe.
- Existen índices e integridad referencial.
- Hay un usuario administrativo activo que puede iniciar sesión.
- Los viajes conservan sus referencias a conductor, vehículo, origen, destino y estado.
- El backend de staging se conecta usando la URL interna del servicio y responde en `/health`.

Consulta básica de estructura:

```powershell
psql $destinoUrl -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
"
```

Si los conteos difieren, detener el cambio de `DATABASE_URL`, conservar el dump y revisar el log de `pg_restore` antes de ejecutar otra acción.

## 7. Aplicación de migraciones futuras

Una vez migrada la base, los cambios posteriores se realizan con nuevas migraciones, no restaurando el dump completo.

Flujo por cada versión:

1. Crear `database/migrations/00N_descripcion.sql`.
2. Añadirla a [migrate.sql](../database/scripts/migrate.sql) en el orden correcto.
3. Probarla en una copia de staging.
4. Hacer respaldo de producción.
5. Ejecutarla una vez en producción desde una consola o job controlado.
6. Validar el esquema y desplegar el backend compatible.

Ejemplo para una base recién creada desde el entorno Docker local:

```powershell
docker compose exec -T postgres psql -U viajes_user -d gerenciamiento_viajes -f /database/scripts/migrate.sql
```

Para el servicio administrado, ejecutar el mismo archivo desde un Shell/Job del proveedor o desde una máquina autorizada con `psql`. No ejecutar `seed.sql` sobre producción: contiene datos de ejemplo y puede generar inconsistencias.

## 8. Cambio de conexión y arranque de producción

Después de validar la restauración:

1. Configurar `DATABASE_URL` del backend con la URL **interna** del servicio de PostgreSQL.
2. No cambiar `DATABASE_URL` del frontend: el navegador debe hablar con `/api` a través de Nginx.
3. Desplegar una única instancia del backend y consultar `/health`.
4. Probar en staging y producción: login administrativo, catálogo, creación/inicio/finalización de viaje, GPS y consultas en panel.
5. Mantener la base local intacta hasta concluir la validación funcional y contar con aprobación de cierre.

## 9. Reversión y recuperación

Una restauración correcta no elimina automáticamente la base local. Si el servicio destino falla antes del cambio definitivo:

1. Mantener la aplicación apuntando a la base local o al último servicio confirmado.
2. No ejecutar comandos destructivos contra el destino sin aprobación.
3. Corregir la causa en staging y repetir la restauración solo sobre una instancia vacía nueva.

Para recuperar el servicio destino desde el dump, usar una base nueva/vacía y repetir la sección 5. Antes de una migración estructural futura, generar un dump nuevo y conservarlo con fecha, entorno y responsable.

## Lista de verificación

- [ ] Se documentaron conteos del origen y fecha de corte.
- [ ] Se creó un dump custom con `--no-owner --no-acl`.
- [ ] `pg_restore --list` verificó la integridad del archivo.
- [ ] El dump se guarda fuera de Git y en ubicación segura/cifrada.
- [ ] El servicio destino está vacío y se usó su URL externa solo para restaurar.
- [ ] La restauración terminó sin errores.
- [ ] Conteos, tablas, columna GPS e historial de kilometraje coinciden.
- [ ] El backend usa la URL interna del servicio.
- [ ] Las migraciones y seeds no se ejecutaron indiscriminadamente sobre datos restaurados.
- [ ] Se validó el flujo funcional completo antes del cambio final.
- [ ] Hay respaldo y plan de recuperación disponibles.

---

Última actualización: 2026-08-01.
