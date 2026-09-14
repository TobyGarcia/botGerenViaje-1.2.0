# Guía de Despliegue en Servidor AWS EC2 (Rama: FIX-USER-TEST)

Esta guía contiene los pasos exactos y comandos directos para aplicar la reestructuración de roles y gestión centralizada de personal en el servidor de producción AWS EC2 (gv.aspromex.mx).

---

## 1. Conexión al Servidor EC2

Conéctate por SSH a tu instancia de AWS EC2:

`ash
ssh -i /ruta/a/tu-llave.pem ubuntu@78.12.246.221
`

---

## 2. Pasos de Despliegue

### Paso 1: Navegar al proyecto y cambiar a la rama FIX-USER-TEST
`ash
# Ingresar al directorio del proyecto en la EC2
cd /home/josuetovar/traslado_Local

# Actualizar referencias de git y cambiarse a la nueva rama
git fetch origin
git checkout FIX-USER-TEST
git pull origin FIX-USER-TEST
`

---

### Paso 2: Aplicar la migración SQL 026 en PostgreSQL
Esta migración amplía de forma segura los roles admitidos en la base de datos sin alterar ningún dato previo:

`ash
# Si tus variables de entorno son las estándar:
docker exec -i viajes-postgres psql -U viajes_admin_prod -d gerenciamiento_viajes_prod < database/migrations/026_expand_admin_roles_and_conductor_link.sql

# Alternativa (usando las variables automáticas de tu archivo .env):
source .env 2>/dev/null || true
docker exec -i viajes-postgres psql -U " -d  < database/migrations/026_expand_admin_roles_and_conductor_link.sql
`

---

### Paso 3: Reconstruir y reiniciar los contenedores
Solo se reconstruyen ackend y panel-admin (la Mini App de conductores y la base de datos no sufren interrupción):

`ash
docker compose -f compose.prod.yml up -d --build backend panel-admin
`

---

### Paso 4: Verificar que los servicios estén activos
`ash
# 1. Comprobar que los contenedores estén en estado Up (healthy)
docker compose -f compose.prod.yml ps

# 2. Ver los logs de arranque del backend
docker compose -f compose.prod.yml logs --tail 30 backend

# 3. Ver los logs del panel admin
docker compose -f compose.prod.yml logs --tail 20 panel-admin
`

---

## 3. Verificación en el Navegador

1. Ingresa a la plataforma: **https://gv.aspromex.mx**
2. Inicia sesión con tus credenciales de Administrador.
3. Ve al módulo **Conductores**:
 - En la primera columna de la tabla, verifica que en lugar de ID: CON-XXXX se muestra el **badge de Rol** (ej. SUPERVISOR, OPERADOR, CONDUCTOR, etc.).
 - Verifica que el menú lateral ya no muestra la opción redundante de Administrador de usuarios.
 - Haz clic en el botón morado de **Asignar rol** (<IconRol />) en cualquier conductor:
 - Si no tiene rol: podrás asignarle un rol (creando su acceso o vinculándolo a una cuenta previa). Si estaba pendiente de aprobación, se aprobará automáticamente.
 - Si ya tiene rol: podrás cambiar su jerarquía, actualizar sus datos o revocar el rol.

---

## 4. Plan de Rollback (En caso de requerir volver atrás)

Si por cualquier razón decides regresar a la versión previa, ejecuta simplemente:

`ash
cd /home/josuetovar/traslado_Local
git checkout feature/AWS-v2
docker compose -f compose.prod.yml up -d --build backend panel-admin
`
