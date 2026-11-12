# Guías visuales de la app

Tres recorridos: acompañantes (3 pasos), remolques (4) y uso sin conexión (3).
El icono de información junto a Salir abre Ayuda y novedades. Las guías permanecen siempre accesibles ahí, fuera de Mi perfil. Las novedades se abren automáticamente una vez por conductor y publicación cuando no hay viaje registrado. Leer o cerrar novedades guarda el visto; consultar una guía no marca las novedades como leídas. Borrar datos puede mostrar las novedades otra vez.

Las imágenes son capturas de los componentes reales del frontend con datos ficticios. Los recuadros se agregan sobre la interfaz durante la captura. No son imágenes generadas ni se capturan datos de usuarios.

## Regenerar capturas y comprobar el carrusel

Desde la raíz del repositorio, iniciar `npm --prefix frontend run dev -- --host 127.0.0.1 --port 5178`.
Luego ejecutar `node frontend/tools/guides/capture.mjs` y `node frontend/tools/guides/verify.mjs`.
Requiere Chrome instalado en Windows. Los scripts abren Chrome headless con un perfil aislado en Temp y depuración local en el puerto 9223. No usar ese puerto para otro navegador durante la ejecución.

La escena importa los componentes de producción. Simula ausencia de red y bloquea fetch, prepara exclusivamente datos locales de demostración en ese perfil aislado y nunca confirma movimientos contra un servidor. La inspección se completa únicamente en el borrador local para capturar el paso de confirmación. Los archivos de tools no se incluyen en dist.

El verificador recorre 10 pasos de guías y 3 novedades a 320/390/768 px; comprueba el icono junto a Salir, la ausencia de interrupciones durante un viaje, carga de imágenes, límites del modal, ampliación, cierre con Escape, persistencia independiente del visto y reproducción manual de novedades. Las capturas se incluyen como assets PNG para el precache de la PWA y las compilaciones Android futuras.

Cuando cambie el flujo, regenerar imágenes y revisar `src/components/user-guides.js`. Para cada actualización con novedades, editar `src/components/app-updates.js`: asignar un ID de publicación nuevo y preparar sus diapositivas y capturas. El ID es independiente del contenido de las guías, por lo que una publicación no obliga a repetir todos los tutoriales.
