# Guías visuales de la app

Dos recorridos visibles: acompañantes (3 pasos) y remolques (4).
El icono de información junto a Salir abre únicamente Guías visuales. No hay sección de novedades, tutorial de uso sin conexión ni aperturas automáticas. Las guías no están en Mi perfil.

Las imágenes son capturas de los componentes reales del frontend con datos ficticios. Los recuadros se agregan sobre la interfaz durante la captura. No son imágenes generadas ni se capturan datos de usuarios.

## Regenerar capturas y comprobar el carrusel

Desde la raíz del repositorio, iniciar `npm --prefix frontend run dev -- --host 127.0.0.1 --port 5178`.
Luego ejecutar `node frontend/tools/guides/capture.mjs` y `node frontend/tools/guides/verify.mjs`.
Requiere Chrome instalado en Windows. Los scripts abren Chrome headless con un perfil aislado en Temp y depuración local en el puerto 9223. No usar ese puerto para otro navegador durante la ejecución.

La escena importa los componentes de producción. Simula ausencia de red y bloquea fetch, prepara exclusivamente datos locales de demostración en ese perfil aislado y nunca confirma movimientos contra un servidor. La inspección se completa únicamente en el borrador local para capturar el paso de confirmación. Los archivos de tools no se incluyen en dist.

El verificador recorre los 7 pasos a 320/390/768 px; comprueba el icono junto a Salir, la ausencia de aperturas automáticas, las dos guías exactas, carga de imágenes, límites del modal, ampliación, cierre con Escape y reapertura manual. Las capturas se incluyen como assets PNG en el precache de la PWA y las compilaciones Android futuras.

Cuando cambie el flujo, regenerar imágenes y revisar `src/components/user-guides.js`. Las capturas históricas de uso sin conexión se conservan como fuente, pero no se importan ni forman parte de las guías visibles.
