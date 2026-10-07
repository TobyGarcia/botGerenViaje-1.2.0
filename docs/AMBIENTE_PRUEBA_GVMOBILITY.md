# Ambiente de prueba — gvmobility.aspromex.mx

**Creado:** 2026-09-09
**Propósito:** probar la ubicación en vivo de Telegram y el nuevo tracking GPS
sin tocar producción (`gv.aspromex.mx`).

---

## 1. Arquitectura

Corre en el mismo servidor que producción, con contenedores, puertos y base de
datos propios. **Reutiliza la instancia de Postgres** de producción contra una
base distinta, lo que ahorra memoria sin mezclar datos.

| Componente | Producción | Prueba |
|---|---|---|
| Dominio | `gv.aspromex.mx` | `gvmobility.aspromex.mx` |
| Compose | `compose.prod.yml` | `compose.staging.yml` |
| Proyecto docker | `botgerenviaje-120` | `gvmobility` |
| Backend | `viajes-backend` :3001 | `gvmobility-backend` :3002 |
| Frontend | `viajes-frontend` :8080 | `gvmobility-frontend` :8082 |
| Panel admin | `viajes-panel-admin` :8081 | `gvmobility-panel-admin` :8083 |
| Base de datos | `gerenciamiento_viajes_prod` | `gerenciamiento_viajes_stg` |
| Usuario BD | `viajes_admin_prod` | `viajes_stg` |
| Postgres | `viajes-postgres` (compartido) | `viajes-postgres` (compartido) |

Ambos stacks comparten la red docker `viajes_network_prod`; el compose de prueba
la declara como externa para alcanzar `viajes-postgres`.

### Aislamiento de datos

El usuario `viajes_stg` **no puede leer ni escribir las tablas de producción**
(verificado: `permission denied for table viajes`). Sí puede abrir una conexión
a la base de producción, porque Postgres concede `CONNECT` a `PUBLIC` por
omisión, pero sin acceso a ningún dato. Revocar ese `CONNECT` exigiría tocar
permisos de `PUBLIC` en producción, con riesgo para otros roles, así que se dejó
la protección a nivel de tabla.

### Datos cargados

La base de prueba se creó con `pg_dump --schema-only` de producción —no con
`migrate.sql`, que hoy está roto (ver sección 5)— más los datos mínimos para
operar:

| Tabla | Filas |
|---|---|
| conductores | 9 |
| estados_viaje | 6 |
| lugares | 12 |
| usuarios_admin | 11 |
| usuarios_telegram | 7 |
| vehiculos | 20 |

**Sin historial operativo**: `viajes`, `ubicaciones_viaje`, `inspecciones_vehiculares`
e historiales quedaron vacíos, para que las pruebas partan de cero.

---

## 2. Lo que falta antes de levantarlo

Tres cosas requieren acción manual.

### a) Registro DNS

`gvmobility.aspromex.mx` no resuelve. Necesita un registro A al mismo destino
que `gv.aspromex.mx` (la instancia EC2, `172.31.3.5` en la red interna).

### b) Bots nuevos de Telegram — **crítico**

**No reutilices los tokens de producción.** Dos procesos haciendo `getUpdates`
con el mismo token provocan un 409 en Telegram y el bot de producción deja de
responder. El propio código lo advierte en `backend/src/server.js`.

Crea en BotFather dos bots nuevos y registra sus Mini Apps:

- Bot conductor → `https://gvmobility.aspromex.mx/conductor`
- Bot supervisor → `https://gvmobility.aspromex.mx/supervisor`

Luego completa en `.env.staging`: `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_BOT_USERNAME`, `TELEGRAM_SUPERVISOR_BOT_TOKEN` y
`TELEGRAM_SUPERVISOR_BOT_USERNAME`.

Estos campos se generaron **vacíos a propósito**: con el token en blanco el bot
no arranca el polling, así que un arranque accidental no puede chocar con
producción.

Lo mismo aplica a `TELEGRAM_GROUP_ID` y `TELEGRAM_GROUP_SUPRVISOR_ID`, también
vacíos para que las pruebas no manden avisos a los grupos reales. Rellénalos solo
si creas grupos de prueba.

### c) Nginx y certificado (requiere sudo)

```bash
sudo cp deploy/nginx/gvmobility.aspromex.mx.conf /etc/nginx/sites-available/gvmobility.aspromex.mx
sudo ln -s /etc/nginx/sites-available/gvmobility.aspromex.mx /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d gvmobility.aspromex.mx
```

Certbot agrega el bloque `listen 443` y la redirección desde el puerto 80, igual
que en `gv.aspromex.mx`. **El DNS debe resolver antes**, o la validación falla.

---

## 3. Levantar y bajar el ambiente

```bash
docker compose -f compose.staging.yml --env-file .env.staging -p gvmobility up -d --build
```

```bash
docker compose -f compose.staging.yml --env-file .env.staging -p gvmobility down
```

El flag `-p gvmobility` mantiene el proyecto separado: ningún comando sobre el
ambiente de prueba puede afectar a los contenedores de producción.

Verificación:

```bash
docker ps --filter name=gvmobility- --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3002/health
```

---

## 4. Eliminar el ambiente por completo

```bash
docker compose -f compose.staging.yml --env-file .env.staging -p gvmobility down --rmi local
docker exec viajes-postgres psql -U viajes_admin_prod -d postgres -c "DROP DATABASE gerenciamiento_viajes_stg;"
docker exec viajes-postgres psql -U viajes_admin_prod -d postgres -c "DROP USER viajes_stg;"
sudo rm /etc/nginx/sites-enabled/gvmobility.aspromex.mx && sudo systemctl reload nginx
```

Nada de esto toca producción.

---

## 5. Advertencia: `migrate.sql` está roto

`database/scripts/migrate.sql` invoca cuatro migraciones que **no existen** en el
repositorio ni en el historial de git: `020_conductor_pin_and_approval.sql`,
`021_reportes_vehiculares.sql`, `022_licencia_imagen.sql` y
`023_gerenciamiento_sharepoint_and_pdf.sql`. Sus cambios sí están aplicados en la
base de producción.

**Causa raíz:** `.gitignore` tenía la regla `*.sql`, que dejaba fuera de git toda
migración nueva sin avisar. Ya se corrigió agregando excepciones para
`database/migrations`, `scripts` y `seeds`.

Por eso la base de prueba se creó desde un dump del esquema real y no corriendo
las migraciones. Reconstruir esos cuatro archivos sigue pendiente y es un
requisito para desplegar en AWS desde este repositorio.
