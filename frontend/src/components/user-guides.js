import companionsOpen from '../assets/guides/companions-open.png';
import companionsEdit from '../assets/guides/companions-edit.png';
import companionsConfirm from '../assets/guides/companions-confirm.png';
import trailerSelect from '../assets/guides/trailer-select.png';
import trailerInspection from '../assets/guides/trailer-inspection.png';
import trailerConfirm from '../assets/guides/trailer-confirm.png';
import trailerDrop from '../assets/guides/trailer-drop.png';
import offlineBanner from '../assets/guides/offline-banner.png';
import offlineQueue from '../assets/guides/offline-queue.png';

export const GUIDE_VERSION = 'trip-operations-2026-11-v1';
export const userGuides = [
 {id:'companions',label:'Acompañantes',steps:[
  {title:'Abre Acompañantes',text:'Durante el viaje, toca Acompañantes para gestionar quién sube y quién baja.',image:companionsOpen,alt:'Captura real del viaje: acceso Acompañantes resaltado.'},
  {title:'Selecciona quién baja y quién sube',text:'Marca a quienes dejas. Escribe los nombres de quienes recoges y usa + Otro para añadir más. Máximo 4 a bordo.',image:companionsEdit,alt:'Captura real de la parada: Ana seleccionada para bajar y Luis para subir.'},
  {title:'Confirma una sola parada',text:'Selecciona el lugar y toca Confirmar parada. Los movimientos se guardan juntos en un punto y un mensaje de Telegram.',image:companionsConfirm,alt:'Captura real con lugar seleccionado y Confirmar parada resaltado.'}
 ]},
 {id:'trailers',label:'Remolques',steps:[
  {title:'Selecciona el remolque',text:'Abre Remolques y elige la unidad que vas a recoger. Se abrirá su inspección.',image:trailerSelect,alt:'Captura real del selector de remolques disponibles resaltado.'},
  {title:'Haz una inspección nueva',text:'Revisa los datos, las vistas, los daños y el checklist. Guarda la inspección. Cada enganche requiere una nueva, aunque uses el mismo remolque.',image:trailerInspection,alt:'Captura real de la inspección del remolque con su diagrama.'},
  {title:'Confirma el enganche',text:'Confirma el estado de la inspección, selecciona el lugar y toca Confirmar parada. También puedes incluir acompañantes en esta misma parada.',image:trailerConfirm,alt:'Captura real de la inspección capturada y confirmación del enganche.'},
  {title:'Cuando dejes el remolque',text:'Marca el remolque enganchado, elige el lugar y confirma la parada. Si lo recoges de nuevo, realiza otra inspección.',image:trailerDrop,alt:'Captura real de un remolque seleccionado para desenganchar.'}
 ]},
 {id:'offline',label:'Sin conexión',steps:[
  {title:'Prepara el viaje con conexión',text:'Abre el viaje con internet para guardar sus datos y catálogos en el teléfono antes de salir.',image:companionsOpen,alt:'Captura real de los controles del viaje que deben estar preparados en el teléfono.'},
  {title:'Continúa sin internet',text:'El aviso indica que no hay conexión. Puedes registrar movimientos con los destinos guardados; conserva habilitado el permiso de ubicación.',image:offlineBanner,alt:'Captura real del aviso Sin conexión a internet resaltado.'},
  {title:'Revisa lo pendiente',text:'Las paradas e inspecciones quedan guardadas en el teléfono. Al volver la conexión, abre la app y espera a que desaparezca el aviso de pendientes. No borres los datos de la app.',image:offlineQueue,alt:'Captura real de una parada guardada en el teléfono pendiente de sincronizar.'}
 ]}
];
