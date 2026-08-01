# Migración de pruebas de producción a Render

Este proyecto queda preparado para ejecutarse en Render sin Docker local. Se crean cuatro recursos: PostgreSQL administrado, API Node.js, Mini App y panel administrativo. La API usa la red privada de Render para comunicarse con la base de datos.

## Antes de iniciar

1. Sube el proyecto a un repositorio privado de GitHub. No incluyas `.env`, `admin-cookies.txt` ni `respaldo-gerenciamiento-viajes.dump`.
2. Confirma que la rama que subirás contiene `render.yaml` y los cambios de esta migración.
3. Conserva el respaldo local `respaldo-gerenciamiento-viajes.dump` en un lugar seguro. Es la fuente para restaurar los datos de prueba.

## 1. Crear los recursos

1. En Render, abre **New > Blueprint** y conecta tu repositorio y la rama de pruebas.
2. Render detectará `render.yaml`. Confirma la creación.
3. En el formulario de secretos, proporciona:
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_GROUP_ID` y `TELEGRAM_BOT_USERNAME` con los valores actuales.
   - `TELEGRAM_WEB_APP_URL`: por ahora deja una URL temporal; se actualizará en el paso 4.
   - `CORS_ORIGINS`: por ahora deja un texto temporal; se actualizará en el paso 4.
   - `VITE_API_BASE_URL` en ambos sitios: por ahora deja una URL temporal válida, por ejemplo `https://example.com`.
4. Espera a que PostgreSQL, la API y los dos sitios terminen su primer despliegue. Los dos sitios pueden mostrar un error de API hasta que se actualicen sus variables definitivas.

> El plan de la base de datos está configurado como `basic-256mb` para evitar una base efímera. Si tu cuenta no muestra ese plan, selecciona el plan de PostgreSQL persistente más económico disponible.

## 2. Importar esquema y datos

En Render abre la base **gerenciamiento-viajes-db > Connect** y copia la **External Database URL**. En PowerShell, desde la carpeta del proyecto, ejecuta uno de estos dos caminos:

```powershell
# Restauración completa desde el respaldo existente.
pg_restore --no-owner --no-privileges --dbname "PEGA_AQUI_LA_EXTERNAL_DATABASE_URL" .\respaldo-gerenciamiento-viajes.dump
```

```powershell
# Si prefieres empezar con estructura y catálogos limpios:
$env:DATABASE_URL = "PEGA_AQUI_LA_EXTERNAL_DATABASE_URL"
psql $env:DATABASE_URL -f .\database\scripts\migrate.sql
psql $env:DATABASE_URL -f .\database\scripts\seed.sql
```

Usa **solo una** opción. Si `pg_restore` o `psql` no están instalados, instala las herramientas de PostgreSQL o usa una herramienta gráfica como pgAdmin con la misma URL externa. No compartas ni pegues esa URL en el repositorio: contiene la contraseña.

Después verifica en la pestaña **Shell** de la base o con tu cliente SQL que existan las tablas `viajes`, `usuarios_admin` y los catálogos. Crea el primer administrador desde una conexión local a la base con `npm run admin:create` dentro de `backend`, configurando temporalmente `DATABASE_URL` con la URL externa.

## 3. Conectar las URLs reales

Obtén las URLs de Render. Por defecto serán similares a:

- API: `https://gerenciamiento-viajes-api.onrender.com`
- Mini App: `https://gerenciamiento-viajes-miniapp.onrender.com`
- Administración: `https://gerenciamiento-viajes-admin.onrender.com`

En **API > Environment**, cambia `CORS_ORIGINS` por las dos URLs de los sitios, separadas por coma y sin barra final. Ejemplo:

```text
https://gerenciamiento-viajes-miniapp.onrender.com,https://gerenciamiento-viajes-admin.onrender.com
```

En **Mini App > Environment** y **Administración > Environment**, establece `VITE_API_BASE_URL` con la URL de la API, sin barra final. Guarda con **Save, rebuild, and deploy** en cada sitio: Vite integra esta variable durante la compilación.

En **API > Environment**, configura `TELEGRAM_WEB_APP_URL` con la URL de la Mini App y selecciona **Save and deploy**.

## 4. Ajustar Telegram

En BotFather, actualiza el botón o menú web del bot para abrir exactamente la URL HTTPS de la Mini App. Abre la Mini App desde Telegram, registra una ubicación y comprueba que el endpoint de salud de la API responde en `https://TU_API/health`.

## 5. Verificación de producción

1. Abre `/health` en la API: debe responder `status: "ok"` y `database.connected: true`.
2. Abre la Mini App desde Telegram y confirma que carga conductores, vehículos y destinos.
3. Entra al panel administrativo, inicia sesión y recarga la página. La sesión debe continuar activa.
4. Crea un viaje de prueba, registra ubicación y finalízalo. Verifica el registro en el panel y la alerta del grupo de Telegram.
5. Revisa **Logs** de la API. No deben aparecer errores de CORS, PostgreSQL ni Telegram.

## Operación segura

- No despliegues el archivo `.env` ni uses la URL externa de PostgreSQL como variable de la API; el Blueprint ya enlaza `DATABASE_URL` internamente.
- Las dos interfaces se compilan como sitios estáticos; no dependen de Nginx, Docker Compose ni ngrok.
- Para cambios de aplicación, haz `git push` a la rama conectada. Render vuelve a desplegar automáticamente.
- Antes de probar cambios peligrosos de esquema, genera y descarga un respaldo de la base de pruebas desde Render.
