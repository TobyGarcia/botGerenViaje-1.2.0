# Resumen del proyecto: Gerenciamiento de Viajes

> Estado documentado a partir de la implementación actual del repositorio. Un módulo marcado como **funcional implementado** cuenta con interfaz y/o endpoints, lógica de negocio y persistencia. Su operación final requiere la configuración de variables de entorno, PostgreSQL y, cuando aplique, Telegram.

## Propósito

Sistema para administrar los viajes de vehículos. Permite que un conductor, autenticado desde Telegram, registre y opere un viaje; mientras tanto, el personal administrativo consulta catálogos, viajes, ubicación GPS y kilometraje desde un panel web protegido.

## Arquitectura

| Componente | Tecnología | Responsabilidad |
| --- | --- | --- |
| `frontend/` | React 19 + Vite | Mini App de Telegram para conductores: registro, creación y operación de viajes, y envío de GPS. |
| `backend/` | Node.js + Express 5 | API REST, autenticación, reglas de negocio, bot de Telegram y acceso a la base de datos. |
| `panel-admin/` | React 19 + Vite + Leaflet | Panel administrativo para consultar y administrar la operación. |
| `database/` | PostgreSQL | Migraciones, semillas y scripts de inicialización de los datos operativos. |
| Infraestructura | Docker Compose, Render y ngrok | Ejecución local con contenedores, exposición para Telegram y despliegue documentado en Render. |

## Módulos funcionales implementados

| Módulo | Estado | Alcance actual |
| --- | --- | --- |
| Autenticación de conductores por Telegram | Funcional implementado | Valida `initData` de Telegram, crea/consulta usuarios de Telegram y restringe las operaciones al conductor activo asociado. |
| Registro de conductor desde la Mini App | Funcional implementado | Un usuario de Telegram puede completar su información y quedar vinculado a un conductor. |
| Bot de Telegram | Funcional implementado | Atiende comandos, muestra ayuda y abre la Mini App para registro y operación de viajes. |
| Catálogos para conductores | Funcional implementado | Consulta conductores, vehículos, lugares/destinos y estados de viaje para el flujo de captura. |
| Creación de viajes | Funcional implementado | Registra viajes pendientes con conductor, vehículo, origen, destino, fecha, observaciones y lectura inicial de kilometraje. |
| Ciclo de vida del viaje | Funcional implementado | Permite iniciar, finalizar y cancelar viajes; actualiza horas, estados e historial, y evita conflictos de vehículo en viajes activos. |
| Historial de estados | Funcional implementado | Persiste cada transición de estado del viaje. |
| Rastreo GPS | Funcional implementado | Captura ubicaciones durante un viaje en curso, admite sincronización de pendientes y evita duplicados mediante identificador de ubicación del cliente. |
| Kilometraje de vehículos | Funcional implementado | Registra lecturas iniciales/finales por viaje y el panel permite consultar resumen, historial y correcciones administrativas. |
| Autenticación administrativa | Funcional implementado | Inicio/cierre de sesión mediante cookies, validación de cuenta activa y protección de rutas administrativas. Incluye script para crear usuarios administradores. |
| Administración de conductores | Funcional implementado | Panel y API para listar, crear, editar y activar/desactivar conductores. |
| Administración de vehículos | Funcional implementado | Panel y API para listar, crear, editar y activar/desactivar vehículos, además de kilometraje. |
| Administración de destinos | Funcional implementado | Panel y API para administrar destinos y su estado activo/inactivo. |
| Consulta de viajes | Funcional implementado | Panel para listar, filtrar, ver detalle y eliminar viajes. |
| Consulta de ubicaciones y mapa | Funcional implementado | Consulta de puntos GPS por viaje y visualización de ruta/mapa mediante Leaflet. |
| Tablero administrativo | Funcional implementado | Indicadores de conductores, vehículos y viajes; actividad reciente y acceso a los módulos administrativos. |
| Salud de la API | Funcional implementado | Endpoint `GET /health` para comprobación del servicio. |

## Modelo de datos principal

La base de datos incluye entidades para conductores, vehículos, lugares/destinos, viajes, estados de viaje, historial de estados, ubicaciones GPS, usuarios de Telegram, usuarios administradores e historial de kilometraje. Las migraciones añaden autenticación, control de usuarios y protección contra ubicaciones GPS duplicadas.

Los catálogos iniciales se cargan desde `database/seeds/` y las migraciones se ejecutan con los scripts de `database/scripts/`.

## Flujos operativos

1. El conductor abre el bot de Telegram y accede a la Mini App.
2. La Mini App valida su identidad. Si aún no está asociado, solicita su registro.
3. El conductor crea un viaje, registra el kilometraje inicial y lo inicia.
4. Durante el viaje se envían y almacenan puntos GPS; los puntos pendientes pueden sincronizarse posteriormente.
5. Al finalizar, se registra la hora de llegada, el kilometraje final y el historial de estado.
6. El administrador inicia sesión en el panel para administrar catálogos, consultar viajes, revisar ubicación/ruta y controlar kilometraje.

## Endpoints principales

| Área | Base de rutas |
| --- | --- |
| Salud | `/health` |
| Viajes de conductores | `/api/viajes` |
| Ubicaciones GPS | `/api/viajes/:idViaje/ubicaciones` |
| Autenticación y registro Telegram | `/api/telegram` |
| Catálogos | `/api/catalogos` |
| Administración | `/api/admin/auth`, `/api/admin/conductores`, `/api/admin/vehiculos`, `/api/admin/destinos`, `/api/admin/ubicaciones-viaje`, `/api/admin/viajes` |

## Ejecución y despliegue

- El repositorio contiene `compose.yml` para ejecutar los servicios con Docker.
- Cada aplicación web usa Vite para desarrollo y compilación.
- El backend se ejecuta con `npm run dev` o `npm start`; también incluye `npm run admin:create` para crear un usuario administrativo.
- Hay configuración y guías para Render en `render.yaml` y `docs/`.
- ngrok está contemplado para exponer el entorno local a Telegram.

## Aspectos aún no comprobados o pendientes

- No hay una suite de pruebas automatizadas configurada: el script `npm test` del backend es un marcador y los frontends incluyen lint/build, pero no pruebas funcionales.
- Este documento confirma la implementación presente, no una prueba en vivo de los servicios externos (PostgreSQL, Telegram, Render o ngrok).
- Antes de operación productiva conviene ejecutar una prueba integral: autenticación Telegram, alta de conductor, viaje completo con GPS, consulta en mapa, lectura de kilometraje y sesión administrativa.

## Documentación existente

- `README.md`: visión general del proyecto.
- `backend/README.md`, `frontend/README.md` y `panel-admin/README.md`: información por aplicación.
- `database/README.md`: estructura y ejecución de base de datos.
- `docs/`: desarrollo, despliegue en Render y migración/exportación de base de datos.

