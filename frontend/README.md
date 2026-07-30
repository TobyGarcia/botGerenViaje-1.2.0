# Frontend — Mini App de Gerenciamiento de Viajes

## Objetivo y estado actual

Cliente React/Vite orientado a la experiencia de conductor. El código actual incluye la aplicación principal, el componente `RegistroConductor` y un cliente HTTP. Se construye como sitio estático servido por Nginx.

## Responsabilidades

- Renderizar la interfaz principal de la Mini App.
- Registrar conductores mediante la API Telegram.
- Consumir catálogos y API mediante `src/services/api.js`.
- Entregar la SPA y proxificar API/health con Nginx.

## Estructura relevante

```text
src/
  App.jsx                 aplicación principal
  components/RegistroConductor.jsx
  services/api.js         cliente HTTP y base URL
  main.jsx                punto de montaje React
  App.css, index.css      estilos
  assets/                 recursos estáticos
Dockerfile                build Vite + Nginx
nginx.conf                SPA, proxy API y health
```

## Tecnologías y dependencias

- React 19 y React DOM.
- Vite 8 y `@vitejs/plugin-react`.
- Oxlint.
- Nginx 1.27 Alpine para servir el build.

## Variables de entorno

| Variable | Uso comprobado |
|---|---|
| `VITE_API_BASE_URL` | Prefijo opcional para el cliente API; por defecto cadena vacía. |

## Puertos y Docker

- Nginx interno: `80`.
- Host: `80:80` en `compose.yml`.
- `/api/` se proxifica a `http://backend:3000`.
- `/health` se proxifica a `http://backend:3000/health`.

## Flujo de funcionamiento

1. `main.jsx` monta `App`.
2. La interfaz usa el cliente de `services/api.js` para llamar al backend.
3. En Docker, Vite genera `dist`; Nginx sirve la SPA y reenvía llamadas API al backend.

## Rutas disponibles

No se detectó un enrutador cliente. Nginx usa `try_files ... /index.html`, por lo que la aplicación se entrega como SPA desde `/`.

El cliente API usa el prefijo configurable y consume endpoints del backend; el registro de conductor corresponde al endpoint `/api/telegram/registro-conductor` del backend.

## Tablas relacionadas

La interfaz de registro se relaciona indirectamente con `usuarios_telegram` y `conductores` a través de la API. No ejecuta SQL directo.

## Comandos

```bash
cd frontend
npm ci
npm run dev
npm run build
npm run lint
npm run preview
```

Desde la raíz:

```bash
docker compose up -d --build frontend
docker compose restart frontend
docker compose logs --tail=150 frontend
```

## Pruebas realizadas

- Se revisaron el manifiesto, Dockerfile, Nginx y estructura del cliente.
- No se ejecutó una compilación ni pruebas funcionales de este módulo durante esta documentación.

## Problemas conocidos

- No hay pruebas automatizadas declaradas en `package.json`.
- No hay un sistema de rutas cliente explícito en los archivos revisados.

## Próximos pasos pendientes

- Añadir pruebas de componentes y del cliente API.
- Documentar de forma versionada los flujos visibles de la Mini App.

## Información pendiente de confirmar

- Cómo se inyecta `initData` de Telegram en el navegador para cada entorno.
- URL pública definitiva de la Mini App.

## Historial de cambios

- 2026-07-30: README plantilla sustituido por documentación técnica basada en el código actual.

╔══════════════════════════════════════╗
║     GERENCIAMIENTO DE VIAJES         ║
║        Desarrollo Itzamná            ║
╚══════════════════════════════════════╝