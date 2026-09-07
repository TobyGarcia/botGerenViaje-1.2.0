# Configuración de Microsoft Graph para carga de PDFs en SharePoint

## Objetivo

Permitir que el backend de Gerenciamiento de Viajes cargue PDFs en este sitio, sin requerir que un usuario inicie sesión:

```text
https://itzamnaoilandgas.sharepoint.com/sites/GerenciamientoViajes
```

La biblioteca objetivo es **Documentos compartidos** y la carpeta base es **Inspecciones**.

> `SitePages/CollabHome.aspx` es una página de inicio del sitio; no debe configurarse como ruta de carga.

## Datos de la aplicación

| Dato | Valor |
| --- | --- |
| Tenant ID | `5982731c-2eb6-4989-a0db-2a598ff16b3a` |
| Application (Client) ID | `f107040e-8889-47bd-9a92-e9b66f1beb01` |
| Sitio | `https://itzamnaoilandgas.sharepoint.com/sites/GerenciamientoViajes` |
| Biblioteca | `Documentos compartidos` |
| Carpeta base | `Inspecciones` |

El correo `GerenciamientoViajes@itzamna.mx` no otorga acceso al backend. El permiso debe asignarse a la aplicación registrada en Microsoft Entra mediante su **Application (Client) ID**.

## Opción recomendada: acceso mínimo a un solo sitio

Esta opción permite escribir únicamente en el sitio de Gerenciamiento Viajes.

### 1. Agregar permiso de aplicación

En Microsoft Entra admin center:

```text
App registrations
→ Seleccionar la aplicación
→ API permissions
→ Add a permission
→ Microsoft Graph
→ Application permissions
→ Sites.Selected
```

Después ejecutar:

```text
Grant admin consent for <organización>
```

El resultado debe mostrar:

```text
Microsoft Graph | Sites.Selected | Application | Granted for <organización>
```

No usar el tipo **Delegated**: el backend usa el flujo `client_credentials`, sin usuario conectado.

### 2. Obtener el Site ID

Con un token administrativo, consultar:

```http
GET https://graph.microsoft.com/v1.0/sites/itzamnaoilandgas.sharepoint.com:/sites/GerenciamientoViajes
Authorization: Bearer <TOKEN_ADMINISTRATIVO>
```

Guardar el valor de `id` de la respuesta. Tiene un formato similar a:

```text
itzamnaoilandgas.sharepoint.com,GUID-COLECCION,GUID-SITIO
```

### 3. Conceder escritura a esta aplicación sobre el sitio

Usando el Site ID anterior y un contexto administrativo con privilegios para administrar permisos de sitios:

```http
POST https://graph.microsoft.com/v1.0/sites/{SITE_ID}/permissions
Authorization: Bearer <TOKEN_ADMINISTRATIVO>
Content-Type: application/json
```

```json
{
  "roles": ["write"],
  "grantedToIdentities": [
    {
      "application": {
        "id": "f107040e-8889-47bd-9a92-e9b66f1beb01",
        "displayName": "Gerenciamiento Viajes"
      }
    }
  ]
}
```

La respuesta esperada es `HTTP 201 Created` con `"roles": ["write"]`.

## Alternativa: acceso a todos los sitios SharePoint

Si la organización acepta que esta aplicación pueda escribir en cualquier colección de sitios del tenant, en lugar de `Sites.Selected` se puede conceder:

```text
Microsoft Graph
→ Application permissions
→ Sites.ReadWrite.All
→ Grant admin consent
```

Esta opción evita la concesión específica del paso 3, pero tiene acceso mucho más amplio. No usar ambas opciones salvo que sea necesario; se recomienda `Sites.Selected` por mínimo privilegio.

## Secreto de la aplicación

En Microsoft Entra:

```text
App registrations
→ Aplicación
→ Certificates & secrets
→ Client secrets
```

Crear o confirmar un secreto vigente. El backend requiere el campo **Value** del secreto, no el campo **Secret ID**.

## Variables de entorno del backend

Una vez obtenido el Site ID, configurar:

```env
AZURE_TENANT_ID=5982731c-2eb6-4989-a0db-2a598ff16b3a
AZURE_CLIENT_ID=f107040e-8889-47bd-9a92-e9b66f1beb01
AZURE_CLIENT_SECRET=<VALOR_DEL_CLIENT_SECRET>

SHAREPOINT_URL=https://itzamnaoilandgas.sharepoint.com/sites/GerenciamientoViajes
SHAREPOINT_SITE_ID=<SITE_ID_ENTREGADO_POR_GRAPH>
SHAREPOINT_FOLDER_PATH=Inspecciones
```

No guardar el secreto en Git ni enviarlo por correo o chat sin un canal seguro.

Después de cambiar permisos o variables, reiniciar el backend. El token se guarda temporalmente en memoria; sin reiniciar podría conservarse un token anterior sin los nuevos permisos.

## Validación de entrega

La configuración se considera terminada cuando se cumpla lo siguiente:

- El permiso aparece en **Application permissions**, con estado **Granted for ...**.
- Un token nuevo de la aplicación contiene `Sites.Selected` o `Sites.ReadWrite.All` dentro de `roles`.
- `GET /sites/itzamnaoilandgas.sharepoint.com:/sites/GerenciamientoViajes` responde `200`.
- `GET /sites/{SITE_ID}/drives` responde `200` y devuelve la biblioteca documental.
- Si se usa `Sites.Selected`, `GET /sites/{SITE_ID}/permissions` muestra a la aplicación con rol `write`.
- Una carga de prueba devuelve `201 Created` y el PDF aparece en la biblioteca.

## Notas para el backend

- El backend debe crear, o verificar que existan, las subcarpetas antes de subir el PDF. La ruta generada actualmente tiene este formato:

  ```text
  Inspecciones/AÑO/MM-Mes/Semana-NN
  ```

- Si falla la resolución del Site ID, no debe continuar la carga usando una ruta alternativa. Debe devolver el error de permisos o de sitio para evitar errores secundarios como `Resource not found for the segment 'root'`.

## Referencias oficiales

- [Permisos seleccionados para SharePoint y OneDrive](https://learn.microsoft.com/en-us/graph/permissions-selected-overview)
- [Crear un permiso para una aplicación en un sitio](https://learn.microsoft.com/en-us/graph/api/site-post-permissions?view=graph-rest-1.0)
- [Cargar o reemplazar contenido de un archivo](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0)
- [Referencia de permisos de Microsoft Graph](https://learn.microsoft.com/en-us/graph/permissions-reference)
