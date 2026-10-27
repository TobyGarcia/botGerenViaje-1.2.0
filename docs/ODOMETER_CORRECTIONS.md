# Reporte de diferencia de odómetro

Entrega limitada al entorno de pruebas. Se trata de kilómetros del odómetro;
no cambia las reglas de horómetros de maquinaria.

Una lectura inicial menor permite confirmar un reporte con motivo (5–300
caracteres) y foto tomada desde el visor. Está disponible en viaje urbano y
gerenciamiento. No pide autorización adicional ni envía mensajes directos al
supervisor. Los controles operativos habituales del viaje siguen vigentes.

La creación conserva reporte/foto y lectura propuesta, pero no cambia la
referencia de la unidad. Al iniciar, dentro de la transacción y con bloqueo de
unidad, se comprueba que la referencia anterior siga vigente y se aplica la
lectura nueva. Si el inicio falla, el ajuste se revierte. Si se cancela antes
de salir, no se aplica ni se envía. Viajes e historial anteriores no cambian.
El cierre resta su lectura inicial corregida: la diferencia del ajuste no se
suma ni resta como recorrido.

El reporte de un viaje local se conserva con su foto en la cola offline. El
catálogo local adopta la lectura al iniciar y al finalizar, para los viajes
siguientes. El servidor valida nuevamente al sincronizar; si otra operación
ya cambió la referencia, conserva el conflicto sin sobrescribirla a ciegas.

`041_ajustes_odometro.sql` debe aplicarse antes de desplegar backend. La fila
del reporte contiene la evidencia y funciona también como bandeja de salida:
solo después del inicio se envía una foto con el aviso al `TELEGRAM_GROUP_ID`
del bot de conductores. Un trabajador revisa cada 15 segundos y reintenta con
espera creciente. Fallar Telegram no revierte el viaje. La entrega es al menos
una vez: una respuesta de red perdida después del envío podría duplicar el aviso.

Las pruebas aisladas usan fotos sintéticas y emisor simulado: no envían mensajes
a grupos reales. Falta validar captura y aviso con un viaje real de pruebas.
