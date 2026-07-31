# Backend — Gerenciamiento de Viajes

## Objetivo y estado actual

API HTTP del sistema, integración con PostgreSQL y bot de Telegram. Está implementada con Express y expone catálogos, gestión de viajes, ubicaciones GPS, autenticación Telegram y autenticación administrativa. El servicio se ejecuta en el puerto interno `3000`.

## Responsabilidades

- Exponer la API de catálogos, viajes, ubicaciones y salud.
- Validar `initData` de Telegram y registrar conductores desde Telegram.
- Administrar sesiones administrativas mediante JWT en cookie.
- Gestionar conductores desde el panel administrativo.
- Persistir datos en PostgreSQL y operar el bot con Telegraf.

## Estructura relevante

```text
src/
  app.js                  configuración Express y montaje de rutas
  server.js               arranque HTTP, base de datos y bot
  routes/                 definición de endpoints
  controllers/            validación y respuestas HTTP
  services/               lógica de negocio y consultas SQL
  database/pool.js        pool PostgreSQL
  middlewares/            protección de sesión administrativa
  utils/                  JWT administrativo y validación Telegram
  bot/                    handlers, teclados y helpers de Telegraf
  scripts/create-admin-user.js
```

## Tecnologías y dependencias

- Node.js 22 (imagen Docker) y JavaScript ESM.
- Express 5, `pg`, `cookie-parser`, `cors`.
- `bcryptjs` y `jsonwebtoken` para acceso administrativo.
- Telegraf para el bot de Telegram.
- Nodemon para desarrollo.

Dependencias declaradas: `bcryptjs`, `cookie-parser`, `cors`, `express`, `jsonwebtoken`, `pg`, `telegraf` y `nodemon` como dependencia de desarrollo.

## Variables de entorno

| Variable | Uso comprobado |
|---|---|
| `BACKEND_PORT` | Puerto HTTP; por defecto `3000`. |
| `DATABASE_URL` | Cadena de conexión PostgreSQL. |
| `NODE_ENV` | Entorno de ejecución. |
| `TZ` | Zona horaria. |
| `TELEGRAM_BOT_TOKEN` | Token del bot y validación Telegram. |
| `TELEGRAM_WEB_APP_URL` | URL de la Mini App usada por el bot. |
| `TELEGRAM_GROUP_ID` | Grupo de Telegram usado por helpers del bot. |
| `TELEGRAM_BOT_USERNAME` | Usuario del bot. |
| `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` | Vigencia de `initData`; por defecto 3600. |
| `ADMIN_JWT_SECRET` | Secreto para firmar/verificar la sesión administrativa. |
| `ADMIN_JWT_EXPIRES_IN` | Vigencia JWT; por defecto `8h`. |
| `ADMIN_COOKIE_NAME` | Nombre de cookie; por defecto `admin_session`. |
| `ADMIN_COOKIE_SECURE` | Bandera `secure` de la cookie; por defecto `false`. |
| `ADMIN_LOGIN_MAX_ATTEMPTS` | Límite de intentos de login; por defecto 5. |
| `ADMIN_LOGIN_BLOCK_MINUTES` | Minutos de bloqueo; por defecto 15. |

No se documentan valores de secretos.

## Puertos y Docker

- Contenedor: `3000`.
- Host: `${BACKEND_PORT:-3000}:3000` en `compose.yml`.
- Imagen: Node 22 Alpine.
- El servicio depende de PostgreSQL saludable y monta `./backend/src` en `/app/src`.

## Flujo de funcionamiento

1. `server.js` comprueba la conexión a PostgreSQL, inicia el bot y levanta Express.
2. `app.js` registra parser JSON, cookies, rutas y el manejador 404/error.
3. Las rutas delegan en controladores; estos usan servicios para consultas y transacciones.
4. Las rutas administrativas validan `admin_session` mediante `requireAdminSession` antes de acceder a datos protegidos.

## Endpoints disponibles

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Identificación de la API. |
| GET | `/health` | Estado de salud. |
| GET | `/api/catalogos/conductores` | Catálogo de conductores. |
| GET | `/api/catalogos/vehiculos` | Catálogo de vehículos. |
| GET | `/api/catalogos/lugares` | Catálogo de lugares. |
| GET | `/api/catalogos/estados-viaje` | Catálogo de estados. |
| POST | `/api/viajes` | Crear viaje. |
| POST | `/api/viajes/:idViaje/iniciar` | Iniciar viaje. |
| POST | `/api/viajes/:idViaje/finalizar` | Finalizar viaje. |
| GET | `/api/viajes/activo` | Consultar viaje activo. |
| GET | `/api/viajes/:idViaje` | Consultar viaje por id. |
| POST | `/api/viajes/:idViaje/ubicaciones` | Registrar ubicación GPS. |
| POST | `/api/telegram/autenticar` | Autenticar usuario de Telegram. |
| POST | `/api/telegram/registro-conductor` | Registrar conductor desde Telegram. |
| POST | `/api/admin/auth/login` | Inicio de sesión administrativo. |
| GET | `/api/admin/auth/session` | Consultar sesión administrativa. |
| POST | `/api/admin/auth/logout` | Cerrar sesión administrativa. |
| GET | `/api/admin/conductores` | Listar conductores; requiere sesión administrativa. |
| POST | `/api/admin/conductores` | Crear conductor; requiere sesión administrativa. |
| PATCH | `/api/admin/conductores/:idConductor/estado` | Activar/desactivar conductor; requiere sesión administrativa. |

## Tablas relacionadas

`conductores`, `vehiculos`, `lugares`, `estados_viaje`, `viajes`, `ubicaciones_viaje`, `historial_estados_viaje`, `usuarios_telegram` y `usuarios_admin`.

## Comandos

```bash
cd backend
npm ci
npm run dev
npm start
npm run admin:create
```

Desde la raíz:

```bash
docker compose up -d --build backend
docker compose restart backend
docker compose logs --tail=150 backend
```

## Pruebas realizadas

- Se verificó que el contenedor backend estaba saludable mediante `docker compose ps`.
- Se revisaron rutas, middleware y configuración estática. No existe un script de pruebas automatizadas funcional: `npm test` termina con error intencional de plantilla.

## Problemas conocidos

- No hay suite de pruebas automatizadas configurada.
- Los logs revisados contienen reinicios históricos de Nodemon, además de un arranque posterior saludable.

## Próximos pasos pendientes

- Incorporar pruebas unitarias e integración para controladores y servicios.
- Documentar contratos de request/response de cada endpoint con ejemplos verificados.

## Información pendiente de confirmar

- Roles y permisos detallados por rol administrativo.
- Operación esperada del bot en producción y políticas de despliegue.

## Historial de cambios

- 2026-07-30: README técnico inicial creado a partir del código actual.

╔══════════════════════════════════════╗
║     GERENCIAMIENTO DE VIAJES         ║
║        Desarrollo Itzamná            ║
╚══════════════════════════════════════╝