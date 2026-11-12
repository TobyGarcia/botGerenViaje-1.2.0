# Guías visuales de la app

Tres recorridos: acompañantes (3 pasos), remolques (4) y uso sin conexión (3).
Se abren una vez por conductor y versión de guías, cuando no existe viaje registrado. También están en Mi perfil. Cerrar guarda el visto en almacenamiento local; borrar los datos del dispositivo puede mostrarlo otra vez.

Las imágenes son capturas de los componentes reales del frontend con datos ficticios. Los recuadros se agregan sobre la interfaz durante la captura. No son imágenes generadas ni se capturan datos de usuarios.

## Regenerar capturas y comprobar el carrusel

Desde la raíz del repositorio, iniciar `npm --prefix frontend run dev -- --host 127.0.0.1 --port 5178`.
Luego ejecutar `node frontend/tools/guides/capture.mjs` y `node frontend/tools/guides/verify.mjs`.
Requiere Chrome instalado en Windows. Los scripts abren Chrome headless con un perfil aislado en Temp y depuración local en el puerto 9223. No usar ese puerto para otro navegador durante la ejecución.

La escena importa los componentes de producción. Simula ausencia de red y bloquea fetch, prepara exclusivamente datos locales de demostración en ese perfil aislado y nunca confirma movimientos contra un servidor. La inspección se completa únicamente en el borrador local para capturar el paso de confirmación. Los archivos de tools no se incluyen en dist.

El verificador recorre los 10 pasos a 320/390/768 px, comprueba carga de imágenes, límites del modal, ampliación, cierre con Escape, persistencia del visto y reapertura manual. Las capturas se incluyen como assets PNG para el precache de la PWA y las compilaciones Android futuras.

Cuando cambie el flujo, regenerar imágenes y revisar `src/components/user-guides.js`. Cambiar GUIDE_VERSION solo cuando corresponda mostrar novedades otra vez.
