# Migración de pruebas a Render: plan gratuito y sin Blueprints

Esta guía usa únicamente el plan gratuito de Render y crea cada recurso manualmente desde el panel. No necesitas Docker, ngrok ni Blueprints.

Se desplegarán estos cuatro recursos:

1. Una base de datos PostgreSQL gratuita.
2. Un Web Service gratuito para la API Node.js y el bot de Telegram.
3. Un Static Site gratuito para la Mini App.
4. Un Static Site gratuito para el panel administrativo.

## Límites importantes del plan gratuito

Esta configuración es adecuada para pruebas de producción, demostraciones y desarrollo; no para operación definitiva.

- La API se suspende después de 15 minutos sin recibir tráfico. La siguiente visita tarda aproximadamente un minuto mientras vuelve a iniciar.
- Cada espacio de trabajo dispone de 750 horas gratuitas de Web Service al mes. Los dos sitios estáticos no consumen horas de instancia.
- La base PostgreSQL gratuita tiene 1 GB, no incluye respaldos administrados y vence 30 días después de crearla. Después hay 14 días de gracia antes de que Render elimine los datos.
- La API y la base pueden reiniciarse sin previo aviso. Conserva siempre una copia del respaldo fuera de Render.

## Antes de iniciar

1. Sube el proyecto a un repositorio privado de GitHub. No incluyas `.env`, `admin-cookies.txt` ni `respaldo-gerenciamiento-viajes.dump`.
2. Confirma que la rama de pruebas contiene los cambios de migración.
3. Guarda una copia segura de `respaldo-gerenciamiento-viajes.dump`. La usarás para cargar los datos de prueba y para recuperar la base si vence.
4. Crea todos los recursos en la misma región de Render; selecciona **Oregon** si no tienes otra preferencia.

## 1. Crear PostgreSQL gratis

1. En Render selecciona **New > Postgres**.
2. Asigna estos valores:
   - **Name:** `gerenciamiento-viajes-db`
   - **Database:** `gerenciamiento_viajes`
   - **User:** `viajes_user`
   - **Region:** Oregon (o la misma que usarás después)
   - **Instance Type:** Free
3. Pulsa **Create Database** y espera a que esté disponible.
4. En la página de la base, abre **Connect**. Conserva la **Internal Database URL** para el backend y la **External Database URL** solo para importación y administración desde tu computadora. Nunca subas ninguna de esas URLs al repositorio.

## 2. Importar el esquema y los datos

En PowerShell, desde la carpeta raíz del proyecto, usa la **External Database URL**. Elige solo una opción.

### Opción A: restaurar el respaldo existente

```powershell
pg_restore --no-owner --no-privileges --dbname "PEGA_AQUI_LA_EXTERNAL_DATABASE_URL" .\respaldo-gerenciamiento-viajes.dump
```

### Opción B: crear una base limpia con catálogos

```powershell
$env:DATABASE_URL = "PEGA_AQUI_LA_EXTERNAL_DATABASE_URL"
psql $env:DATABASE_URL -f .\database\scripts\migrate.sql
psql $env:DATABASE_URL -f .\database\scripts\seed.sql
```

Si no tienes `pg_restore` o `psql`, instala las herramientas de PostgreSQL o usa pgAdmin con esa misma URL externa. Comprueba que existen las tablas `viajes`, `usuarios_admin` y los catálogos antes de continuar.

## 3. Crear la API y bot de Telegram

1. En Render selecciona **New > Web Service** y conecta tu repositorio de GitHub.
2. Configura:
   - **Name:** `gerenciamiento-viajes-api`
   - **Region:** la misma que la base de datos
   - **Branch:** tu rama de pruebas
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm ci`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
3. En **Advanced**, añade el Health Check Path: `/health`.
4. En **Environment Variables**, agrega las siguientes variables. Render ya proporciona `PORT`; no la agregues manualmente.

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | La **Internal Database URL** de la base creada en el paso 1 |
| `ADMIN_JWT_SECRET` | Una cadena larga y aleatoria, que no reutilices en otro servicio |
| `ADMIN_COOKIE_SECURE` | `true` |
| `ADMIN_COOKIE_SAME_SITE` | `none` |
| `ADMIN_COOKIE_NAME` | `admin_session` |
| `ADMIN_JWT_EXPIRES_IN` | `8h` |
| `ADMIN_LOGIN_MAX_ATTEMPTS` | `5` |
| `ADMIN_LOGIN_BLOCK_MINUTES` | `15` |
| `CORS_ORIGINS` | Se completa en el paso 6 |
| `TELEGRAM_BOT_TOKEN` | Token actual del bot |
| `TELEGRAM_WEB_APP_URL` | Se completa en el paso 6 |
| `TELEGRAM_GROUP_ID` | Identificador actual del grupo, si se usa |
| `TELEGRAM_BOT_USERNAME` | Nombre del bot, si se usa |
| `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` | `3600` |

5. Pulsa **Create Web Service**. Cuando termine, abre `https://TU_API.onrender.com/health`. Debe indicar `status: "ok"` y `database.connected: true`.

## 4. Crear la Mini App gratuita

1. Selecciona **New > Static Site** y conecta el mismo repositorio.
2. Configura:
   - **Name:** `gerenciamiento-viajes-miniapp`
   - **Branch:** tu rama de pruebas
   - **Root Directory:** `frontend`
   - **Build Command:** `npm ci && npm run build`
   - **Publish Directory:** `dist`
3. En Environment agrega:

| Variable | Valor |
| --- | --- |
| `VITE_API_BASE_URL` | URL pública de la API, por ejemplo `https://gerenciamiento-viajes-api.onrender.com` |
| `VITE_GPS_TRACKING_INTERVAL_MS` | `30000` |
| `VITE_GPS_SYNC_BATCH_SIZE` | `100` |

4. Crea el sitio. Al terminar, copia su URL pública; la necesitarás en los pasos 6 y 7.

## 5. Crear el panel administrativo gratuito

1. Selecciona **New > Static Site** y conecta el mismo repositorio.
2. Configura:
   - **Name:** `gerenciamiento-viajes-admin`
   - **Branch:** tu rama de pruebas
   - **Root Directory:** `panel-admin`
   - **Build Command:** `npm ci && npm run build`
   - **Publish Directory:** `dist`
3. En Environment agrega `VITE_API_BASE_URL` con la misma URL pública de la API, sin `/api` ni barra final. El panel añade el prefijo `/api` internamente.
4. Crea el sitio y copia su URL pública.

## 6. Conectar los tres servicios

1. Abre **gerenciamiento-viajes-api > Environment**.
2. Cambia `CORS_ORIGINS` por las URLs de la Mini App y del panel, separadas por coma y sin barra final. Ejemplo:

```text
https://gerenciamiento-viajes-miniapp.onrender.com,https://gerenciamiento-viajes-admin.onrender.com
```

3. Cambia `TELEGRAM_WEB_APP_URL` por la URL HTTPS de la Mini App.
4. Guarda con **Save and deploy**.
5. En la Mini App y el panel verifica de nuevo `VITE_API_BASE_URL`: ambos deben usar exactamente el dominio público de la API, sin `/api` ni barra final. Si lo cambias, selecciona **Save, rebuild, and deploy**: esta variable queda integrada durante la compilación de Vite.

## 7. Ajustar Telegram y crear el primer administrador

1. En BotFather actualiza el botón o menú web para abrir exactamente la URL HTTPS de la Mini App.
2. Para una base limpia, crea el primer usuario administrativo desde tu computadora. Dentro de `backend`, configura temporalmente `DATABASE_URL` con la URL externa de la base y ejecuta `npm run admin:create`.
3. Abre la Mini App desde Telegram, registra una ubicación y verifica que se guarda.
4. Abre el panel, inicia sesión y recarga la página. La sesión debe mantenerse activa.

## 8. Lista final de pruebas

1. API: `/health` responde correctamente.
2. Mini App: carga conductores, vehículos y destinos.
3. Panel: inicio de sesión, recarga y cierre de sesión funcionan.
4. Viaje: crea un viaje, registra ubicación y finalízalo.
5. Telegram: confirma que llega la alerta al grupo, si configuraste uno.
6. Render: revisa **Logs** en la API; no deben aparecer errores de CORS, PostgreSQL ni Telegram.

## Mantenimiento sin costo

- Antes de que se cumplan los 30 días de la base gratuita, exporta una copia con `pg_dump` usando la URL externa y crea una base nueva para restaurarla. Hazlo con anticipación: Render no ofrece respaldo administrado en Free.
- Si la primera solicitud tarda alrededor de un minuto, es el arranque normal de una API gratuita suspendida. Para probar, primero abre `/health` y después la Mini App.
- No uses servicios externos para hacer ping periódico solo para evitar la suspensión: para pruebas manuales, acepta el arranque en frío y conserva las horas gratuitas.
- Para actualizar el proyecto, haz `git push` a la rama conectada. Render desplegará nuevamente la API y los sitios afectados.
