# Análisis técnico del proyecto Gerenciamiento de Viajes

**Fecha de revisión:** 4 de septiembre de 2026  
**Alcance:** revisión estática del repositorio, configuración, arquitectura, rutas, autenticación, persistencia, despliegue y ejecución de los chequeos locales disponibles.  
**No incluido:** pruebas contra una base de datos o servicios reales de Telegram, Microsoft Entra ID, SharePoint, SMTP, Render o ngrok.

## 1. Resumen ejecutivo

El repositorio implementa una plataforma de operación vehicular compuesta por una API Node.js, una PWA para conductores y supervisores, un panel administrativo y una base PostgreSQL. El alcance funcional es considerable: viajes, GPS, inspecciones, kilometraje, gerenciamiento previo, manejo comentado, bots de Telegram, autenticación administrativa, analítica y exportación de documentos.

La separación física por aplicaciones es clara y las compilaciones de ambos frontends terminan correctamente. También hay buenas bases en consultas SQL parametrizadas, transacciones, hashes de credenciales, validación criptográfica de Telegram, roles centralizados, cookies `httpOnly`, healthchecks e idempotencia para GPS offline.

Sin embargo, el proyecto **no debe considerarse listo para exposición pública sin corregir los hallazgos críticos de autenticación y autorización**. La combinación de registro público, selección de rol y login por correo permite potencialmente obtener una sesión administrativa sin demostrar la identidad. Además, existen endpoints que modifican GPS y gerenciamientos sin autenticación obligatoria. No hay pruebas automatizadas y el lint de la PWA falla por una violación de las reglas de Hooks.

### Evaluación general

| Área | Estado | Observación |
| --- | --- | --- |
| Cobertura funcional | Alta | El dominio está ampliamente implementado. |
| Arquitectura | Media | Separación por capas, pero archivos muy grandes y lógica duplicada. |
| Seguridad | Crítica | Hay rutas y flujos de autenticación explotables. |
| Calidad automatizada | Baja | Sin tests; un frontend no pasa lint. |
| Despliegue | Media | Docker/Render documentados, con divergencias y migración manual. |
| Mantenibilidad | Media-baja | 34,854 líneas de JS/JSX/CSS y varios componentes monolíticos. |
| Observabilidad | Baja | Predomina `console`; no hay trazas, métricas ni auditoría consistente. |

## 2. Composición del repositorio

```text
botGerenViaje-1.2.0/
├── backend/       API REST, PostgreSQL, bots de Telegram, PDFs y SharePoint
├── frontend/      React PWA: conductor, supervisor y evaluación
├── panel-admin/   React: administración, mapas y analítica
├── database/      20 migraciones SQL, seeds y scripts psql
├── docs/          operación, despliegue, módulos y auditorías previas
├── output/        PDF de muestra versionado
├── codeql-custom-queries-javascript/  paquete mínimo de consulta CodeQL
├── compose.yml / compose.prod.yml     orquestación local y productiva
└── render.yaml    blueprint de API, dos variantes frontend, panel y PostgreSQL
```

### Tamaño observado

- 126 archivos fuente `.js`, `.jsx` y `.css`.
- 34,854 líneas en esos archivos.
- 20 migraciones PostgreSQL y 4 seeds.
- 88 archivos `.js`, 37 `.jsx`, 37 `.png` y 18 `.md` en el inventario principal.
- Los archivos más grandes son `panel-admin/src/App.css` (3,612 líneas), `frontend/src/App.jsx` (1,941), `panel-admin/src/pages/GerenciamientoAdminPage.jsx` (1,245), `panel-admin/src/pages/ViajesPage.jsx` (1,163) y `backend/src/services/viajes.service.js` (1,013).

## 3. Arquitectura y responsabilidades

### Backend

- Node.js 20–22, módulos ES, Express 5 y PostgreSQL mediante `pg`.
- Organización por `routes`, `controllers`, `services`, `middlewares`, `utils`, `bot`, `database` y `scripts`.
- Autenticación por Telegram `initData`, usuario/contraseña, PIN, JWT/cookie y Microsoft Entra ID.
- Dos bots de Telegram: conductores y supervisores.
- Integraciones con SMTP, Microsoft Graph/Entra ID y SharePoint.
- Generación de PDFs para inspección y manejo comentado.
- API expuesta bajo `/api`, archivos locales bajo `/uploads` y salud bajo `/health`.

### PWA (`frontend`)

- React 19, Vite 8 y `vite-plugin-pwa`.
- Una sola compilación decide la aplicación por `VITE_APP_MODE`, ruta o query string: conductor, supervisor o evaluación.
- Soporta login por PIN/Telegram, caché local, cola offline, rastreo GPS y sincronización por lotes.
- Usa `localStorage` para tokens Bearer, conductor cacheado, viaje activo, catálogos y colas offline.

### Panel administrativo

- React 19 y Vite 8.
- Leaflet/React Leaflet para mapas.
- Módulos de dashboard, usuarios, conductores, vehículos, destinos, viajes, ubicaciones, inspecciones, gerenciamiento, manejo comentado, perfil y analítica de combustible.
- Consume sesión administrativa por cookie y, en partes concretas, token Bearer desde `localStorage`.

### Persistencia

El esquema evolucionó mediante 20 migraciones. Las entidades observadas cubren:

- conductores, vehículos, lugares y estados;
- viajes, historial de estados, ubicaciones y puntos intermedios;
- usuarios Telegram y administrativos;
- kilometraje y disponibilidad/mantenimiento;
- inspecciones y autorización por supervisor;
- acceso de supervisores por Telegram y confirmaciones de correo;
- manejo comentado y evaluaciones;
- gerenciamiento de viajes.

Las consultas revisadas usan mayoritariamente parámetros `$1`, `$2`, etc., lo que reduce el riesgo de inyección SQL. Varios flujos de negocio emplean transacciones explícitas.

## 4. Flujos funcionales principales

1. Un conductor se autentica mediante Telegram o PIN y queda asociado a un registro activo/aprobado.
2. Consulta catálogos, crea un viaje y registra kilometraje inicial.
3. Completa inspección/gerenciamiento cuando aplica e inicia el viaje.
4. La PWA captura GPS, conserva puntos offline y sincroniza lotes idempotentes.
5. El conductor registra puntos intermedios, finaliza o cancela el viaje.
6. Supervisores reciben avisos por Telegram y revisan inspecciones/solicitudes.
7. El panel administra catálogos y usuarios, consulta viajes/rutas, genera documentos y muestra analítica.

## 5. Aspectos bien resueltos

- Separación razonable entre rutas, controladores y servicios en el backend.
- SQL generalmente parametrizado y presencia de transacciones en operaciones compuestas.
- Validación HMAC y antigüedad de `initData` de Telegram.
- Verificación de emisor, audiencia y tipo en JWT administrativos y de conductor.
- Revalidación del usuario activo desde base de datos en el middleware administrativo.
- Contraseñas/PIN almacenados con bcrypt, no en texto plano.
- Roles y middleware de autorización centralizados para buena parte del panel.
- Cookies administrativas `httpOnly`, configurables como `secure` y `sameSite`.
- Límite JSON de 2 MB, CORS configurable y `x-powered-by` desactivado.
- GPS offline con identificador UUID, restricción de lote e idempotencia.
- Healthchecks para PostgreSQL, API y frontends.
- Imágenes Docker con instalación reproducible mediante `npm ci`.
- Bloqueo de PostgreSQL al loopback en `compose.prod.yml`.
- Cierre ordenado de HTTP, bots y pool ante `SIGTERM`/`SIGINT`.

## 6. Hallazgos

### Críticos

#### C-01 — Escalamiento a administrador sin autenticación real

**Evidencia:**

- `POST /api/admin/usuarios/registro-publico` no exige sesión.
- El cuerpo acepta `rol`; `registerPublicUser` acepta todos los roles válidos, incluido `ADMINISTRADOR`.
- La inserción crea el usuario con `activo = true`.
- `POST /api/admin/auth/tenant-login` recibe solamente un correo.
- La “validación tenant” comprueba sintaxis/dominio y que el correo exista activo en `usuarios_admin`, pero no demuestra acceso al correo ni valida un token de Microsoft.
- Después emite directamente una cookie/JWT administrativa.

**Impacto:** un atacante puede registrar un correo con dominio corporativo y rol `ADMINISTRADOR`, y luego solicitar una sesión usando sólo ese correo. Incluso sin el registro público, conocer el correo de un usuario activo bastaría para intentar el login directo.

**Acción inmediata:** retirar o deshabilitar `tenant-login`; permitir sesiones de Entra ID sólo después del intercambio OAuth y verificación del perfil. El registro público debe crear siempre un rol mínimo, `activo = false`, no aceptar rol del cliente, validar el dominio de forma estricta y requerir aprobación. Revisar las cuentas creadas mientras este flujo estuvo publicado y rotar `ADMIN_JWT_SECRET` después de cerrar la exposición.

#### C-02 — Escritura de ubicaciones GPS sin autenticación en endpoints individuales

**Evidencia:** `/api/viajes/:idViaje/ubicaciones` se monta sin `requireActiveDriver`. Los endpoints `POST /` y `POST /punto-intermedio` validan datos y existencia/estado del viaje, pero no autentican ni comprueban que el viaje pertenezca al solicitante. Sólo `POST /lote` valida Telegram internamente y relaciona conductor/viaje.

**Impacto:** cualquiera que conozca o adivine un ID de viaje activo puede inyectar coordenadas o puntos intermedios, contaminando rutas, auditorías y evidencia operativa.

**Acción inmediata:** aplicar `requireActiveDriver` al router completo y pasar `idConductor` a los servicios para comprobar propiedad en todas las escrituras.

#### C-03 — Lectura, aprobación y fichaje de gerenciamientos sin autorización

**Evidencia:** todas las rutas de `/api/gerenciamiento-viajes` carecen de middleware. Sólo la creación llama a `authenticateDriver`. Listar, consultar por ID/viaje, aprobar/rechazar y registrar horas no autentican al actor; la aprobación confía en `idUsuarioAdmin` y `nombreAutorizador` enviados por el cliente.

**Impacto:** exposición de información operacional y firmas; modificación o aprobación fraudulenta de controles de riesgo; generación de avisos Telegram falsos.

**Acción inmediata:** separar rutas de conductor y administración. Exigir conductor propietario para crear/consultar/fichar y sesión administrativa con rol autorizado para listar/aprobar. Obtener siempre la identidad del autorizador desde la sesión, nunca desde el body.

### Altos

#### A-01 — CORS permite cualquier origen cuando la lista está vacía

`app.js` acepta cualquier origen si `CORS_ORIGINS` no contiene valores, manteniendo `credentials: true`. `.env.example` recomienda dejarlo vacío en desarrollo y `compose.prod.yml` permite el valor vacío. Una omisión productiva abre el backend a orígenes no previstos.

**Recomendación:** fallar al arrancar en producción si no hay allowlist; mantener una lista explícita para PWA/panel y probar el comportamiento de cookies cross-site.

#### A-02 — Falta protección CSRF explícita

Las sesiones administrativas se aceptan por cookie y existen operaciones `POST`, `PATCH` y `DELETE`. Render configura `SameSite=None`; no se observó token CSRF ni validación estricta de `Origin`/`Referer`. CORS no sustituye completamente una defensa CSRF.

**Recomendación:** usar token CSRF o patrón double-submit, validar origen en mutaciones y preferir `SameSite=Lax/Strict` cuando la topología lo permita.

#### A-03 — PIN global de cuatro dígitos y búsqueda contra todos los usuarios

`/api/admin/auth/pin-login` recibe sólo un PIN de 4 dígitos. El servicio carga todos los usuarios activos con PIN y ejecuta bcrypt hasta encontrar coincidencia. No se observa limitación por IP/cuenta en este flujo ni garantía de PIN único.

**Impacto:** espacio de búsqueda de sólo 10,000 valores, enumeración por fuerza bruta, ambigüedad si dos usuarios comparten PIN y coste lineal creciente.

**Recomendación:** pedir identificador + PIN, limitar intentos por usuario/IP, aumentar entropía, imponer unicidad lógica o reemplazar por un mecanismo autenticado más fuerte.

#### A-04 — Tokens Bearer persistidos en `localStorage`

La PWA conserva tokens de conductor/supervisor y algunas vistas administrativas consultan `adminToken` desde `localStorage`. Cualquier XSS podría extraerlos. Además, mezclar cookie y Bearer aumenta complejidad y superficies de fallo.

**Recomendación:** estandarizar sesión en cookie `httpOnly` segura; reforzar CSP, sanitización y rotación/revocación de tokens.

#### A-05 — No existe suite de pruebas automatizadas

El backend tiene un `npm test` marcador que falla deliberadamente y los frontends no definen tests. No hay pruebas unitarias, integración, contrato API, autorización por rol, migraciones ni end-to-end.

**Impacto:** las regresiones en seguridad y estados de viaje sólo se detectan manualmente.

**Recomendación:** priorizar tests de los hallazgos críticos; después cubrir transiciones de viaje, propiedad, GPS offline/idempotencia, cookies, roles, inspecciones y migraciones.

### Medios

#### M-01 — La PWA no pasa lint por uso condicional de Hooks

`frontend/src/pages/SupervisorPortal.jsx:197` llama `useState` condicionalmente. Esto viola el orden estable de Hooks y puede producir estado asociado al Hook equivocado entre renders. El lint devolvió código 1.

También hay 14 advertencias en la PWA (dependencias de Hooks y símbolos sin uso) y 23 advertencias en el panel.

#### M-02 — Dos mecanismos de service worker compiten

Vite PWA genera y registra `dist/sw.js`, mientras existe `frontend/public/sw.js` y `main.jsx` registra manualmente `./sw.js`. Durante build, el archivo generado ocupa ese mismo nombre, por lo que el comportamiento del archivo manual no es fiable y la doble registración dificulta diagnosticar caché/versiones.

**Recomendación:** conservar una sola estrategia, preferiblemente `vite-plugin-pwa`, incorporando allí toda regla requerida y eliminando registro/archivo redundantes.

#### M-03 — Cambios de esquema durante el arranque y errores silenciados

`server.js` ejecuta `ALTER TABLE`/constraints al iniciar y agrega `.catch(() => {})`. Esto mezcla despliegue con migración, puede ocultar permisos/esquema incorrectos y hace que el estado real difiera del historial versionado.

**Recomendación:** ejecutar únicamente migraciones versionadas, registrar su versión aplicada y hacer fallar el despliegue si no se pueden aplicar/verificar.

#### M-04 — Las migraciones son manuales y no se ejecutan en Compose/Render

Los volúmenes montan SQL, pero no hay servicio/job que ejecute `database/scripts/migrate.sql`. Tampoco existe tabla de control, rollback o verificación automática. Una base nueva puede estar saludable pero sin esquema.

#### M-05 — Archivos monolíticos y duplicación

Hay componentes/servicios de 900–1,900 líneas y un CSS de 3,612 líneas. `EvaluacionApp.jsx` aparece tanto en PWA como en panel con implementaciones muy similares. Esto aumenta acoplamiento, conflictos y divergencia funcional.

**Recomendación:** extraer hooks, componentes, validadores y cliente API por dominio; crear un paquete compartido sólo para código realmente común.

#### M-06 — Sin paginación uniforme y potenciales consultas costosas

Algunos listados usan filtros/límites, pero otros cargan colecciones completas. El login por PIN carga todos los hashes activos. A medida que crezcan viajes/GPS/usuarios, esto afectará memoria, latencia y base de datos.

#### M-07 — Observabilidad limitada

El backend usa `console.log/error/warn` de manera dispersa, incluyendo datos de OAuth. No se observan logs estructurados, correlation ID, métricas, alertas, tracing ni manejo central de errores de dominio.

#### M-08 — Política de carga local incompleta

`/uploads` se sirve como directorio estático sin cabeceras específicas, autenticación o política documentada de retención. Aunque `uploads/` está ignorado por Git, falta confirmar validación de tipo/tamaño, nombres seguros, respaldo y autorización de lectura.

#### M-09 — Configuración divergente entre entornos

- El Dockerfile del backend arranca con `npm run dev`/nodemon por defecto; producción lo sobrescribe desde Compose, pero una ejecución directa de la imagen no es productiva.
- `compose.yml` publica PostgreSQL en todas las interfaces (`5433:5432`), mientras producción sí usa loopback.
- `DRIVER_JWT_SECRET`, `DRIVER_JWT_EXPIRES_IN`, `DRIVER_COOKIE_NAME`, `DATABASE_SSL`, `DATABASE_RETRY_DELAY_MS`, `TELEGRAM_SUPERVISOR_CHAT_ID` y la grafía correcta `TELEGRAM_GROUP_SUPERVISOR_ID` se usan en código pero no están claramente cubiertas en `.env.example`/todos los despliegues.
- Conviven la variable histórica con error tipográfico `TELEGRAM_GROUP_SUPRVISOR_ID` y la variante correcta.

### Bajos / higiene del repositorio

#### B-01 — README principal insuficiente y documentación desactualizada

El README raíz sólo describe el alcance inicial. `database/README.md` todavía habla de tres migraciones aunque existen veinte. `RESUMEN_PROYECTO.md` omite módulos recientes o los describe de forma parcial.

#### B-02 — Artefactos sensibles ignorados pero presentes en el directorio

Existen localmente `admin-cookies.txt` y `respaldo-gerenciamiento-viajes.dump`. Git los ignora y no aparecen versionados, lo cual es positivo, pero siguen siendo material sensible dentro del proyecto y podrían copiarse en respaldos, tickets o paquetes.

**Recomendación:** moverlos a almacenamiento seguro fuera del repositorio, invalidar sesiones antiguas y cifrar/gestionar dumps conforme a política.

#### B-03 — Artefactos binarios y duplicados

Hay diagramas de inspección repetidos en raíz, backend, frontend y panel; además se versiona un PDF de muestra y un video de 2.3 MB. Conviene definir una fuente canónica o pipeline de assets.

#### B-04 — Paquete CodeQL testimonial

Existe un paquete de consultas personalizadas con un ejemplo, pero no se observó workflow CI que ejecute CodeQL, lint, build o tests. Su presencia no aporta protección continua por sí sola.

## 7. Verificaciones ejecutadas

| Comando/verificación | Resultado |
| --- | --- |
| `npm run build` en `frontend` | Correcto; bundle principal ~331 kB, gzip ~96 kB. |
| `npm run lint` en `frontend` | Falló: 1 error de Hooks y 14 advertencias. |
| `npm run build` en `panel-admin` | Correcto; bundle principal ~570 kB, gzip ~153 kB. |
| `npm run lint` en `panel-admin` | Correcto con 23 advertencias; Vite advierte chunk >500 kB. |
| `node --check src/server.js` y `src/app.js` | Correcto. |
| Estado Git antes del análisis | Limpio. |
| Pruebas backend | No disponibles (`npm test` es marcador). |
| Base/integraciones reales | No ejecutadas para evitar modificar servicios o datos. |

Los builds generaron carpetas `dist/`, pero están ignoradas por Git.

## 8. Plan de remediación sugerido

### Primeras 24 horas

1. Deshabilitar `tenant-login` y `registro-publico` en cualquier entorno accesible.
2. Corregir C-01, revisar cuentas administrativas y rotar secretos/sesiones.
3. Proteger GPS y gerenciamiento con autenticación, propiedad y roles del servidor.
4. Restringir `CORS_ORIGINS` explícitamente en producción.
5. Añadir pruebas negativas que demuestren que llamadas anónimas reciben 401/403.

### Siguiente iteración

1. Añadir CSRF, rate limiting y endurecer el login por PIN.
2. Corregir el Hook condicional y dejar ambos lint en cero errores.
3. Unificar service worker y estrategia de sesión.
4. Incorporar runner de migraciones con tabla de versiones.
5. Crear CI: instalación limpia, lint, tests, build, auditoría de dependencias y análisis de secretos.

### Mediano plazo

1. Dividir componentes y servicios monolíticos.
2. Agregar observabilidad estructurada y auditoría de acciones críticas.
3. Documentar modelo de permisos, diagramas de estados y runbooks de recuperación.
4. Probar restauración de backups y ciclo completo en un entorno staging.
5. Optimizar carga del panel con lazy loading/code splitting y paginación consistente.

## 9. Criterio de salida recomendado para producción

Antes de considerar el sistema apto para producción deberían cumplirse, como mínimo:

- cero endpoints críticos anónimos;
- autenticación Entra ID basada sólo en tokens/códigos verificados;
- ninguna selección de rol o identidad privilegiada confiada al cliente;
- protección CSRF, CORS cerrado y rate limiting;
- tests de autorización y estados de negocio en CI;
- ambos frontends compilando y pasando lint;
- migraciones reproducibles sobre una base vacía y sobre una copia de producción;
- prueba end-to-end de conductor, supervisor y administrador;
- monitoreo, respaldo y procedimiento de recuperación documentados.

## 10. Conclusión

El proyecto tiene una base funcional amplia y evidencia de evolución rápida. Su principal problema no es la falta de funciones, sino que algunas incorporaciones recientes evitaron las fronteras de autenticación que sí están bien aplicadas en otros módulos. La prioridad debe ser cerrar esas rutas y consolidar un modelo único de identidad/autorización. Después, pruebas automatizadas, migraciones controladas y modularización darán el mayor retorno en estabilidad y mantenibilidad.
