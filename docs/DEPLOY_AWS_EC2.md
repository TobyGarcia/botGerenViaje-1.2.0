# Guía de Despliegue en AWS EC2 con Nginx Host Proxy (gv.aspromex.mx)

## Estado de la Instancia EC2 Confirmado

- **Dominio Principal**: `gv.aspromex.mx`
- **IP Pública EC2**: `78.12.246.221` (IP Privada `172.31.3.5`)
- **Nginx del Host**: Ya está instalado y ejecutándose en los puertos `80` (HTTP) y `443` (HTTPS).
- **Puertos de Contenedores Docker (Loopback 127.0.0.1)**:
  - `127.0.0.1:3000` -> Backend API Express
  - `127.0.0.1:8080` -> Frontend (Mini App de Telegram)
  - `127.0.0.1:8081` -> Panel de Administración Web
  - `127.0.0.1:5432` -> Base de Datos PostgreSQL

---

## Archivos de Configuración Incluidos

- `compose.prod.yml`: Docker Compose adaptado para enlazar los servicios únicamente a `127.0.0.1` para que Nginx del host actúe como filtro/proxy seguro.
- `.env.aws.example`: Plantilla de entorno para `gv.aspromex.mx`.

---

## Configuración del Proxy Inverso Nginx en el Host EC2

Debes colocar la siguiente configuración en la instancia de EC2 en `/etc/nginx/sites-available/gv.aspromex.mx`.

### Opción A: Subdominios Dedicados (Recomendada)
- `gv.aspromex.mx` -> Mini App Conductor (`127.0.0.1:8080`)
- `admin.gv.aspromex.mx` -> Panel Administrativo (`127.0.0.1:8081`)
- `api.gv.aspromex.mx` -> API Express Backend (`127.0.0.1:3000`)

```nginx
# API Backend (api.gv.aspromex.mx)
server {
    listen 80;
    server_name api.gv.aspromex.mx;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Mini App Conductor (gv.aspromex.mx)
server {
    listen 80;
    server_name gv.aspromex.mx;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Panel Administrativo (admin.gv.aspromex.mx)
server {
    listen 80;
    server_name admin.gv.aspromex.mx;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### Opción B: Dominio Único con Rutas (`gv.aspromex.mx`)
Si todo se sirve bajo el mismo dominio de nivel superior `gv.aspromex.mx`:

```nginx
server {
    listen 80;
    server_name gv.aspromex.mx;

    # API Backend
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health Check API
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_set_header Host $host;
    }

    # Panel Administrativo Web
    location /admin/ {
        proxy_pass http://127.0.0.1:8081/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Mini App de Telegram (Frontend Principal)
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Certificado SSL / HTTPS con Certbot

Una vez creado el archivo en `/etc/nginx/sites-available/gv.aspromex.mx`:

```bash
# 1. Habilitar el sitio en Nginx
sudo ln -s /etc/nginx/sites-available/gv.aspromex.mx /etc/nginx/sites-enabled/

# 2. Comprobar la sintaxis de Nginx
sudo nginx -t

# 3. Recargar Nginx
sudo systemctl reload nginx

# 4. Generar el certificado SSL con Certbot
sudo certbot --nginx -d gv.aspromex.mx
```

---

## Comandos de Despliegue de los Contenedores

En el directorio del proyecto en la EC2 (`/home/josuetovar/traslado_Local`):

```bash
# 1. Copiar y configurar el archivo de entorno
cp .env.aws.example .env
nano .env

# 2. Levantar la pila de Docker en segundo plano
docker compose -f compose.prod.yml up -d --build

# 3. Verificar estado de contenedores
docker compose -f compose.prod.yml ps

# 4. Aplicar migraciones SQL y semillas a PostgreSQL
for file in database/migrations/*.sql; do
    echo "Aplicando $file..."
    docker exec -i viajes-postgres psql -U viajes_admin_prod -d gerenciamiento_viajes_prod < "$file"
done

for file in database/seeds/*.sql; do
    echo "Aplicando $file..."
    docker exec -i viajes-postgres psql -U viajes_admin_prod -d gerenciamiento_viajes_prod < "$file"
done

# 5. Crear el usuario Administrador
docker exec -it viajes-backend npm run admin:create
```
