# Rollback — Mejora de tracking GPS (puntos 1 y 2)

> **DESACTUALIZADO EN PARTE (revisar antes de usar).** Este documento se escribió
> con `HEAD = 9ddf8d2`. Desde entonces la rama avanzó hasta `11cbedd`, con los
> commits del keep-alive de audio (`1fe13c9`, `11cbedd`). En ese avance
> **`frontend/src/services/location-provider.js` volvió a `maximumAge: 10000`**
> y `tracking-service.js` perdió el descarte de fixes repetidos: las correcciones
> de captura de las fases 1 y 2 **ya no están en el árbol de trabajo**.
>
> **Resuelto el 2026-09-10** (ver sección 9): las correcciones de captura se
> reaplicaron sobre `5b3d0bf`, conservando el keep-alive de audio y el respaldo
> Xiaomi. Las fases 2 (ubicación en vivo) y 3 (OSRM) siguen vigentes.

**Fecha:** 2026-09-09
**Rama:** `feature/AWS-deploy`
**Commit base (HEAD antes del cambio):** `9ddf8d2` — *modificacion de PDF de sharepoint*
**Etiqueta de respaldo:** `20260909-1250`

---

## 1. Contexto

Se detectó que la traza GPS dibuja rectas irreales sobre el mapa. Causa raíz: el proveedor
de ubicación devuelve **posiciones cacheadas repetidas**. En el viaje 23 (`VJ-20260901-0002`)
hay **73 filas GPS pero solo 9 coordenadas distintas**, con precisión idéntica repetida
(`5.10`, `3.10`), lo que confirma reutilización de un mismo fix.

Alcance de este cambio:

1. **Captura de posiciones reales** — `location-provider.js` / `tracking-service.js`
2. **Render del mapa** — polilínea con todos los muestreos y marcadores solo en paradas técnicas (`TripMap.jsx`)

El punto 3 (map matching contra la red vial) queda **fuera de alcance**, pendiente de decisión.

### Iteración 2 (misma fecha) — `watchPosition`

La primera versión eliminó los fixes cacheados (viaje `VJ-20260909-0003`: 14 filas / 14
coordenadas distintas, 100% únicas), pero dejó el muestreo irregular: intervalo promedio
de 68 s contra 30 s esperados, con huecos de hasta 324 s. Causa: cada muestreo arrancaba
el chip GPS en frío y expiraba.

Se sustituyó el muestreo bajo demanda por una **suscripción continua (`watchPosition`)**
que mantiene el receptor activo y deja la última lectura lista para cada intervalo.
Afecta a los **mismos dos archivos**, sobre el **mismo commit base**, por lo que el
procedimiento de rollback descrito aquí sigue siendo válido sin cambios.

---

## 2. Archivos afectados

| Archivo | Hash en `9ddf8d2` |
|---|---|
| `frontend/src/services/location-provider.js` | `a778db82aaeaf1298648f1685685e09f75a498db` |
| `frontend/src/services/tracking-service.js` | `3f53fe34d133817f44fb1cf04eb2882591e87ca6` |
| `panel-admin/src/components/TripMap.jsx` | `d12ab9506c1212c23f4e4fa506dda01468ed1d1c` |

Los tres estaban **limpios respecto a HEAD** antes de empezar, por lo que se pueden
restaurar individualmente con `git checkout HEAD -- <archivo>`.

> ⚠️ **No ejecutar `git checkout .` ni `git stash`.** El working tree tiene cambios
> previos ajenos a este trabajo que se perderían:
> `backend/package-lock.json`, `backend/src/controllers/admin-conductores.controller.js`,
> `backend/src/controllers/telegram-auth.controller.js`, `backend/src/utils/file-storage.js`,
> `frontend/package-lock.json`, y los borrados de `ngrok-entrypoint.sh`, `ngrok.yml`, `render.yaml`.

---

## 3. Respaldos creados

**Copias físicas de los archivos** (fuera de git, ignoradas por `.gitignore`):

```
backups/gps-tracking-20260909-1250/
├── location-provider.js
├── tracking-service.js
└── TripMap.jsx
```

**Imágenes Docker en ejecución, etiquetadas antes del cambio:**

| Servicio | Etiqueta de rollback | Image ID |
|---|---|---|
| frontend | `viajes-frontend:rollback-20260909-1250` | `15b6d839dea9` |
| panel-admin | `viajes-panel-admin:rollback-20260909-1250` | `2e818cf0d7ea` |

El despliegue corre con **`compose.prod.yml`** sobre la red `viajes_network_prod`
(no `compose.yml`). Puertos: frontend `127.0.0.1:8080->80`, panel-admin `127.0.0.1:8081->80`.

---

## 4. Cómo revertir

### Opción rápida (script)

```bash
./scripts/rollback-gps-tracking.sh completo
```

Restaura los tres archivos desde `9ddf8d2` y reconstruye `frontend` y `panel-admin`.
Variantes: `codigo` (solo archivos) o `imagenes` (solo contenedores, sin recompilar).

### Opción manual

Restaurar el código:

```bash
git -c safe.directory=$PWD checkout HEAD -- frontend/src/services/location-provider.js frontend/src/services/tracking-service.js panel-admin/src/components/TripMap.jsx
```

Reconstruir y desplegar:

```bash
docker compose -f compose.prod.yml up -d --build frontend panel-admin
```

Si la reconstrucción falla, volver a las imágenes previas sin compilar:

```bash
./scripts/rollback-gps-tracking.sh imagenes
```

---

## 5. Verificación post-rollback

```bash
docker ps --filter name=viajes- --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

Los cuatro contenedores (`postgres`, `backend`, `frontend`, `panel-admin`) deben quedar
`healthy`. Después, iniciar un viaje de prueba y confirmar que siguen llegando puntos:

```bash
docker exec viajes-postgres psql -U viajes_admin_prod -d gerenciamiento_viajes_prod -c "SELECT v.folio, count(*) AS puntos, max(u.creado_en) AS ultimo FROM ubicaciones_viaje u JOIN viajes v ON v.id_viajes=u.id_viajes JOIN estados_viaje e ON e.id_estado_viaje=v.id_estado_viaje WHERE e.nombre='EN_CURSO' GROUP BY v.folio;"
```

---

## 6. Nota sobre los datos

**El rollback no toca la base de datos.** Los cambios son solo de captura y
presentación; no hay migraciones ni escrituras destructivas. Los puntos GPS ya
almacenados (incluidos los duplicados por fix cacheado) permanecen intactos, así
que revertir es seguro y no hay pérdida de información histórica.

---

## 7. Fase 2 — Ubicación en vivo de Telegram (2026-09-09)

### Por qué

La Mini App no se ejecuta en segundo plano. En el viaje `VJ-20260909-0006` se
registraron 7 puntos en 85 minutos (~3% de cobertura): un punto capturado a las
14:10:33 se entregó hasta las 15:32:31 y en ese lapso no hubo captura alguna.
Con viajes reales de 30 min a 2+ horas, la solución es que la app nativa de
Telegram —con permiso de GPS en segundo plano— envíe la posición al bot.

### Archivos afectados

| Archivo | Estado previo |
|---|---|
| `database/migrations/024_origen_ubicaciones_viaje.sql` | nuevo |
| `database/scripts/migrate.sql` | limpio en `9ddf8d2` |
| `backend/src/services/telegram-live-location.service.js` | nuevo |
| `backend/src/services/ubicaciones.service.js` | limpio en `9ddf8d2` |
| `backend/src/bot/bot.js` | limpio en `9ddf8d2` |
| `backend/src/bot/bot.handlers.js` | limpio en `9ddf8d2` |
| `backend/src/controllers/viajes.controller.js` | limpio en `9ddf8d2` |

Imagen previa etiquetada: `viajes-backend:rollback-20260909-1250` (`8ca46284bacb`).

### Rollback de la base de datos

La migración solo **agrega** la columna `origen` con valor por defecto; no toca
ningún dato existente. Para revertirla:

```bash
docker exec -i viajes-postgres psql -U viajes_admin_prod -d gerenciamiento_viajes_prod \
  -v ON_ERROR_STOP=1 < backups/gps-tracking-20260909-1250/024_origen_ubicaciones_viaje_DOWN.sql
```

**El rollback del código puede hacerse sin revertir la base.** Dejar la columna
`origen` con una tabla sin código que la use es inofensivo: tiene DEFAULT y los
INSERT previos no la mencionan. Revertir solo la base sin el código, en cambio,
rompería los INSERT; si vas a revertir ambas, hazlo en ese orden: primero código,
después base.

### Rollback del código

```bash
git -c safe.directory=$PWD checkout HEAD -- \
  database/scripts/migrate.sql \
  backend/src/services/ubicaciones.service.js \
  backend/src/bot/bot.js \
  backend/src/bot/bot.handlers.js \
  backend/src/controllers/viajes.controller.js

rm -f backend/src/services/telegram-live-location.service.js \
      database/migrations/024_origen_ubicaciones_viaje.sql

docker compose -f compose.prod.yml up -d --build backend
```

Los dos archivos nuevos se borran porque no existen en `9ddf8d2` y `git checkout`
no los quitaría.

### Advertencia previa, ajena a este cambio

`database/scripts/migrate.sql` invoca `020_conductor_pin_and_approval.sql`,
`021_reportes_vehiculares.sql`, `022_licencia_imagen.sql` y
`023_gerenciamiento_sharepoint_and_pdf.sql`, que **no existen en el repositorio
ni en el historial de git**, aunque sus cambios sí están aplicados en la base de
producción (`conductores.pin_hash` existe). Una instalación limpia desde este
repositorio falla. Es un problema anterior a este trabajo y está registrado como
tarea aparte.

---

## 8. Fase 3 — Map matching con OSRM autohospedado (2026-09-09)

### Por qué autohospedado

El servidor demo público `router.project-osrm.org` rechaza más de **10
coordenadas** por petición (`code: TooBig`, verificado). Eso obligaba a partir la
traza en bloques de 8, lo que hundía la confianza del ajuste. Con instancia
propia y `--max-matching-size 1000` un viaje entero va en una sola petición.
Además las coordenadas de los conductores no salen a un tercero.

### Componentes nuevos

| Archivo | Estado previo |
|---|---|
| `compose.osrm.yml` | nuevo |
| `scripts/osrm-build.sh` | nuevo |
| `scripts/osrm-match.py` | nuevo |
| `backend/src/services/map-matching.service.js` | nuevo |
| `backend/src/controllers/admin-ubicaciones.controller.js` | limpio en `9ddf8d2` |
| `backend/src/routes/admin-ubicaciones.routes.js` | limpio en `9ddf8d2` |
| `compose.prod.yml`, `compose.staging.yml` | variables `OSRM_URL`, `OSRM_MIN_CONFIDENCE` |

Endpoint: `GET /api/admin/ubicaciones-viaje/:idViaje/ruta-ajustada`

Datos del grafo (fuera del repositorio): `/home/josuetovar/traslado_Local/osrm-data`, 759 MB.

### La compuerta de confianza

Por debajo de `OSRM_MIN_CONFIDENCE` (0.5) un tramo se marca `fiable: false` y
**no debe dibujarse como recorrido**. Razón medida sobre datos reales: el viaje
`VJ-20260901-0002`, con solo 9 coordenadas distintas, produjo una ruta de
**32,337 m** con confianza 0.010. Se dibujaría perfecta sobre las calles y sería
enteramente inventada — en un sistema de auditoría eso es peor que un hueco
visible.

La confianza global se pondera por distancia, no por el máximo entre tramos:
una traza puede traer un tramo corto con confianza alta y el grueso en cero.

### Rollback

El servicio de OSRM es **independiente**: apagarlo no rompe nada. El endpoint
degrada solo y devuelve `disponible: false` con el motivo, conservando los
conteos de puntos (verificado apuntando `OSRM_URL` a un puerto muerto).

Apagar solo OSRM:

```bash
docker compose -f compose.osrm.yml down
```

Revertir el código del backend:

```bash
git -c safe.directory=$PWD checkout HEAD -- \
  backend/src/controllers/admin-ubicaciones.controller.js \
  backend/src/routes/admin-ubicaciones.routes.js \
  compose.prod.yml compose.staging.yml

rm -f backend/src/services/map-matching.service.js compose.osrm.yml \
      scripts/osrm-build.sh scripts/osrm-match.py

docker compose -f compose.prod.yml up -d --build backend
```

Eliminar los datos del grafo (759 MB):

```bash
rm -rf /home/josuetovar/traslado_Local/osrm-data
```

No hay cambios de base de datos en esta fase.

---

## 9. Fase 4 — Reaplicación de la captura y matching por backend (2026-09-10)

**Commit base:** `5b3d0bf`

### Qué pasó

Los commits del keep-alive de audio dejaron `location-provider.js` con
`maximumAge: 10000` y `tracking-service.js` sin el descarte de fixes repetidos.
Eso reintrodujo la causa raíz original: el navegador vuelve a entregar
posiciones cacheadas. Las dos cosas son complementarias, no alternativas — el
audio mantiene vivo el hilo de JavaScript, `maximumAge: 0` evita que la
posición venga de caché.

### Reaplicado, conservando lo existente

`frontend/src/services/location-provider.js`
- `maximumAge: 0` en los **dos** intentos (alta precisión y respaldo Xiaomi/MIUI,
  que se conservó tal cual).
- `watchPosition` con huella del fix (`locationFingerprint`).
- Telegram: se mapean `speed` y `course`, antes descartados.

`frontend/src/services/tracking-service.js`
- Descarte de muestreos con la misma huella que el anterior; las paradas
  técnicas nunca se descartan.
- `startLocationWatch()` / `stopLocationWatch()` en el ciclo de tracking.
- **El keep-alive de audio quedó intacto** (`startSilentAudioKeepAlive`).

`panel-admin/src/services/osrm-road-matching.js`
- Vía principal: el backend propio (`/ruta-ajustada`), un viaje por petición,
  con la compuerta de confianza.
- Los bloques de 8 contra el servidor público **se conservan como respaldo**
  si el backend no responde.

`TripMap.jsx`, `ViajesPage.jsx`, `UbicacionesPage.jsx`: propagan `idViaje`.

### Respaldos

`backups/gps-tracking-20260910-recaptura/` con las tres versiones previas.

### Rollback

```bash
git -c safe.directory=$PWD checkout HEAD -- \
  frontend/src/services/location-provider.js \
  frontend/src/services/tracking-service.js \
  panel-admin/src/services/osrm-road-matching.js \
  panel-admin/src/components/TripMap.jsx \
  panel-admin/src/pages/ViajesPage.jsx \
  panel-admin/src/pages/UbicacionesPage.jsx
```

Verificado en los bundles desplegados en pruebas: `maximumAge:0` es el único
valor presente, `watchPosition` y `createOscillator` conviven, y el panel
consume `ruta-ajustada`.
