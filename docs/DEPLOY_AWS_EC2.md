# Guía de Despliegue en Amazon AWS EC2 (Ubuntu + Docker Compose)

## Propósito

Esta guía documenta los pasos para desplegar el sistema **Gerenciamiento de Viajes** en una instancia de **AWS EC2 (Ubuntu)** utilizando `compose.prod.yml`, Nginx como Proxy Inverso y Certbot para certificados SSL (HTTPS indispensable para Telegram Mini Apps).

---

## Estructura de Archivos Creados para AWS

- `compose.prod.yml`: Configuración de producción para Docker Compose (excluye ngrok y habilita políticas de reinicio automático).
- `.env.aws.example`: Plantilla de variables de entorno para producción en AWS EC2.

---

## Requisitos Previos en AWS

1. **Instancia EC2 Ubuntu**:
   - Docker y Docker Compose plugin instalados.
   - **IP Elástica (Elastic IP)** asignada a la instancia.
2. **Nombres de Dominio registrados** apuntando en las DNS (Registros A) a la IP Elástica de la EC2:
   - `api.tudominio.com` (Para el Backend Express API)
   - `app.tudominio.com` (Para el Frontend Mini App Conductor)
   - `admin.tudominio.com` (Para el Panel Administrativo)
3. **Grupo de Seguridad en AWS (Security Group)** con puertos abiertos:
   - `22` (SSH - Acceso MobaXterm)
   - `80` (HTTP - Certbot y redirecciones)
   - `443` (HTTPS - Tráfico cifrado obligatorio para Telegram)

---

## Pasos para el Despliegue en la EC2

### 1. Clonar el repositorio y cambiar a la rama de despliegue

Conéctate vía SSH desde MobaXterm y ejecuta:

```bash
git clone <URL_REPOSITORIO> ~/botGerenViaje
cd ~/botGerenViaje
git checkout feature/AWS-deploy
```

### 2. Configurar el archivo `.env` de Producción

Copia la plantilla y edita con tus valores reales:

```bash
cp .env.aws.example .env
nano .env
```

> **Importante**: Asegúrate de asignar contraseñas fuertes para `POSTGRES_PASSWORD`, tokens de Telegram válidos y una clave aleatoria y segura para `ADMIN_JWT_SECRET`.

---

### 3. Levantar los Contenedores con Docker Compose Prod

```bash
docker compose -f compose.prod.yml up -d --build
```

Verifica que todos los servicios estén levantados y saludables:

```bash
docker compose -f compose.prod.yml ps
```

---

### 4. Inicializar la Base de Datos (Migraciones y Semillas)

Ejecuta las migraciones y catálogos iniciales en el contenedor de PostgreSQL:

```bash
# Migraciones de esquema
for file in database/migrations/*.sql; do
    echo "Aplicando migración: $file..."
    docker exec -i viajes-postgres psql -U viajes_admin_prod -d gerenciamiento_viajes_prod < "$file"
done

# Semillas de catálogo inicial
for file in database/seeds/*.sql; do
    echo "Aplicando semilla: $file..."
    docker exec -i viajes-postgres psql -U viajes_admin_prod -d gerenciamiento_viajes_prod < "$file"
done
```

---

### 5. Crear el Usuario Administrador Inicial

Ejecuta de forma interactiva la creación del usuario admin en el backend:

```bash
docker exec -it viajes-backend npm run admin:create
```

---

### 6. Configurar Nginx y Certificados SSL (Certbot)

1. Instalar Nginx y Certbot en Ubuntu (si no están instalados):
   ```bash
   sudo apt update
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. Crear la configuración de Nginx:
   ```bash
   sudo nano /etc/nginx/sites-available/viajes.conf
   ```

   Pega el siguiente bloque sustituyendo `tudominio.com` por tus subdominios:

   ```nginx
   # API Backend
   server {
       server_name api.tudominio.com;

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

   # Mini App Conductor (Frontend)
   server {
       server_name app.tudominio.com;

       location / {
           proxy_pass http://127.0.0.1:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }

   # Panel Administrativo
   server {
       server_name admin.tudominio.com;

       location / {
           proxy_pass http://127.0.0.1:8081;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

3. Habilitar el sitio y verificar Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/viajes.conf /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. Generar Certificados SSL con Certbot:
   ```bash
   sudo certbot --nginx -d api.tudominio.com -d app.tudominio.com -d admin.tudominio.com
   ```

---

## Mantenimiento y Comandos Útiles

- **Ver logs en tiempo real**: `docker compose -f compose.prod.yml logs -f`
- **Reiniciar un servicio específico**: `docker compose -f compose.prod.yml restart backend`
- **Detener la aplicación**: `docker compose -f compose.prod.yml down`
