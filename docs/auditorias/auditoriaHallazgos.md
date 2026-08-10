# AUDITORÍA TÉCNICA — GV Campeche
## Sistema de Gerenciamiento de Viajes
**Fecha de revisión:** 8 de agosto de 2026
**Revisado por:** Kiro AI (Auditoría automatizada de código)
**Branch de referencia:** feature/render-deploy

---

## 1. PATRONES DE DISEÑO

### Backend

| Patrón | Ubicación | Evaluación |
|---|---|---|
| Layered Architecture (Routes → Controllers → Services) | Todo el backend | ✅ Bien aplicado |
| Repository / Service Pattern | Todos los `*.service.js` | ✅ Separación clara de negocio y acceso a datos |
| Singleton | `bot.js` → `getTelegramBot()` | ✅ Correcto para proceso único Node.js |
| Transaction Script | Servicios con transacciones DB | ✅ Correcto, con caveats de concurrencia (ver sección 5) |
| Middleware Chain | `admin-auth.middleware.js` | ✅ Patrón estándar Express |

### Frontend

| Patrón | Ubicación | Evaluación |
|---|---|---|
| God Component (anti-patrón) | `App.jsx` (~700 líneas) | ⚠️ Todo en un solo componente — funcional pero frágil |
| Module State (variables globales de módulo) | `tracking-service.js` | ⚠️ Causa el bug de doble interval reportado |
| Offline-First con IndexedDB | `tracking-storage.js` | ✅ Bien pensado y ejecutado |
| Promise Deduplication | `syncPromise` en `tracking-service.js` | ✅ Correcto, aunque incompleto (ver bugs) |

> **Veredicto de patrón:** El patrón de diseño del backend es el adecuado.
> La falla no es estructural — es de implementación en puntos específicos de concurrencia.

---

## 2. STACK DE PROGRAMACIÓN

```
Backend
  Runtime:      Node.js (ESModules, JavaScript)
  Framework:    Express.js
  Bot Telegram: Telegraf
  DB Client:    pg (node-postgres) con Pool
  Auth:         jsonwebtoken (JWT), bcryptjs, cookie-parser
  Crypto:       módulo crypto nativo de Node (HMAC-SHA256 Telegram)

Frontend
  Framework:    React (JSX) + Vite
  Estado:       useState / useEffect (estado local de componente)
  Offline:      IndexedDB (tracking-storage.js)
  GPS:          navigator.geolocation / Telegram.WebApp.LocationManager
  HTTP:         fetch nativo (wrappers en /services/api.js)
  Estilos:      CSS plano (App.css, index.css)

Base de Datos
  Motor:        PostgreSQL
  Hosting dev:  Render
  Hosting prod: Supabase (planeado)
  Migraciones:  SQL puro (4 migraciones ejecutadas)

Infraestructura / Deploy
  Contenedores: Docker + compose.yml
  Proxy:        nginx (frontend)
  CI/CD:        Render (deploy manual desde branches)
```

---

## 3. LISTADO DE MÓDULOS

### Backend — Módulos activos

```
src/bot/
  bot.js                      Instancia singleton de Telegraf, alertas al grupo supervisor
  bot.handlers.js             Handlers: /start, /viaje, /registro
  bot.helpers.js              isAuthorizedGroup(), logCommand()
  bot.keyboards.js            Teclados inline y reply para Telegram

src/services/
  viajes.service.js           CRUD viajes, inicio, fin, cancelación, generación de folio
  ubicaciones.service.js      saveTripLocation, saveTripLocationBatch (idempotente)
  catalogos.service.js        Lecturas de conductores, vehículos, lugares
  telegram-auth.service.js    Validación initData Telegram (HMAC-SHA256)
  telegram-user.service.js    findTelegramUserById, upsert de usuarios Telegram
  admin-auth.service.js       Login admin, bloqueo por intentos fallidos
  admin-conductores.service.js  CRUD conductores (panel admin)
  admin-vehiculos.service.js    CRUD vehículos (panel admin)
  admin-destinos.service.js     CRUD destinos y lugares (panel admin)
  admin-ubicaciones.service.js  Consulta de ubicaciones (panel admin)
  admin-viajes.service.js       Consulta y gestión de viajes (panel admin)

src/middlewares/
  admin-auth.middleware.js    JWT verify + lookup de usuario activo en DB

src/utils/
  admin-session.js            createSession, destroySession (JWT + cookie HttpOnly)
  telegram-init-data.js       Validación HMAC con timing-safe compare

src/database/
  pool.js                     pg.Pool (max: 10 conexiones, timeouts configurados)
```

### Frontend — Módulos activos

```
src/services/
  api.js                 Todas las llamadas HTTP al backend
  tracking-service.js    Orquestación GPS: captura, cola, sincronización
  tracking-state.js      Persistencia del estado de tracking en localStorage
  tracking-storage.js    Cola offline de ubicaciones en IndexedDB
  location-provider.js   Abstracción GPS (Telegram.WebApp → browser fallback)

src/components/
  RegistroConductor.jsx  Formulario de registro de conductor nuevo

src/
  App.jsx                Componente principal (monolítico — contiene todo el flujo)
```

### Módulos documentados como FUTUROS (no implementados)

- `supervisor-bot.js` — bot de supervisores, parcialmente en desarrollo
- Mini app de supervisor (sitio estático separado en Render)
- Módulo de gerenciamiento de viajes para rol OPERADOR
- Módulo de manejo comentado / cursos de conductor con folios
- Reporte de siniestros desde el bot
- Integración con SharePoint para archivos PDF
- Migración de mini app a Chrome nativo (background GPS)

---

## 4. APIs Y ENDPOINTS

### Públicos / Telegram (autenticación por initData Telegram o sin auth)

```
GET  /                                          Health check raíz
GET  /health                                    Estado del servicio

POST /api/telegram/auth                         Login con initData Telegram

GET  /api/catalogos/conductores                 Lista conductores activos
GET  /api/catalogos/vehiculos                   Lista vehículos activos
GET  /api/catalogos/lugares                     Lista lugares / destinos

POST /api/viajes                                ⚠️ Crear viaje (sin auth fuerte)
GET  /api/viajes/activo                         Viaje activo del conductor
POST /api/viajes/:idViaje/iniciar               ⚠️ Iniciar viaje (sin auth fuerte)
POST /api/viajes/:idViaje/finalizar             ⚠️ Finalizar viaje (sin auth fuerte)
POST /api/viajes/:idViaje/cancelar              ⚠️ Cancelar viaje (sin auth fuerte)

POST /api/viajes/:idViaje/ubicaciones/lote      ✅ Guardar lote GPS (validado con initData)
```

### Panel Admin (requieren JWT en cookie HttpOnly)

```
POST   /api/admin/auth/login
POST   /api/admin/auth/logout

GET    /api/admin/conductores
POST   /api/admin/conductores
PUT    /api/admin/conductores/:id
DELETE /api/admin/conductores/:id

GET    /api/admin/vehiculos
POST   /api/admin/vehiculos
PUT    /api/admin/vehiculos/:id
DELETE /api/admin/vehiculos/:id

GET    /api/admin/destinos
POST   /api/admin/destinos
PUT    /api/admin/destinos/:id
DELETE /api/admin/destinos/:id

GET    /api/admin/viajes
GET    /api/admin/viajes/:id
GET    /api/admin/ubicaciones/:idViaje
```

---

## 5. ANÁLISIS DE CONCURRENCIA — EL BUG REPORTADO

Este es el núcleo del problema: **comportamiento raro cuando dos personas guardan al mismo tiempo.**
Existen tres capas de race conditions de diferente severidad.

---

### 🔴 Bug #1 — Double interval en tracking (Frontend) — MUY PROBABLE CAUSA DIRECTA

**Archivo:** `frontend/src/services/tracking-service.js`

Variables de módulo compartidas dentro de la misma sesión:

```javascript
let intervalId = null;
let activeTripId = null;
let syncPromise = null;
```

La función `startTracking` tiene un guard:

```javascript
if (intervalId !== null && activeTripId === normalizedId) return;
```

**El problema:** si `startTracking` es llamada dos veces casi simultáneamente
(por ejemplo, el `useEffect` de `loadInitialData` y el evento `visibilitychange`
disparan al mismo tiempo), ambas llamadas pasan el guard porque `intervalId` sigue
siendo `null` mientras la primera awaita en `captureAndQueueLocation`.

**Secuencia del fallo:**
1. Llamada A pasa el guard (`intervalId === null`), entra en `await captureAndQueueLocation()` — puede tardar hasta 20 segundos esperando GPS.
2. Llamada B pasa el guard también (sigue siendo `null`), ejecuta `stopTracking()` matando cualquier interval anterior, luego asigna su propio `intervalId`.
3. Cuando la Llamada A termina, asigna un segundo `intervalId` encima del que B ya creó.
4. **Resultado:** dos `setInterval` activos simultáneamente. El primero pierde su referencia y nunca se limpia.

**Consecuencias visibles:** duplicación de envíos GPS, estado de UI incongruente, botones congelados, y en escenario de dos conductores en el mismo dispositivo (o recarga rápida), datos mezclados.

**Corrección:** agregar un flag booleano `isStarting` antes de la llamada async para bloquear llamadas concurrentes mientras la primera está en vuelo.

---

### 🟡 Bug #2 — Race condition en folio de viaje (Backend)

**Archivo:** `backend/src/services/viajes.service.js` → función `createTrip`

```javascript
// Patrón check-then-act clásico
const dailyCountResult = await client.query(
  `SELECT COUNT(*)::INTEGER AS total FROM viajes WHERE fecha = CURRENT_DATE`
);
const dailySequence = dailyCountResult.rows[0].total + 1;
const folio = buildTripFolio(dailySequence);
// → Si dos conductores llegan aquí simultáneamente, ambos calculan el mismo folio
```

**Secuencia del fallo:**
1. Conductor A lee COUNT = 5, calcula folio `VJ-20260808-0006`.
2. Conductor B lee COUNT = 5 (antes del commit de A), calcula folio `VJ-20260808-0006`.
3. Conductor A inserta — éxito.
4. Conductor B intenta insertar — falla con UNIQUE constraint en `folio`.
5. El conductor B recibe un error genérico sin mensaje de reintento claro.

**Corrección:** usar una SEQUENCE de PostgreSQL para el contador diario, o construir el folio después del `INSERT` usando el `id_viajes` (SERIAL) como secuenciador, eliminando el check-then-act.

---

### 🟡 Bug #3 — Vehículo asignado a dos viajes simultáneos (Backend)

**Archivo:** `backend/src/services/viajes.service.js` → función `startTrip`

La verificación de vehículo en uso no usa `FOR UPDATE`:

```javascript
// SELECT sin lock — no garantiza exclusividad
const activeTripResult = await client.query(
  `SELECT v.id_viajes FROM viajes v
   INNER JOIN estados_viaje ev ON ...
   WHERE v.id_vehiculos = $1 AND ev.nombre = 'EN_CURSO'
   AND v.id_viajes <> $2 LIMIT 1`
);
```

Dos conductores iniciando simultáneamente viajes distintos con el mismo vehículo pueden ambos pasar esta verificación antes de que alguno haga COMMIT. El vehículo termina asignado a dos viajes `EN_CURSO` al mismo tiempo.

**Corrección:** agregar `SELECT ... FOR UPDATE` sobre `vehiculos WHERE id_vehiculos = $1` al inicio de la transacción de `startTrip`, antes de la verificación.

---

### ✅ Lo que SÍ está correctamente protegido contra concurrencia

- **Guardado batch de ubicaciones:** `ON CONFLICT (id_viajes, client_location_id) DO NOTHING` + índice único parcial (migración 004). El mismo lote enviado dos veces solo inserta una vez — **idempotente y correcto**.
- **Transacciones en ubicaciones:** `FOR UPDATE OF v` serializa el acceso al viaje durante inserts de ubicaciones.
- **Login admin con brute-force:** usa `FOR UPDATE` en la lectura del usuario para serializar el contador de intentos fallidos.
- **Pool de conexiones:** el `client.release()` en bloque `finally` en todos los servicios garantiza que las conexiones siempre se devuelven al pool.

---

## 6. OTROS HALLAZGOS

### Seguridad

| Severidad | Problema | Archivo | Recomendación |
|---|---|---|---|
| 🔴 Alta | Endpoints de creación/modificación de viajes sin validación de initData Telegram | `viajes.controller.js` | Agregar middleware de validación Telegram a `POST /api/viajes`, `/iniciar`, `/finalizar`, `/cancelar` |
| 🟡 Media | `CORS origin: true` acepta cualquier dominio | `app.js` | Cambiar a la URL específica del frontend en producción |
| 🟠 Baja | Cookie admin sin verificar que `ADMIN_COOKIE_SECURE=true` en producción | `admin-session.js` | Confirmar variable de entorno en Render |

### Código muerto / Deuda técnica

| Severidad | Problema | Archivo |
|---|---|---|
| 🟡 Media | `LOCATION_INTERVAL_MS` referenciada pero nunca definida en el scope. Si `sendPosition()` fuera llamada, lanzaría `ReferenceError` | `App.jsx` |
| 🟠 Baja | Funciones y refs del sistema GPS anterior nunca invocadas: `sendPosition`, `handleStartGps`, `handleStopGps`, `geolocationWatchRef`, `sendingLocationRef`, `lastLocationSentAtRef` | `App.jsx` |
| 🟠 Baja | `useEffect` de `loadCatalogs` comentado — residuo de refactorización | `App.jsx` |
| 🟠 Baja | Imports de `cookieParser` y `adminAuthRoutes` declarados al final del archivo | `app.js` |

### Bot de Telegram

| Severidad | Problema | Archivo |
|---|---|---|
| 🟡 Media | Handler `/start` no tiene `try/catch` a diferencia de todos los otros handlers | `bot.handlers.js` |
| 🟡 Media | `getMiniAppKeyboard()` lanza `Error` si `TELEGRAM_WEB_APP_URL` no está configurada; en el handler `/start` esta llamada está fuera del `try/catch` | `bot.handlers.js`, `bot.keyboards.js` |

### Base de Datos

| Severidad | Problema | Recomendación |
|---|---|---|
| 🟠 Baja | Índice faltante en `viajes(id_vehiculos, id_estado_viaje)` — beneficiaría la consulta de vehículo en uso en `startTrip` | Agregar índice compuesto |
| 🟠 Baja | `FOR UPDATE` en `saveTripLocation` lockea la fila del viaje solo para leer su estado sin modificarlo — genera contención innecesaria | Considerar `FOR SHARE` en su lugar |

---

## 7. READINESS — ¿ESTÁ LISTO PARA LOS CAMBIOS DOCUMENTADOS?

### Bugs que deben corregirse ANTES de avanzar

Estos problemas activos pueden corromper datos si se construye más encima:

| # | Bug | Impacto si no se corrige |
|---|---|---|
| 1 | Race condition en `startTracking` (double interval) | Duplicación de GPS, UI congelada, datos incoherentes |
| 2 | Race condition en folio de viaje (check-then-act) | Conductor recibe error inesperado al crear viaje en hora pico |
| 3 | Bug de kilometraje al crear nuevo viaje (ACTUALIZACION_MODULOS_1.MD §2) | Puede generar inconsistencia de kilometraje en DB |

---

### Cambios de `2DA_revicion_tecnica.MD` — Estado de readiness

| Cambio | Listo | Notas |
|---|---|---|
| Combobox mes/año en fecha de licencia (2a) | ✅ | Solo UI, no afecta lógica crítica |
| Combobox tipo de licencia (2a) | ✅ | Requiere campo en DB, baja complejidad |
| Casilla + fecha vencimiento manejo comentado (2e) | ✅ | Solo campos, sin módulo de validación aún |
| Empresa de origen del conductor (2f) | ✅ | Campo enum en tabla `conductores` |
| Capacidad máxima de acompañantes por vehículo (2c) | ✅ | Agregar campo `capacidad_pasajeros` a `vehiculos` + validación backend |
| UI de acompañantes con botón añadir + límite (2d) | ✅ | Solo frontend, no toca lógica crítica |
| Múltiples destinos / paradas en viaje (obs. 3) | ⚠️ | Implica cambio de schema 1:M en viajes — **diseñar antes de implementar** |
| Whitelist / PIN de seguridad conductores (obs. 4) | ⚠️ | Afecta flujo de autenticación completo — **diseñar antes de implementar** |

---

### Cambios de `ACTUALIZACION_MODULOS_1.MD` — Estado de readiness

| Cambio | Sección | Listo | Notas |
|---|---|---|---|
| Fix bug kilometraje al crear nuevo viaje | §2 | 🔴 Urgente | Puede corromper datos — hacer antes que cualquier otra cosa |
| Fix grupo supervisor no recibe mensajes (`isGroup: false`) | §2 | 🔴 Urgente | Revisar `TELEGRAM_GROUP_SUPRVISOR_ID` y lógica de `isAuthorizedGroup()` |
| Fix error 409 bot supervisor | §7 | 🔴 Urgente | Relacionado con el bug de instancias dobles de bot |
| Fix zona horaria PDF (+6h) | §2 | 🟡 Fácil | Variable de entorno `TZ=America/Merida` o formateo explícito con timezone |
| Regla inspección vehicular por usuario/día | §3 | ✅ | Campo `id_usuario_telegram` + `fecha` en tabla de inspecciones |
| Restricción auto-aprobación (jerarquía supervisores) | §2 | ✅ | Regla de negocio en servicio de inspecciones: `aprobador <> solicitante` |
| Roles con restricciones visuales en panel admin | §1 | ✅ | JWT ya tiene campo `rol` — solo aplicar guards en frontend admin |
| Módulo Administrador de Usuarios en sidebar (ADMINISTRADOR) | §1 | ✅ | Nueva página + endpoints de gestión de `usuarios_admin` |
| Generación usuario/contraseña al registrar conductor | §2 | ✅ | Migración de tabla + endpoint de generación automática |
| Normalización DB al eliminar conductor/vehículo | §4 | ✅ | Revisar CASCADE vs SET NULL según el caso |
| Migración mini app a Chrome nativo (background GPS) | §6 | ⏳ | **Planear por etapas** — no implementar de golpe, alto riesgo |
| Carga de datos reales + migración Supabase | §8 | ⏳ | Solo cuando todo esté funcional y probado |

---

## 8. RESUMEN EJECUTIVO

El sistema tiene una **arquitectura sólida** y el patrón de capas elegido es correcto. La base de datos está bien diseñada con constraints, índices, foreign keys, y el sistema de guardado de ubicaciones es idempotente gracias a la migración 004. El bot de Telegram es stateless entre conversaciones (no hay estado compartido en memoria entre conductores distintos).

**El comportamiento raro reportado cuando dos personas guardaban al mismo tiempo** es una combinación de dos problemas independientes:

1. El **race condition en `startTracking`** en el frontend, que crea múltiples setIntervals activos cuando la función se invoca concurrentemente desde distintos efectos de React. Este es el responsable principal del comportamiento errático visible en pantalla.
2. El **race condition en el folio de viaje** en el backend, que provoca fallos inesperados cuando dos conductores crean un viaje casi simultáneamente.

Ambos son **correcciones puntuales y manejables**. No requieren cambio de arquitectura.

El sistema está en condición de recibir los cambios documentados, con la condición de resolver los tres bugs marcados como urgentes primero. Los módulos nuevos (múltiples destinos, whitelist de conductores, migración a Chrome) requieren diseño previo antes de implementación.

---

*Documento generado en base a análisis estático del código fuente. No sustituye pruebas de carga, penetration testing, ni revisión de configuraciones de entorno de producción.*
