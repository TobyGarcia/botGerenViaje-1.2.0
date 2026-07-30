# Base de datos / Database — Gerenciamiento de Viajes

## Objetivo y estado actual

Definición de esquema PostgreSQL, migraciones iniciales, datos semilla y scripts de ejecución con `psql`. PostgreSQL se ejecuta en Docker mediante la imagen `postgres:16-alpine`.

## Responsabilidades

- Crear el modelo relacional de viajes, catálogos, GPS y usuarios.
- Mantener las migraciones versionadas y seeds separados.
- Proporcionar scripts de inclusión ordenada para migrar y cargar seeds.

## Estructura relevante

```text
migrations/
  001_initial_schema.sql       tablas base, restricciones e índices
  002_usuarios_telegram.sql    usuarios vinculados a Telegram
  003_usuarios_admin.sql       personal administrativo
seeds/
  001_conductores.sql
  002_vehiculos.sql
  003_lugares.sql
  004_estados_viaje.sql
scripts/
  migrate.sql                  incluye las tres migraciones
  seed.sql                     incluye los cuatro seeds
```

## Tecnologías y dependencias

- PostgreSQL 16 Alpine (Docker).
- SQL PostgreSQL y `psql` (los scripts usan el meta-comando `\ir`).
- No existe `package.json` en este módulo.

## Variables de entorno

| Variable | Uso comprobado |
|---|---|
| `POSTGRES_DB` | Nombre de base de datos del contenedor. |
| `POSTGRES_USER` | Usuario PostgreSQL. |
| `POSTGRES_PASSWORD` | Contraseña PostgreSQL. |
| `DATABASE_URL` | Usada por backend para conectarse a esta base. |
| `TZ` | Zona horaria del contenedor; Compose fija `America/Mexico_City` para PostgreSQL. |

## Puertos y Docker

- Contenedor PostgreSQL: `5432`.
- Host: `5433:5432`.
- Volumen persistente: `postgres_data` (nombre `viajes_postgres_data`).
- Las carpetas `migrations`, `seeds` y `scripts` se montan como solo lectura en `/database`.

## Tablas y relaciones

| Tabla | Propósito |
|---|---|
| `conductores` | Datos, licencia, estado y teléfono de conductores. |
| `vehiculos` | Catálogo de vehículos y kilometraje. |
| `lugares` | Orígenes/destinos con coordenadas opcionales. |
| `estados_viaje` | Catálogo de estados de viaje. |
| `viajes` | Viajes con conductor, vehículo, origen, destino y estado. |
| `ubicaciones_viaje` | Muestras GPS de un viaje; se eliminan en cascada con el viaje. |
| `historial_estados_viaje` | Cambios de estado de cada viaje; se eliminan en cascada con el viaje. |
| `usuarios_telegram` | Identidad Telegram, estado de registro y vínculo único con conductor. |
| `usuarios_admin` | Credenciales hash, rol, actividad e intentos de acceso administrativos. |

`viajes` referencia a conductores, vehículos, lugares y estados; las migraciones también crean índices para consultas frecuentes de viajes, ubicaciones e historial.

## Flujo de funcionamiento

1. Compose inicia PostgreSQL y espera `pg_isready`.
2. `scripts/migrate.sql` incluye migraciones 001, 002 y 003 en ese orden.
3. `scripts/seed.sql` incluye los cuatro archivos de datos semilla.
4. Backend se conecta con `DATABASE_URL` y depende del healthcheck de PostgreSQL.

## Endpoints relacionados

La base no expone endpoints. Es consumida por el backend para catálogos, viajes, GPS, autenticación Telegram y administración de conductores/usuarios.

## Comandos

Desde la raíz:

```bash
docker compose up -d postgres
docker compose restart postgres
docker compose logs --tail=150 postgres
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /database/scripts/migrate.sql
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /database/scripts/seed.sql
```

Los dos últimos comandos modifican la base de datos y deben ejecutarse solo con autorización y en el entorno correcto.

## Pruebas realizadas

- Se revisaron migraciones, seeds, scripts y configuración Compose.
- El servicio PostgreSQL figuraba saludable mediante `docker compose ps` el 2026-07-30.
- No se ejecutaron migraciones ni seeds durante esta documentación.

## Problemas conocidos

- No se detectó una herramienta de migración con control de versión/estado más allá de scripts `psql`.
- No hay pruebas SQL automatizadas visibles.

## Próximos pasos pendientes

- Definir proceso controlado de ejecución y reversión de migraciones.
- Añadir pruebas de integridad y documentación de respaldos/restauración.

## Información pendiente de confirmar

- Entornos donde se permite ejecutar seeds.
- Política de respaldo, retención y recuperación del volumen PostgreSQL.

## Historial de cambios

- 2026-07-30: README técnico inicial creado a partir de migraciones, seeds y Compose.

╔══════════════════════════════════════╗
║     GERENCIAMIENTO DE VIAJES         ║
║        Desarrollo Itzamná            ║
╚══════════════════════════════════════╝
