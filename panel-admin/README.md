# Panel administrativo — Gerenciamiento de Viajes

## Objetivo y estado actual

SPA React/Vite para autenticar personal administrativo y administrar conductores. El menú incluye Inicio, Conductores, Unidades, Destinos, Ubicaciones y Viajes; solo Conductores tiene un módulo funcional en el código actual. Los demás muestran un placeholder visible.

## Responsabilidades

- Consultar y cerrar la sesión administrativa mediante cookie.
- Mostrar dashboard y navegación por módulo sin recarga.
- Listar, filtrar, crear, desactivar y reactivar conductores.
- Informar estados de carga, errores y resultados vacíos.

## Estructura relevante

```text
src/
  App.jsx                         carga y conserva sesión administrativa
  pages/LoginPage.jsx             inicio de sesión
  pages/DashboardPage.jsx         navegación y dashboard
  pages/ConductoresPage.jsx       módulo CRUD parcial de conductores
  services/api.js                 cliente HTTP con credenciales
  main.jsx                        montaje React
  App.css, index.css              estilos
Dockerfile                        build Vite + Nginx
nginx.conf                        SPA, proxy `/api/` y health local
```

## Tecnologías y dependencias

- React 19 y React DOM.
- Vite 8, `@vitejs/plugin-react` y Oxlint.
- Nginx 1.27 Alpine para la imagen final.

## Variables de entorno

No se detectaron variables de entorno usadas por el código del panel. La base de API está fijada como `"/api"` en `src/services/api.js`.

## Puertos y Docker

- Nginx interno: `80`.
- Host: `8081:80` en `compose.yml`.
- `/api/` se proxifica a `http://backend:3000/api/`.
- `/health` responde localmente `panel-admin-ok`.

## Flujo de funcionamiento

1. `App` consulta `/api/admin/auth/session` una vez al montar.
2. Sin sesión, se renderiza `LoginPage`; con sesión, se renderiza `DashboardPage`.
3. `DashboardPage` cambia `activeModule` en memoria, sin volver a consultar la sesión.
4. `ConductoresPage` llama a la API al montar y cuando cambian búsqueda/filtro; permite crear y cambiar estado.
5. El cliente usa `credentials: "include"`, por lo que la cookie administrativa acompaña las solicitudes.

## Rutas y llamadas API

| Método | Ruta | Uso |
|---|---|---|
| POST | `/api/admin/auth/login` | Login. |
| GET | `/api/admin/auth/session` | Recuperar sesión. |
| POST | `/api/admin/auth/logout` | Logout. |
| GET | `/api/admin/conductores` | Listado con parámetros `search` y `status`. |
| POST | `/api/admin/conductores` | Alta de conductor. |
| PATCH | `/api/admin/conductores/:id/estado` | Baja o reactivación. |

No se detectó un enrutador cliente; el cambio de módulo es estado local de React.

## Tablas relacionadas

El módulo Conductores usa indirectamente `conductores` y puede mostrar datos vinculados de `usuarios_telegram`. No ejecuta SQL directo.

## Comandos

```bash
cd panel-admin
npm ci
npm run dev
npm run build
npm run lint
npm run preview
```

Desde la raíz:

```bash
docker compose up -d --build panel-admin
docker compose restart panel-admin
docker compose logs --tail=150 panel-admin
```

## Pruebas realizadas

- `npm run build` completó correctamente el 2026-07-30.
- `docker compose config --quiet` completó correctamente.
- Tras reconstrucción, `panel-admin` respondió saludable y `http://localhost:8081/health` devolvió HTTP 200.
- No se realizó prueba UI autenticada durante la documentación porque el navegador integrado no estaba disponible.

## Problemas conocidos

- Unidades, Destinos, Ubicaciones y Viajes no tienen módulo implementado; muestran un placeholder.
- No hay suite de pruebas automatizadas declarada.

## Próximos pasos pendientes

- Implementar los cuatro módulos pendientes sin sustituir los placeholders hasta contar con sus flujos/API.
- Añadir pruebas para sesión, búsqueda, alta y cambio de estado de conductor.

## Información pendiente de confirmar

- Matriz de permisos por rol administrativo.
- Campos y operaciones definitivas de los módulos pendientes.

## Historial de cambios

- 2026-07-30: README plantilla sustituido por documentación técnica y resultado de las verificaciones disponibles.

╔══════════════════════════════════════╗
║     GERENCIAMIENTO DE VIAJES         ║
║        Desarrollo Itzamná            ║
╚══════════════════════════════════════╝