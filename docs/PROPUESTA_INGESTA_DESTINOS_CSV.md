# Propuesta Técnica: Ingesta de Destinos desde Archivo CSV

Este documento detalla el análisis del archivo `CSV/SAN_FRANCISCO_DE_CAMPECHE_SIMPLE.csv`, los requerimientos técnicos para su integración en la base de datos del proyecto **Bot Gerenciamiento de Viajes**, y las opciones de implementación disponibles.

---

## 1. Diagnóstico del Archivo CSV

* **Ubicación:** `CSV/SAN_FRANCISCO_DE_CAMPECHE_SIMPLE.csv`
* **Total de registros:** 3,534 destinos (+ 1 fila de encabezado).
* **Columnas disponibles:** `Nombre`, `Direccion`, `Longitud`, `Latitud`.
* **Codificación:** UTF-8 con BOM (`\uFEFF`).

### Análisis de Calidad y Dimensiones de Datos

| Campo CSV | Tipo / Límite en BD (`lugares`) | Longitud Máxima en CSV | Estado de Validación |
| :--- | :--- | :--- | :--- |
| **Nombre** | `VARCHAR(150) NOT NULL UNIQUE` | 121 caracteres | ✅ Todos los registros caben sin truncar. |
| **Direccion** | `TEXT` | 269 caracteres | ✅ Cabe perfectamente en columna `TEXT`. |
| **Longitud** | `DECIMAL(10,7)` | Ej: `-90.532501` | ✅ 100% coordenadas válidas en Campeche (~ -90.5°). |
| **Latitud** | `DECIMAL(10,7)` | Ej: `19.818500` | ✅ 100% coordenadas válidas en Campeche (~ 19.8°). |

---

## 2. Hallazgos Críticos Identificados

### 2.1. Conflicto con la Restricción `UNIQUE` en `lugares.nombre`
En la migración inicial de la base de datos ([001_initial_schema.sql](file:///c:/Users/Soporte%20TI%20Junior/Pictures/Nueva%20carpeta%20(2)/database/migrations/001_initial_schema.sql#L88-L101)), la tabla está definida como:

```sql
CREATE TABLE lugares
(
    id_lugares SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE,
    direccion TEXT,
    latitud DECIMAL(10,7),
    longitud DECIMAL(10,7),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

* **Problema:** En el CSV existen **85 grupos de nombres repetidos** (274 sucursales o establecimientos como: *OXXO, Farmacias Similares, ADO, AT&T, Abarrotes Mary, Abarrotes El Milagro*, etc.), ubicados en distintas direcciones y coordenadas.
* **Impacto:** Si se ejecuta un `INSERT` directo sin procesar estos duplicados, la base de datos arrojará un error de violación de restricción única (`duplicate key value violates unique constraint "lugares_nombre_key"`), o si se usa `ON CONFLICT DO NOTHING`, se perderán cientos de sucursales reales.

### 2.2. Carácter BOM UTF-8 en el Encabezado
El archivo inicia con la secuencia `\uFEFF`. Si se lee ingenuamente con bibliotecas estándar de Node.js, la primera clave se parsea como `"\uFEFFNombre"`, provocando errores al mapear los campos si no se remueve explícitamente (`cleanText = text.replace(/^\uFEFF/, '')`).

### 2.3. Orden de Coordenadas Invertido
En el archivo CSV las columnas están ordenadas:
1. `Nombre`
2. `Direccion`
3. `Longitud`
4. `Latitud`

En la tabla `lugares` y en la mayoría de servicios cartográficos, el orden estándar suele ser `latitud` primero y `longitud` después. La ingesta debe mapear explícitamente cada índice a su columna correspondiente para no invertir los ejes.

---

## 3. Estrategia de Resolución de Duplicados (Desambiguación Contextual)

Para mantener la restricción `UNIQUE` en la base de datos sin perder sucursales ni requerir migraciones destructivas de esquemas, se aplica una **desambiguación inteligente basada en la dirección**:

* Si un nombre aparece una sola vez: se inserta tal cual (ej. `"Hospital General Dr. Javier Buenfil Osorio"`).
* Si un nombre aparece más de una vez: se le anexa entre paréntesis la colonia o barrio extraída de su dirección (ej. `"ADO (Barrio de Sta Ana)"` vs `"ADO (Patricio Trueba)"`).
* **Resultado verificado:** El 100% de los 3,534 destinos quedan con nombres únicos, claros para el conductor/usuario y respetando el límite de 150 caracteres.

---

## 4. Opciones de Implementación

### Opción A: Script de Ingesta CLI en Node.js (Recomendada para ejecución directa)

Crear un script en `backend/src/scripts/importar-destinos-csv.js` ejecutable mediante comando `npm run db:import-destinos`.

#### Características:
* **Lectura eficiente:** Procesa el archivo en memoria o por streaming.
* **Transaccional y por lotes:** Inserta en bloques de 500 registros usando transacciones SQL para completar los 3,534 registros en menos de 2 segundos.
* **Idempotencia:** Utiliza `ON CONFLICT (nombre) DO UPDATE SET direccion = EXCLUDED.direccion, latitud = EXCLUDED.latitud, longitud = EXCLUDED.longitud, activo = TRUE` para que el script pueda ejecutarse múltiples veces sin fallar ni duplicar registros.

#### Ejemplo de Estructura del Script:
```javascript
// backend/src/scripts/importar-destinos-csv.js
import fs from 'node:fs';
import path from 'node:path';
import { databasePool } from '../database/pool.js';

async function importarDestinos() {
  const filePath = path.resolve('..', 'CSV', 'SAN_FRANCISCO_DE_CAMPECHE_SIMPLE.csv');
  const rawText = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  
  // 1. Parseo y desambiguación contextual de nombres duplicados
  const destinos = procesarYDesambiguar(rawText);

  // 2. Inserción por lotes (Batch Insert)
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    const BATCH_SIZE = 500;
    for (let i = 0; i < destinos.length; i += BATCH_SIZE) {
      const lote = destinos.slice(i, i + BATCH_SIZE);
      await insertarLote(client, lote);
    }
    await client.query('COMMIT');
    console.log(`✅ Ingesta finalizada: ${destinos.length} destinos procesados con éxito.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

---

### Opción B: Módulo de Importación en el Panel de Administración (`panel-admin`)

Permite a los administradores cargar y actualizar destinos directamente desde la interfaz web sin requerir acceso a la terminal o al servidor.

#### Componentes requeridos:
1. **Backend:**
   * Dependencia: `multer` (para recepción de archivos).
   * Ruta: `POST /api/admin/destinos/importar-csv` (requiere token y rol `ADMINISTRADOR`).
   * Servicio: Reutiliza la lógica de parseo, desambiguación e inserción por lotes.
   * Respuesta: Retorna resumen estructurado `{ total: 3534, insertados: 3534, actualizados: 0, errores: [] }`.

2. **Frontend (`panel-admin`):**
   * En [DestinosPage.jsx](file:///c:/Users/Soporte%20TI%20Junior/Pictures/Nueva%20carpeta%20%282%29/panel-admin/src/pages/DestinosPage.jsx), agregar un botón **"Importar CSV"**.
   * Modal interactivo que permita arrastrar el archivo CSV, muestre barra de progreso y notifique el resultado de la importación.

---

### Opción C: Generación de Semilla SQL (`Seed`)

Generar un archivo SQL `database/seeds/005_destinos_campeche.sql` con sentencias `INSERT INTO lugares ... ON CONFLICT (nombre) DO UPDATE...` para que forme parte del despliegue inicial en entornos Docker o Render.

---

## 5. Impacto en la Experiencia de Usuario (Frontend y Bot de Telegram)

Al incorporar 3,534 lugares, el comportamiento actual del selector de destinos debe adaptarse:

### Situación Actual
En [frontend/src/App.jsx](file:///c:/Users/Soporte%20TI%20Junior/Pictures/Nueva%20carpeta%20%282%29/frontend/src/App.jsx#L1868-L1890) y [GerenciamientoForm.jsx](file:///c:/Users/Soporte%20TI%20Junior/Pictures/Nueva%20carpeta%20%282%29/frontend/src/components/GerenciamientoForm.jsx#L572-L605), los destinos se cargan en etiquetas `<select>` HTML nativas:
```jsx
<select value={form.idDestino} onChange={...}>
  {lugares.map((l) => (
    <option key={l.id_lugares} value={l.id_lugares}>{l.nombre}</option>
  ))}
</select>
```

### Problemas al tener 3,500 elementos:
1. **Rendimiento móvil:** Renderizar 3,534 nodos `<option>` en navegadores embebidos (Telegram WebApp en Android/iOS) genera retardo y sobrecosto de memoria.
2. **Usabilidad nula:** Es inviable para un conductor desplazarse en una lista de 3,500 nombres ordenados alfabéticamente para encontrar su destino.

### Solución Recomendada:
* Reemplazar los `<select>` nativos por un componente **Buscador / Autocompletado (Combobox)**:
  * El usuario escribe 2 o 3 caracteres (ej. `"pemex"`, `"palma"`, `"san roman"`).
  * Se filtran en tiempo real las opciones que coincidan en nombre o dirección.
  * Soporte opcional en `/api/catalogos/lugares?search=...&limit=30` para cargar de forma asíncrona solo lo necesario si se desea minimizar el consumo de datos móviles.

---

## 6. Plan de Ejecución Sugerido

1. **Fase 1 (Ingesta de Datos):**
   * Crear el script de ingestión `backend/src/scripts/importar-destinos-csv.js`.
   * Añadir el comando `"db:import-destinos": "node src/scripts/importar-destinos-csv.js"` en `backend/package.json`.
   * Ejecutar la prueba y verificar los 3,534 registros en la tabla `lugares`.

2. **Fase 2 (Panel Administrativo):**
   * Habilitar el endpoint `POST /api/admin/destinos/importar-csv`.
   * Añadir el botón y modal de carga masiva en [DestinosPage.jsx](file:///c:/Users/Soporte%20TI%20Junior/Pictures/Nueva%20carpeta%20%282%29/panel-admin/src/pages/DestinosPage.jsx).

3. **Fase 3 (Optimización del Selector en Frontend):**
   * Implementar el campo de búsqueda con autocompletado en el formulario de viajes de la WebApp para garantizar una experiencia ágil para los conductores.
