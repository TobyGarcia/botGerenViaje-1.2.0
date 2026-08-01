# Backend: composición, desarrollo y preparación para producción

## Propósito

Esta guía describe cómo está compuesto el backend de Gerenciamiento de Viajes, cómo ejecutarlo durante el desarrollo y qué se debe preparar antes de publicarlo en un servidor o servicio web real.

El backend es una API HTTP en Node.js que también ejecuta un bot de Telegram. Se conecta a PostgreSQL y da servicio a dos clientes: la Mini App de conductores y el panel administrativo.

## Arquitectura

```text
Mini App Telegram ─┐
                   ├─ Nginx / HTTPS ──> API Express ──> PostgreSQL
Panel administrativo┘                       │
                                              └─ Bot Telegraf ──> Telegram
```

El proceso de `backend` cumple dos funciones: atiende la API en el puerto HTTP y ejecuta el bot de Telegram mediante *long polling*. Por ello, en la implementación actual debe existir una sola instancia en producción.

## Composición actual

```text
backend/
  src/
    app.js                         # Configura Express, middleware y rutas
    server.js                      # Arranque, comprobación DB y apagado ordenado
    routes/                        # Rutas HTTP por dominio
    controllers/                   # Adaptación request/response y validación de entrada
    services/                      # Reglas de negocio y consultas/transacciones SQL
    database/pool.js               # Pool de conexiones PostgreSQL
    middlewares/admin-auth...      # Protección de rutas administrativas
    utils/admin-session.js         # JWT y opciones de cookie administrativa
    utils/telegram-init-data.js    # Validación criptográfica de Telegram initData
    bot/                           # Bot Telegraf: handlers, teclados y helpers
    scripts/create-admin-user.js   # Alta controlada de administrador
  Dockerfile
  package.json
```

### Capas y responsabilidades

| Capa | Qué hace | Regla de implementación |
|---|---|---|
| Rutas | Declaran URL, método y middleware. | No contienen lógica de negocio. |
| Controladores | Leen entrada, llaman al servicio y devuelven HTTP. | Validan forma básica y no contienen SQL. |
| Servicios | Reglas de negocio, consultas y transacciones. | Centralizan consistencia y errores del dominio. |
| Base de datos | Pool `pg` contra `DATABASE_URL`. | Usa parámetros SQL; nunca concatenar entrada del usuario. |
| Middleware | Valida la sesión administrativa. | Debe proteger todas las rutas administrativas. |
| Utilidades | JWT e identidad Telegram. | Deben ser funciones aisladas y cubiertas por pruebas. |
| Bot | Interacción asíncrona con Telegram. | No debe duplicar reglas que pertenecen a servicios. |

### Dominios expuestos

| Prefijo | Función |
|---|---|
| `/health` | Salud del proceso para Docker, balanceador o hosting. |
| `/api/catalogos` | Consulta de conductores, vehículos, lugares y estados. |
| `/api/viajes` | Creación, inicio, finalización, cancelación y consulta de viajes. |
| `/api/viajes/:idViaje/ubicaciones` | Recepción de posiciones GPS. |
| `/api/telegram` | Validación de `initData` y registro de conductor. |
| `/api/admin/auth` | Login, sesión y logout administrativo. |
| `/api/admin/conductores` | Administración de conductores. |
| `/api/admin/vehiculos` | Administración de unidades y kilometraje. |
| `/api/admin/destinos` | Administración de lugares/destinos. |
| `/api/admin/ubicaciones-viaje` | Consulta administrativa de GPS. |
| `/api/admin/viajes` | Listado, detalle, resumen y baja de viajes. |

## Seguridad actual

- Telegram: se verifica el HMAC de `initData`, su fecha de emisión y la identidad recibida.
- Administración: la sesión se firma con JWT y se transmite como cookie HTTP-only.
- Acceso: las rutas administrativas usan el middleware `requireAdminSession`.
- Contraseñas administrativas: se gestionan con `bcryptjs`.
- Base de datos: el pool limita conexiones a 10 y valida la conexión al inicio.

La seguridad de producción depende también de usar HTTPS, una clave JWT aleatoria, cookies `secure`, secretos fuera del repositorio y una política de roles explícita.

## Desarrollo local

### Requisitos

- Node.js 22.
- PostgreSQL 16, o Docker Desktop con Docker Compose.
- Un bot de Telegram configurado para probar la Mini App.

### Variables de entorno

Copiar `.env.example` a `.env` y completar valores reales solo en el archivo local. Las variables principales del backend son:

| Variable | Uso | Producción |
|---|---|---|
| `NODE_ENV` | Entorno de ejecución. | `production` |
| `BACKEND_PORT` | Puerto local del backend. | Respaldo si el hosting no provee `PORT`. |
| `PORT` | Puerto asignado por algunos hostings. | Debe tener prioridad en el servidor. |
| `DATABASE_URL` | Conexión a PostgreSQL. | URL privada del proveedor/servidor. |
| `TELEGRAM_BOT_TOKEN` | Token privado del bot. | Secreto. |
| `TELEGRAM_WEB_APP_URL` | URL HTTPS pública de la Mini App. | Dominio productivo. |
| `ADMIN_JWT_SECRET` | Firma de sesiones administrativas. | Secreto aleatorio de alta entropía. |
| `ADMIN_COOKIE_SECURE` | Exige HTTPS para la cookie. | `true` |
| `ADMIN_LOGIN_MAX_ATTEMPTS` | Límite de intentos. | Valor operativo acordado. |
| `ADMIN_LOGIN_BLOCK_MINUTES` | Tiempo de bloqueo. | Valor operativo acordado. |

Nunca publicar `.env`, `admin-cookies.txt`, tokens, contraseñas ni respaldos de datos reales.

### Ejecución directa

```bash
cd backend
npm ci
npm run dev
```

El modo `dev` usa Nodemon. Para una ejecución equivalente a producción:

```bash
npm start
```

### Ejecución con Docker Compose

Desde la raíz del proyecto:

```bash
docker compose up --build
docker compose logs --tail=150 backend
```

Comprobar disponibilidad:

```bash
curl http://localhost:3000/health
```

Antes de probar funciones administrativas, crear un usuario en el entorno correcto:

```bash
docker compose exec backend npm run admin:create
```

## Cómo implementar un cambio de backend

1. Definir la regla de negocio y los campos que requiere.
2. Si cambia persistencia, crear una migración nueva y actualizar el script de migración; nunca editar una migración ya aplicada.
3. Implementar la consulta y las reglas en un servicio. Usar transacción si se escriben varias tablas.
4. Crear o actualizar controlador, ruta y middleware de autorización necesario.
5. Actualizar el cliente API de `frontend` o `panel-admin` solo después de estabilizar el contrato.
6. Añadir pruebas de éxito, validación, autorización y error.
7. Documentar el endpoint y validar el flujo completo en local.

Para cambios de viaje, kilometraje o estado, se debe preservar la auditoría: registrar el cambio y su origen, sin sobrescribir el historial.

## Ajustes obligatorios antes de producción

### 1. Usar el puerto del hosting

Actualmente `src/server.js` lee `BACKEND_PORT`. Sustituir la asignación de puerto por:

```js
const port = Number(process.env.PORT || process.env.BACKEND_PORT || 3000);
```

Conservar el bind en `0.0.0.0`, ya presente. No usar `localhost`, pues impediría que el proxy o balanceador alcance el proceso.

### 2. Ejecutar Node, no Nodemon

El `Dockerfile` actual termina con `npm run dev`. Para producción debe usar:

```dockerfile
CMD ["npm", "start"]
```

Nodemon debe limitarse al desarrollo local. La imagen de producción tampoco debe montar `backend/src` como volumen.

### 3. Verificar salud con dependencia de base de datos

El endpoint `/health` debe comprobar no solo que Express responde, sino que PostgreSQL está disponible. Esto evita que un balanceador envíe tráfico a una API sin acceso a datos.

Respuesta recomendada:

```json
{ "success": true, "status": "ok" }
```

Cuando la base no esté disponible, debe devolver HTTP 503 y registrar el error sin filtrar secretos.

### 4. Proxy inverso y HTTPS

Publicar los frontends y el backend bajo HTTPS. La configuración recomendada es que cada frontend exponga `/api` en su mismo dominio y Nginx lo reenvíe al backend privado. Así la cookie administrativa conserva comportamiento de mismo sitio.

El proxy debe reenviar `Host`, `X-Forwarded-For` y `X-Forwarded-Proto`. Si el backend necesita confiar en estos encabezados, configurar explícitamente `app.set("trust proxy", 1)` tras validar que solo recibe tráfico del proxy controlado.

### 5. Cookies, CORS y secretos

- Definir `ADMIN_COOKIE_SECURE=true` en producción.
- Conservar `sameSite: "lax"` si el panel llama a `/api` en el mismo dominio.
- Restringir CORS a los dominios públicos concretos si hay llamadas directas al backend.
- Generar `ADMIN_JWT_SECRET` con un administrador de secretos; rotarlo si se expone.
- Configurar secretos desde el panel del proveedor, un vault o variables del sistema, nunca desde el repositorio.

### 6. Base de datos y migraciones

- Usar PostgreSQL administrado o una instancia aislada con volumen persistente, respaldos automáticos y acceso privado.
- Aplicar migraciones una única vez, en orden y desde un proceso controlado de despliegue.
- Actualizar `database/scripts/migrate.sql` para incluir las migraciones 004 y 005 antes de usarlo para inicializar un entorno nuevo.
- Ejecutar seeds solamente en desarrollo o demostración, nunca sobre producción sin aprobación explícita.
- Hacer respaldo y verificar restauración antes de cambios estructurales importantes.

### 7. Bot de Telegram

La aplicación inicia el bot junto con Express y usa long polling. Configurar una sola réplica del backend; dos o más instancias competirían por las actualizaciones del mismo bot.

Para escalar la API en el futuro, separar el bot en un proceso/servicio de una sola réplica o migrarlo a webhook. La URL de la Mini App en `TELEGRAM_WEB_APP_URL` debe ser HTTPS y corresponder al dominio final configurado en Telegram.

## Opciones de despliegue

### A. Servicio gestionado (Render u opción equivalente)

Adecuado para la primera publicación. Crear:

1. PostgreSQL gestionado.
2. Un Web Service Docker para backend, una sola instancia y healthcheck `/health`.
3. Dos servicios web para Mini App y panel, con Nginx como proxy hacia el host privado del backend.
4. Variables y secretos directamente en el proveedor.

La guía complementaria [DEPLOY_RENDER.md](DEPLOY_RENDER.md) contiene el orden de migración, variables y un Blueprint de referencia.

### B. Servidor propio (VPS)

Adecuado si se requiere mayor control. Componentes mínimos:

```text
Internet → Nginx/Caddy (TLS) → contenedor backend (red privada) → PostgreSQL (red privada)
```

Pasos resumidos:

1. Provisionar servidor actualizado, firewall y acceso SSH con llaves.
2. Instalar Docker Engine y Docker Compose.
3. Configurar DNS para los dominios de Mini App y panel; emitir certificados TLS con Caddy o Certbot.
4. Clonar el repositorio sin secretos y cargar variables mediante un mecanismo protegido del servidor.
5. Levantar base de datos persistente y aplicar/restaurar migraciones de forma controlada.
6. Construir y levantar backend con `npm start`, sin Nodemon ni montajes de código.
7. Configurar Nginx/Caddy para HTTPS, proxy, límites de tamaño, timeouts y encabezados.
8. Configurar respaldos externos cifrados, monitoreo y reinicio automático.

No abrir PostgreSQL a Internet. Exponer únicamente 80/443 desde el proxy; los puertos internos de Node y PostgreSQL permanecen en la red privada.

## Secuencia segura de publicación

1. Preparar un ambiente de staging con las mismas variables y arquitectura de producción.
2. Aplicar cambios de puerto, Dockerfile y proxy; validar build y `/health`.
3. Respaldar la base de producción o restaurar una copia inicial validada.
4. Ejecutar migraciones nuevas en staging y después en producción, una vez.
5. Desplegar una sola instancia del backend y revisar sus logs de conexión/bot.
6. Desplegar panel y Mini App, verificar `/api`, autenticación, cookie, GPS y viaje completo.
7. Actualizar la URL de la Mini App en BotFather si cambia.
8. Supervisar errores y métricas durante la primera operación; mantener un plan de reversión.

## Lista de verificación de producción

- [ ] `PORT` tiene prioridad sobre `BACKEND_PORT`.
- [ ] El Dockerfile usa `npm start`.
- [ ] La API escucha en `0.0.0.0` y `/health` funciona tras el proxy.
- [ ] PostgreSQL es persistente, privado, respaldado y restaurable.
- [ ] Las migraciones 001 a 005 están aplicadas y registradas.
- [ ] Secrets configurados fuera de Git; no hay `.env` ni cookies en el repositorio.
- [ ] `NODE_ENV=production` y `ADMIN_COOKIE_SECURE=true`.
- [ ] Certificados HTTPS y dominios definitivos funcionan.
- [ ] El panel administra sesión bajo el mismo dominio que su `/api`.
- [ ] Solo hay una instancia que ejecuta el bot en long polling.
- [ ] Se probó el flujo: Telegram → crear → iniciar → GPS → finalizar → panel.
- [ ] Hay logs, alertas, respaldo y procedimiento de reversión documentado.

## Pendientes prioritarios

1. Cambiar puerto compatible con hosting y comando del Dockerfile.
2. Incluir las migraciones 004 y 005 en el script de migración.
3. Crear pruebas automatizadas para autenticación, viajes, ubicaciones y sesiones administrativas.
4. Implementar healthcheck que incluya PostgreSQL y observabilidad de errores.
5. Formalizar CI/CD, restauración de respaldos y procedimiento de despliegue.

---

Última actualización: 2026-08-01.
