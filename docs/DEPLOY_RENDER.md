# Migración a Render

Esta guía prepara el proyecto `gerenciamiento-viajes` para Render sin depender
de Docker Desktop, ngrok ni del volumen local de PostgreSQL.

> Estado revisado: el proyecto tiene `backend` (Express + Telegraf), `frontend`
> (Mini App), `panel-admin` (React + nginx) y PostgreSQL. Los dos frontends
> actuales usan nginx para enviar `/api` a `backend:3000`.

## Arquitectura recomendada

Desplegar los siguientes recursos en la **misma región** y workspace de Render:

```text
Telegram ── HTTPS ──> mini-app (Web Service Docker)
                           │ /api
                           ▼
panel-admin (Web Service Docker) ──> backend (Web Service o Private Service)
                                           │
                                           ▼
                                    Render PostgreSQL
```

| Recurso | Tipo recomendado | Motivo |
| --- | --- | --- |
| `viajes-db` | Render PostgreSQL | Reemplaza el contenedor y volumen local. |
| `viajes-backend` | Web Service Docker, 1 instancia | Expone healthcheck y ejecuta el bot por long polling. También puede ser Private Service si no se requiere exponer su API directamente. |
| `viajes-mini-app` | Web Service Docker | Conserva nginx y el proxy `/api` del mismo origen. |
| `viajes-panel-admin` | Web Service Docker | Conserva nginx, `/api` y la cookie HTTP-only en el mismo origen. |
| `ngrok` | **No desplegar** | Render ya aporta URL HTTPS pública y dominios propios. |

No se recomienda desplegar `frontend` ni `panel-admin` como Static Sites con la
configuración actual: los Static Sites no pertenecen a la red privada de Render
y, por tanto, no pueden usar el proxy nginx hacia el backend interno.

## Cambios obligatorios antes del primer deploy

### 1. Puerto del backend

Actualmente `backend/src/server.js` lee solo `BACKEND_PORT`. Render proporciona
`PORT`; el backend debe priorizarlo:

```js
const port = Number(process.env.PORT || process.env.BACKEND_PORT || 3000);
```

Mantener el bind en `0.0.0.0`, que ya existe. En Render se puede definir
`PORT=3000` para conservar el puerto interno esperado por nginx; no usar
`localhost`.

### 2. Dockerfile de producción del backend

El `backend/Dockerfile` ejecuta actualmente `npm run dev` (nodemon). Para
producción debe terminar con:

```dockerfile
CMD ["npm", "start"]
```

No montar `./backend/src:/app/src` en Render; ese volumen es exclusivamente de
desarrollo local.

### 3. Proxy nginx configurable en tiempo de ejecución

Los archivos `frontend/nginx.conf` y `panel-admin/nginx.conf` contienen
`proxy_pass http://backend:3000`. En Render, el hostname privado contiene un
sufijo y no se debe adivinar.

Convertirlos en plantillas nginx (por ejemplo,
`nginx.conf.template`) y usar el mecanismo `envsubst` de la imagen oficial
nginx. La ruta debe quedar conceptualmente así:

```nginx
location /api/ {
    proxy_pass http://${BACKEND_HOSTPORT}/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Para la Mini App, conservar su semántica actual de ruta (`/api/` no debe perder
el prefijo). Revisar el resultado con `nginx -T` en el contenedor antes de
publicar. En el Blueprint, `BACKEND_HOSTPORT` se obtiene con `fromService` y la
propiedad `hostport`.

### 4. Cookies administrativas

El panel usa solicitudes a `/api` con `credentials: "include"` y nginx mantiene
esa ruta bajo el **mismo dominio del panel**. Esto evita CORS cruzado y permite
mantener `sameSite: "lax"`.

En producción configurar:

```env
ADMIN_COOKIE_SECURE=true
```

No cambiar a `SameSite=None` salvo que el navegador vaya a llamar al backend en
otro dominio, lo cual esta arquitectura evita. No exponer el backend al
navegador como URL de API si se conserva el proxy de nginx.

### 5. Bot de Telegram

El proceso backend inicia Telegraf junto con Express. Por eso debe ejecutarse
con **una sola instancia**; múltiples réplicas compiten por el long polling.
Un despliegue o reinicio puede dejar una ventana breve sin recibir mensajes.
La alternativa futura es migrar el bot a webhooks, pero no es necesaria para el
primer despliegue.

## Variables de entorno

Configurar secretos en el Dashboard de Render o con `sync: false` en el
Blueprint. Nunca subir `.env`, tokens ni contraseñas al repositorio.

### Backend

| Variable | Fuente/valor en Render |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `3000` (o el puerto elegido y consistente con el proxy) |
| `DATABASE_URL` | `fromDatabase.connectionString` del PostgreSQL interno |
| `TZ` | `America/Mexico_City` |
| `TELEGRAM_BOT_TOKEN` | secreto existente |
| `TELEGRAM_WEB_APP_URL` | URL HTTPS pública final de `viajes-mini-app` |
| `TELEGRAM_GROUP_ID` | secreto/configuración existente |
| `TELEGRAM_BOT_USERNAME` | nombre del bot |
| `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` | `3600` o valor actual |
| `ADMIN_JWT_SECRET` | secreto aleatorio de alta entropía |
| `ADMIN_JWT_EXPIRES_IN` | `8h` o política elegida |
| `ADMIN_COOKIE_NAME` | `admin_session` o valor actual |
| `ADMIN_COOKIE_SECURE` | `true` |
| `ADMIN_LOGIN_MAX_ATTEMPTS` | valor actual |
| `ADMIN_LOGIN_BLOCK_MINUTES` | valor actual |

### Mini App y panel

Los dos servicios nginx necesitan:

| Variable | Origen |
| --- | --- |
| `BACKEND_HOSTPORT` | `fromService` del backend, propiedad `hostport` |

El navegador no debe recibir `DATABASE_URL`, token de Telegram, JWT secret ni
las variables `NGROK_*`.

### Variables que no se usan en Render

No configurar ni desplegar `NGROK_AUTHTOKEN`, `NGROK_DOMAIN`,
`NGROK_MINI_APP_DOMAIN`, `NGROK_ADMIN_DOMAIN`, puertos publicados de Docker ni
credenciales `POSTGRES_*` locales. Render PostgreSQL provee su propia cadena de
conexión privada.

## Migración de la base de datos

1. Crear una instancia Render PostgreSQL en la misma región que los servicios.
2. Generar un respaldo de la base local **antes** de cambiar nada:

   ```powershell
   pg_dump --format=custom --no-owner --no-acl `
     --host localhost --port 5433 --username viajes_user `
     --dbname gerenciamiento_viajes `
     --file respaldo-gerenciamiento-viajes.dump
   ```

3. Obtener la URL **externa** temporal de la nueva base desde Render y restaurar
   desde una máquina autorizada:

   ```powershell
   pg_restore --no-owner --no-acl `
     --dbname "URL_EXTERNA_DE_RENDER" `
     respaldo-gerenciamiento-viajes.dump
   ```

   Restaurar sobre una instancia Render nueva y vacía. Ejecutar estos comandos
   solo cuando se haya aprobado la restauración. El respaldo no se elimina y no
   se debe ejecutar `DROP`, `TRUNCATE` ni borrar el volumen local como parte del
   despliegue.

4. Validar conteos de `viajes`, `ubicaciones_viaje`,
   `historial_kilometraje_vehiculos`, `usuarios_admin` y `usuarios_telegram`.
5. Las migraciones nuevas se aplican una sola vez, en orden, mediante un job o
   Shell de Render. No volver a ejecutar indiscriminadamente
   `database/scripts/migrate.sql` contra una base ya inicializada, porque las
   primeras migraciones no fueron diseñadas como inicialización repetible.
6. Actualizar `DATABASE_URL` del backend para usar exclusivamente la cadena
   **interna** de Render tras la restauración.

## Blueprint de referencia

Guardar esta plantilla como `render.yaml` solo después de realizar los cambios
de puerto y nginx descritos arriba. No contiene secretos ni dominios reales.

```yaml
services:
  - type: web
    name: viajes-backend
    runtime: docker
    region: oregon
    dockerfilePath: ./backend/Dockerfile
    dockerContext: ./backend
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "3000"
      - key: DATABASE_URL
        fromDatabase:
          name: viajes-db
          property: connectionString
      - key: TZ
        value: America/Mexico_City
      - key: TELEGRAM_BOT_TOKEN
        sync: false
      - key: TELEGRAM_WEB_APP_URL
        sync: false
      - key: TELEGRAM_GROUP_ID
        sync: false
      - key: TELEGRAM_BOT_USERNAME
        sync: false
      - key: ADMIN_JWT_SECRET
        generateValue: true
      - key: ADMIN_COOKIE_SECURE
        value: "true"

  - type: web
    name: viajes-mini-app
    runtime: docker
    region: oregon
    dockerfilePath: ./frontend/Dockerfile
    dockerContext: ./frontend
    healthCheckPath: /health
    envVars:
      - key: BACKEND_HOSTPORT
        fromService:
          type: web
          name: viajes-backend
          property: hostport

  - type: web
    name: viajes-panel-admin
    runtime: docker
    region: oregon
    dockerfilePath: ./panel-admin/Dockerfile
    dockerContext: ./panel-admin
    healthCheckPath: /health
    envVars:
      - key: BACKEND_HOSTPORT
        fromService:
          type: web
          name: viajes-backend
          property: hostport

databases:
  - name: viajes-db
    region: oregon
    plan: standard
    postgresMajorVersion: "16"
```

Revisar en el Dashboard los planes y regiones disponibles antes de importar el
Blueprint. Si se crea el backend como `pserv` (Private Service), cambiar en los
dos `fromService.type` de `web` a `pserv`.

## Orden de despliegue

1. Subir el repositorio a GitHub/GitLab, sin `.env` ni respaldos.
2. Aplicar y probar localmente los cambios de `PORT`, `npm start` y plantillas
   nginx.
3. Crear Render PostgreSQL y realizar respaldo/restauración validada.
4. Crear backend, configurar variables y confirmar `GET /health`.
5. Crear Mini App y panel, inyectando `BACKEND_HOSTPORT` desde el backend.
6. Copiar la URL HTTPS final de la Mini App a `TELEGRAM_WEB_APP_URL` y
   actualizarla en BotFather si aplica.
7. Crear/validar un usuario administrador en la nueva base con el comando
   `npm run admin:create` desde Shell de Render o un proceso controlado.
8. Probar crear, iniciar, finalizar y cancelar un viaje; probar GPS, panel,
   cookie de sesión, historial de kilometraje y mensajes al grupo.
9. Solo después de las pruebas, cambiar el enlace productivo de Telegram.

## Lista de verificación de salida

- [ ] Backend sano en `/health` y con una sola instancia.
- [ ] Base de datos restaurada y conteos validados.
- [ ] Mini App HTTPS abre desde Telegram.
- [ ] Panel HTTPS inicia sesión y conserva la cookie tras recargar.
- [ ] `/api` funciona desde ambos frontends sin llamar a `localhost`.
- [ ] GPS se guarda y sincroniza; IndexedDB permanece del lado del cliente.
- [ ] Bot recibe actualizaciones y manda alertas al grupo.
- [ ] No existen secretos en Git ni en logs.
- [ ] Las URLs ngrok dejan de ser dependencia del entorno productivo.

## Referencias oficiales

- [Render Blueprints](https://render.com/docs/blueprint-spec)
- [Servicios web y puertos](https://render.com/docs/web-services)
- [Red privada de Render](https://render.com/docs/private-network)
- [Render PostgreSQL: conexión interna y externa](https://render.com/docs/postgresql-creating-connecting)
- [Variables de entorno y secretos](https://render.com/docs/configure-environment-variables)
