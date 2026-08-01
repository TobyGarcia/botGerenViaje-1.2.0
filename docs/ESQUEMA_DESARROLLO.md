# Esquema de desarrollo — Gerenciamiento de Viajes

## 1. Propósito

Este documento define la estructura de desarrollo del sistema de gerenciamiento de viajes: una Mini App de Telegram para conductores, un panel web administrativo, una API con bot de Telegram y una base de datos PostgreSQL.

El objetivo operativo es registrar, controlar y consultar el ciclo completo de un viaje, incluyendo conductor, unidad, lugares, kilometraje, estado y ubicación GPS.

## 2. Arquitectura objetivo

```text
Conductor
  └─ Telegram Mini App (React/Vite) ─┐
                                     ├─ API REST + Bot (Node.js/Express/Telegraf)
Administrativo                       │             └─ PostgreSQL
  └─ Panel administrativo (React) ───┘

Infraestructura: Docker Compose · Nginx · ngrok (desarrollo) · Render (despliegue documentado)
```

| Componente | Responsabilidad principal | Estado actual |
|---|---|---|
| `frontend/` | Captura y seguimiento de viajes del conductor desde Telegram. | Funcional para autenticación, registro, creación, inicio, cancelación/finalización y GPS. |
| `panel-admin/` | Consulta y administración operativa. | Dashboard, conductores, vehículos, destinos, ubicaciones y viajes presentes. |
| `backend/` | API, reglas de negocio, seguridad, acceso a datos y bot. | Implementado por rutas, controladores y servicios. |
| `database/` | Esquema, migraciones, semillas e integridad de datos. | Cinco migraciones versionadas. |
| Raíz del repositorio | Orquestación local y configuración de entorno. | `compose.yml`, ngrok y variables de entorno. |

## 3. Dominios funcionales

| Dominio | Capacidades | Entidades principales |
|---|---|---|
| Identidad | Validar `initData` de Telegram, alta de conductor y bloqueo de acceso. | `usuarios_telegram`, `conductores` |
| Administración | Login con cookie/JWT y permisos por rol. | `usuarios_admin` |
| Catálogos | Gestionar conductores, unidades, destinos y estados. | `conductores`, `vehiculos`, `lugares`, `estados_viaje` |
| Viajes | Crear, iniciar, finalizar, cancelar y consultar viajes. | `viajes`, `historial_estados_viaje` |
| Kilometraje | Registrar lecturas y correcciones auditables por unidad. | `historial_kilometraje_vehiculos` |
| Rastreo | Capturar, conservar temporalmente y sincronizar ubicaciones GPS. | `ubicaciones_viaje` |
| Operación | Indicadores, detalle, mapa e historial. | Vistas/API de administración |

## 4. Flujo principal de negocio

```text
Autenticación Telegram → Registro de conductor (si aplica)
 → Crear viaje (PENDIENTE) → Iniciar (EN_CURSO) → GPS periódico
 → Finalizar (FINALIZADO) → Actualizar kilometraje e historial

En PENDIENTE o EN_CURSO: Cancelar → CANCELADO
```

Reglas que deben mantenerse en todas las capas:

- El conductor debe estar activo y tener licencia vigente.
- La unidad debe estar activa y el kilometraje inicial no puede ser menor al registrado.
- Origen y destino deben ser distintos.
- El kilometraje final debe ser mayor o igual al inicial.
- Cada transición debe quedar en el historial de estados.
- Las ubicaciones deben pertenecer a un viaje válido; la clave de cliente evita duplicados de sincronización.

## 5. Estructura recomendada del repositorio

```text
docs/
  ESQUEMA_DESARROLLO.md      # este documento
  API.md                     # contratos, ejemplos y códigos de error
  DECISIONES.md              # decisiones arquitectónicas (ADR ligeros)
  OPERACION.md               # despliegue, monitoreo y recuperación
backend/
  src/routes/                # declaración de endpoints
  src/controllers/           # entrada/salida HTTP y validación
  src/services/              # reglas de negocio y SQL
  src/middlewares/           # autenticación y manejo transversal
  src/utils/                 # utilidades puras
  src/bot/                   # interacción de Telegram
  tests/                     # unitarias e integración
frontend/
  src/components/            # componentes reutilizables
  src/services/              # API, GPS, cola local y estado
  src/tests/                 # pruebas de interfaz y servicios
panel-admin/
  src/pages/                 # módulos del panel
  src/components/            # tabla, filtros, mapa, modales, etc.
  src/services/              # API y sesión
  src/tests/                 # pruebas de interfaz
database/
  migrations/                # cambios incrementales e inmutables
  seeds/                     # datos solo para desarrollo
  scripts/                   # ejecución explícita de migraciones/seeds
```

## 6. Plan por fases

### Fase 0 — Baseline técnico

Objetivo: establecer una versión repetible antes de ampliar funcionalidad.

- Revisar y corregir inconsistencias entre importaciones, rutas, clientes API y documentación.
- Actualizar `database/scripts/migrate.sql` para incluir las migraciones 004 y 005.
- Documentar contratos actuales en `docs/API.md`.
- Eliminar secretos, cookies y respaldos de seguimiento si contienen datos sensibles; conservarlos fuera del repositorio o cifrados.
- Definir entornos `local`, `staging` y `producción` mediante `.env.example`.

Criterio de salida: `docker compose up --build`, los tres clientes responden y se ejecuta una prueba manual del viaje completo.

### Fase 1 — Calidad y seguridad básica

Objetivo: proteger los flujos existentes y hacerlos verificables.

- Incorporar pruebas de servicios y endpoints: autenticación, viajes, kilometraje, ubicaciones y administración.
- Añadir pruebas de componentes para formularios, sesión, filtros y estados de error.
- Validar las entradas en servidor con mensajes consistentes y códigos HTTP definidos.
- Establecer roles administrativos y aplicar autorización por acción, no solo por sesión.
- Configurar cookies seguras en producción, CORS con orígenes permitidos, limitación de intentos y registro estructurado.

Criterio de salida: compilación, lint y pruebas automatizadas ejecutables en cada cambio; rutas protegidas cubiertas por pruebas.

### Fase 2 — Gestión administrativa completa

Objetivo: dejar al panel listo para operación diaria.

- Conductores: edición de datos y licencia, historial y vínculo Telegram.
- Vehículos: edición, baja/reactivación, historial de kilometraje, correcciones con motivo y auditoría.
- Destinos: alta, edición, geocoordenadas, estado y validación geográfica.
- Viajes: filtros por fecha/estado/unidad/conductor, detalle, historial, mapa y cancelación controlada.
- Ubicaciones: vista cronológica y mapa con manejo de viajes sin señal o con datos incompletos.
- Dashboard: indicadores con periodo configurable y enlaces a listas filtradas.

Criterio de salida: un administrador puede operar todos los catálogos y revisar cualquier viaje sin consultas directas a la base.

### Fase 3 — Robustez de la Mini App

Objetivo: hacer confiable el uso en campo con conectividad variable.

- Formalizar la cola local de GPS: persistencia, reintentos con backoff, límite de almacenamiento y limpieza tras sincronizar.
- Mostrar permisos, precisión, última sincronización y fallos de ubicación de forma comprensible.
- Recuperar un viaje en curso al reabrir la Mini App.
- Prevenir operaciones duplicadas mediante idempotencia para creación, inicio, finalización y ubicaciones.
- Verificar los flujos en Android/iOS dentro de Telegram y con red intermitente.

Criterio de salida: un viaje activo puede continuarse tras cerrar/abrir la aplicación y las ubicaciones pendientes se sincronizan sin duplicados.

### Fase 4 — Operación, entrega y evolución

Objetivo: desplegar con trazabilidad y capacidad de recuperación.

- Crear pipeline CI: instalación limpia, lint, pruebas, build y análisis de migraciones.
- Definir despliegue a staging antes de producción, incluyendo variables y dominios por entorno.
- Configurar healthchecks, logs centralizados, alertas de errores y seguimiento de disponibilidad.
- Definir respaldo/restauración de PostgreSQL, retención y simulacro de recuperación.
- Publicar guía operativa para altas, bajas, atención de fallos GPS y liberación de versiones.

Criterio de salida: una versión puede desplegarse y revertirse siguiendo instrucciones documentadas, con respaldos verificables.

## 7. Orden de implementación recomendado

1. Consolidar migraciones, contratos de API y variables de entorno.
2. Cubrir con pruebas los flujos actuales de autenticación, viaje y kilometraje.
3. Terminar la operación administrativa de vehículos, destinos, viajes y ubicaciones.
4. Fortalecer la cola GPS y recuperación de sesión/viaje de la Mini App.
5. Añadir roles, auditoría transversal, CI/CD, monitoreo y recuperación.

## 8. Estándares de desarrollo

- Una funcionalidad debe incluir interfaz, endpoint, reglas de negocio, migración si aplica, pruebas y documentación.
- Las migraciones son incrementales: no se modifica una ya aplicada; se crea una nueva con avance y, cuando sea viable, reversión documentada.
- Los controladores no contienen SQL; el acceso a datos y las transacciones viven en servicios.
- Todo cambio de estado, kilometraje manual o acción administrativa relevante debe ser auditable con usuario, fecha y motivo.
- Las respuestas API deben conservar una convención estable: `success`, `data`, `message` y errores de validación cuando correspondan.
- Ningún secreto, cookie de sesión, token o respaldo con datos reales debe entrar al control de versiones.

## 9. Definition of Done

Una historia se considera terminada cuando:

- Cumple criterios funcionales y validaciones de negocio.
- Tiene pruebas automatizadas pertinentes y estas pasan.
- No rompe compilación, lint ni endpoints existentes.
- Incluye migración/seed cuando cambia el modelo de datos.
- Actualiza contratos API y notas operativas si afecta a usuarios o despliegue.
- Fue validada en el entorno objetivo; en la Mini App, desde Telegram en un dispositivo móvil.

## 10. Riesgos a controlar

| Riesgo | Mitigación |
|---|---|
| Señal GPS o internet intermitente | Cola local idempotente, reintentos y visibilidad del estado. |
| Lecturas de odómetro incorrectas | Validación, historial inmutable y correcciones justificadas. |
| Sesiones o secretos expuestos | Variables de entorno, cookies seguras, rotación y exclusión de Git. |
| Migraciones aplicadas de forma desigual | Flujo de migración versionado en CI/staging y respaldo previo. |
| Crecimiento de ubicaciones GPS | Índices, política de retención/archivo y consultas paginadas. |
| Diferencias entre interfaz y API | Contratos documentados y pruebas de integración. |

## 11. Indicadores de éxito

- Porcentaje de viajes completados con historial y kilometraje consistentes.
- Porcentaje de ubicaciones sincronizadas y tiempo medio de sincronización.
- Errores de autenticación, GPS y API por versión.
- Tiempo de respuesta de las consultas de viaje y ubicación.
- Cobertura de pruebas de los flujos críticos.

---

Última actualización: 2026-08-01.
