# GV Supervisor - pruebas Android

Aplicación independiente de conductor. Package `com.aspromex.gvmobility.supervisor.testing`, nombre GV Supervisor Pruebas, API exclusivamente `https://gvmobility.aspromex.mx`.

## Alcance

- Acceso Microsoft del panel existente; requiere cuenta autorizada y rol de supervisión o superior.
- Pendientes: inspecciones vehiculares y gerenciamientos, por aprobar al abrir la pantalla. Se reutilizan revisión, firma y decisiones del panel.
- Viajes: consulta y detalle existente (ruta, GPS, paradas y acompañantes). En esta app no se ofrece eliminar viajes.
- Tarjetas en móvil, navegación inferior, cierre de sesión e inactividad de 20 minutos. Las aprobaciones requieren conexión.

## Autenticación

La APK abre Microsoft en el navegador del sistema. Un ticket aleatorio y un secreto independiente permiten entregar la sesión verificada a la app solicitante por una sola vez. Se conservan las validaciones de Microsoft, lista blanca y roles del servidor. El ticket expira a los cinco minutos y vive en memoria de una instancia del backend; si éste reinicia durante el acceso, se debe reintentar. No se necesitan URI nuevas en Azure: se reutiliza el redirect ya configurado para el panel. El retorno `gvsupervisor://auth` sólo despierta la app; no contiene credenciales. También se puede regresar manualmente desde el navegador y pulsar Ya inicié sesión.

Los tokens no se incorporan a enlaces, APK, capturas ni repositorio. La API normal conserva la autenticación del panel web. No se habilitan PIN ni accesos alternativos.

## Compilar

`npm ci --prefix panel-admin`, `npm ci --prefix supervisor-app`, `node supervisor-app/scripts/build-web.mjs`, `node supervisor-app/scripts/prepare-android.mjs`.

Se genera el proyecto Android desde Capacitor 8, con identidad propia y enlace de regreso. Compilar con Java 21 y SDK Android 36. Firma mediante las variables ANDROID_KEYSTORE_PATH/PASSWORD, ANDROID_KEY_ALIAS/PASSWORD. Versiones mediante ANDROID_VERSION_NAME/CODE.

Desde el workflow registrado Android firmado, elegir application=supervisor, channel=testing y versión. Se delega al workflow android-supervisor-release.yml, genera un borrador independiente con tag android-supervisor-testing-vVERSION-CODE, gv-supervisor.apk y update.json. Verificar firma, ID, host y SHA256 antes de publicarlo como prerelease. Estos tags no entran en el descubrimiento de actualizaciones del conductor.

## Verificaciones

Backend: `node --test backend/src/tests/supervisor-app-login.test.js` (secreto, consumo único, rol, expiración y capacidad).

Interfaz: iniciar Vite para panel-admin con VITE_SUPERVISOR_APP=true en 127.0.0.1:5179 y ejecutar `node panel-admin/tools/supervisor/verify.mjs`. La escena usa componentes reales y datos ficticios de sólo lectura; no inicia sesión ni aprueba contra AWS.

La validación completa del proveedor Microsoft y del retorno del navegador debe hacerse en un teléfono con una cuenta autorizada. No se simula una identidad real ni se cambia el rol de una cuenta para las pruebas.


## Versión 0.1.3 (código 4)

Una APK para SUPERVISOR, QHSE, COORDINADOR, COORDINADOR_AREA, COORDINADOR_QHSE, INSTRUCTOR, GERENTE, GERENTE_GENERAL y ADMINISTRADOR. La identidad de Android y firma se conservan para actualizar la instalación existente.

Se incorpora el filtro de gerencia y la identificación del autorizador desde la sesión ya desplegados en el servidor. La vista usa tarjetas y navegación como conductor, nombre del rol, filtros adaptables y datos del gerenciamiento legibles. La hoja completa con su inspección permanece desplegable; las acciones de revisión y firma están fuera de ella. Las tablas documentales extensas permiten desplazamiento dentro de su sección sin ensanchar la pantalla.

QA con componentes reales y datos ficticios: 320, 360, 390, 600, 768, 844 en horizontal, 1024 y 1280 px; login, pendientes, revisión de inspección, gerenciamiento, acciones accesibles, viajes y detalle; acceso de los nueve roles. No se realizan aprobaciones reales durante las pruebas. Microsoft y retorno nativo requieren prueba final en un teléfono autorizado.


## Versión 0.1.4 (código 5): actualizaciones y ajustes Android

- Actualizaciones independientes: `/api/android/update?application=supervisor&channel=testing`. Descubrimiento de releases publicados `android-supervisor-testing-*`, sin mezclar versiones de conductor. Usa el descubrimiento de pruebas ya configurado.
- Aviso antes y después del login, al regresar a la app y cada minuto visible. Botón para consultar manualmente junto a salir. Más tarde pospone 30 minutos. No interrumpe un modal de revisión.
- Descarga privada dentro de la app y verificación SHA256, versión mayor, paquete y certificado iguales antes de abrir el instalador Android. Se reutilizan las clases del actualizador del conductor en la preparación del proyecto. El usuario debe permitir instalaciones desde esta fuente si Android lo solicita.
- La 0.1.3 carece del actualizador: instalar una vez esta APK mediante enlace; versiones posteriores se detectan desde la app. No requiere desinstalar ni cerrar sesión.
- Insets nativos de Capacitor 8 para reservar las barras del sistema y el teclado. Filtros de estado en cuadrícula y filtros de gerenciamiento adaptables sin expandir el lienzo del WebView.
- QA adicional sobre el bundle compilado, no solo Vite: `node panel-admin/tools/supervisor/serve-built.mjs`; ejecutar verify.mjs con SUPERVISOR_QA_BUILT=true. Incluye estados vacíos, nueve roles, controles sin recorte y navegación visible. Sin dispositivo Android conectado: el comportamiento final del instalador y proveedor Microsoft se valida en teléfono.
