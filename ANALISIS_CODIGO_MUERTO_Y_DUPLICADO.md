# 📄 Análisis de Código Muerto, Obsoleto y Duplicado
**Proyecto:** botGerenViaje 1.2.0  
**Fecha:** 10 de Septiembre de 2026  
**Entorno Analizado:** Local & Servidor AWS  

---

## 📌 Resumen Ejecutivo

Este documento detalla los hallazgos del análisis técnico realizado sobre la arquitectura de software y el código fuente de **botGerenViaje 1.2.0**, abarcando el Backend (Node.js/Express), Frontend (PWA MiniApp React), Panel Administrativo (React/Vite) y el esquema de base de datos PostgreSQL.

El objetivo de este análisis es identificar:
1. **Código muerto y funciones obsoletas** derivadas de la adopción del inicio de sesión exclusivo por Microsoft Entra ID (Azure AD SSO) en el Panel Administrativo.
2. **Flujos de autenticación y registro de conductores** (evaluación de necesidad del PIN de 4 dígitos y la validación por Telegram vs. PWA).
3. **Rutas y servicios duplicados** en el Backend.
4. **Residuos de código y archivos de respaldo** que pueden ser depurados.

---

## 📊 Matriz de Diagnóstico de Componentes

| Módulo / Elemento | Estado Actual | Diagnóstico | Acción Recomendada |
| :--- | :--- | :--- | :--- |
| **`usuarios_admin.password_hash`** | Autenticación por usuario y contraseña en Backend | ❌ **CÓDIGO MUERTO** | Eliminar endpoints de login tradicional y campo en BD. |
| **`usuarios_admin.pin_hash`** | Generación y validación de PIN para Administradores | ❌ **CÓDIGO MUERTO** | Eliminar asignación de PIN a administradores. |
| **`conductores.pin_hash`** | Iniciar sesión en PWA móvil fuera de Telegram | ⚠️ **EN USO ACTIVO** | **CONSERVAR** (Método de acceso web para choferes). |
| **Telegram Bot (Registro por chat)** | Menús conversacionales por chat para solicitar fotos | ❌ **REDUNDANTE** | Redirigir siempre a la WebApp PWA y limpiar handlers de chat. |
| **Ruta `/login-pin` (Conductores)** | Definida en `driver-auth` y en `telegram-auth` | ❌ **DUPLICADO** | Conservar en `driver-auth` y remover de `telegram-auth`. |
| **Alteraciones DDL en `server.js`** | `ALTER TABLE ADD COLUMN IF NOT EXISTS` al arrancar | ❌ **REDUNDANTE** | Remover del inicio del servidor (gestionar por migraciones). |

---

## 🔍 Detalle Técnico por Módulo

### 1. Módulo de Administradores (`usuarios_admin`) y Microsoft Auth

#### 1.1 Contexto
En el Panel Administrativo (`panel-admin`), la pantalla de inicio de sesión (`LoginPage.jsx`) ha sido configurada para tener como **único método de acceso el botón oficial de Microsoft SSO** (`handleAzureMicrosoftLogin`), autenticando únicamente cuentas del dominio corporativo `@itzamna.mx`.

#### 1.2 Código Muerto Identificado en Backend:
* **Endpoints Innecesarios** en `backend/src/routes/admin-auth.routes.js`:
  * `POST /api/admin/auth/login` (Login clásico con usuario y contraseña).
  * `POST /api/admin/auth/pin-login` (Login mediante PIN de 4 dígitos para admins).
  * `POST /api/admin/auth/tenant-login` (Bypass de login por correo sin validación OAuth).
* **Controladores y Servicios Obsoletos**:
  * `loginAdminController` y `loginWithPinController` en `backend/src/controllers/admin-auth.controller.js`.
  * `authenticateAdminUser` (que compara contraseñas bcrypt) y `authenticateSupervisorWithPin` en `backend/src/services/admin-auth.service.js`.
* **Gestión de PIN Innecesaria para Administradores**:
  * Ruta `POST /api/admin/users/:idUsuario/pin` en `backend/src/routes/admin-usuarios.routes.js`.
  * `assignAdminUserPinController` en `backend/src/controllers/admin-usuarios.controller.js`.
  * `assignAdminUserPin` en `backend/src/services/admin-usuarios.service.js`.
  * Columna `pin_hash` y `password_hash` en la tabla `usuarios_admin`.

---

### 📱 2. Módulo de Conductores: PWA vs. Telegram y Necesidad del PIN

#### 2.1 ¿Por qué el PIN de Conductor SÍ es Necesario?
* **Razón de Negocio / Técnica**: La aplicación PWA (`https://gv.aspromex.mx`) permite que un conductor abra la web en cualquier navegador móvil (Safari, Chrome) fuera de la aplicación de Telegram.
* **Mecanismo**: El componente `PinLoginForm.jsx` y el servicio `authenticateDriverWithPin` permiten ingresar con el **Número Telefónico + PIN de 4 dígitos**.
* **Conclusión**: El campo `conductores.pin_hash` y la generación de PIN al registrarse **deben mantenerse activos**.

#### 2.2 Código Redundante en Telegram Bot
* **Registro por Chat Obsoleto**: Antes de implementar el formulario PWA (`RegistroConductor.jsx`), el Bot de Telegram solicitaba en un chat conversacional los datos del conductor y las fotos de la licencia mediante pasos continuos en `backend/src/bot/bot.handlers.js`.
* **Diagnóstico**: Como todo el registro de conductores ahora se realiza de forma visual en la PWA MiniApp, la lógica conversacional por chat en el Bot de Telegram es obsoleta.

---

### ♻️ 3. Código Duplicado y Hallazgos Adicionales

1. **Rutas de API Duplicadas**:
   * `backend/src/routes/driver-auth.routes.js`: `router.post("/login-pin", loginDriverWithPinController);`
   * `backend/src/routes/telegram-auth.routes.js`: `router.post("/login-pin", loginDriverWithPinController);`
   * *Ambas rutas apuntan al mismo controlador y procesan la misma petición.*

2. **Alteraciones DDL al Arrancar el Servidor (`server.js`)**:
   * En `backend/src/server.js` (Líneas 120-160) se ejecutan sentencias DDL inline como `ADD COLUMN IF NOT EXISTS pin_hash TEXT;`.
   * *Diagnóstico*: Es código redundante e innecesario en cada inicio del servidor Node.js, ya que el esquema de base de datos se administra formalmente mediante los scripts de migración `001_initial_schema.sql` a `024_origen_ubicaciones_viaje.sql`.

3. **Archivos Residuo**:
   * `backend/test_gerenciamiento_oficial.pdf` (PDF de prueba estático de 396 KB).
   * Script `backend/src/scripts/create-admin-user.js` (pide contraseñas complejas que ya no se usan).
   * Carpetas de respaldo en el servidor AWS como `backend/src.bak.20260907-142324/`.

---

## 🛠️ Recomendaciones para Refactorización Futura

1. **Limpieza en Panel Admin / `usuarios_admin`**:
   * Mantener únicamente los endpoints de autenticación Microsoft OAuth (`/azure/url`, `/azure/exchange-code`, `/session`, `/logout`).
   * Eliminar los métodos de login por contraseña y PIN para administradores.
2. **Unificación de Endpoints de Conductores**:
   * Eliminar `/api/telegram/auth/login-pin` y mantener solo `/api/driver/auth/login-pin`.
3. **Depuración del Bot de Telegram**:
   * Dejar el Bot de Telegram enfocado únicamente en lanzar la WebApp (PWA) y enviar notificaciones a los grupos de supervisores.
4. **Optimización del Arranque (`server.js`)**:
   * Retirar las consultas `ALTER TABLE` del archivo `server.js` para aligerar la inicialización de la aplicación.
