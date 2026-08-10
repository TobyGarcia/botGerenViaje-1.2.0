
# parche de modificacion, y arreglo de bug y de flujos de trabajo.
Modificaciones y cambios de la plataforma de Gerenciamiento de viajes

# ============== SECCIÓN 1: ACTUALIACIONES DEL PROYECTO ===================
# NOTA TODO ESTO SE ESTA REALIZANDO DESDE EL BRANCH DE  feature/render-deploy
# Actualizaciones de Proyecto
1. Creacion de bot y grupo para telegram. Se añadio a las variable de entorno de REDER los siguientes:
`TELEGRAM_GROUP_SUPRVISOR_ID=-1003564747661` y `TELEGRAM_SUPERVISOR_BOT_USERNAME=ITZ_supervisor_bot`,
esto con la finalidad de separar el bot de conductor y supervisor.

2. Creacion de otro sitio estatico de render. Se creo otra instancia de sitio estatico, para poder 
hacer la coneccion y despliegue unicamente de miniapp para supervisor para la autorizacion y firma
de la inspeccion vehicular, ademas de poder darse de alta y auterizar por id de telegram.

3. se Actualizo el `CORS` de las variables de entortn de gerenciamiento-viajes-api.on.render.com, 
con la finalidad de que este funcione correctamente dentro de todo el ecosistema de gerenciamiento 
de viajes. la url=https://gerenciamiento-viajes-supervision.onrender.com.

4. se modifico el `backend` los sigientes archivos `bot.js` y `supervisor-bot.js` dentro del proyecto
para poder solucionar un conflicto de insatancias de bot de telegram , ya que este marcaba un error 409
ya que se estaba incializado el bot con el mismo tipo de token, se tubo que hacer un tray-catc usando la
flags de comparadores logicos, ademas de usar un counter de intentos para poder hacer los intentos
de reconeccion del backaend con el token del bot de supervisor para poder validarlo y que los dos 
bots al mismo tiepo y no hagan choque de instansacion.

-este es una actualizacion de los modulos de frontend y panel-admin, la finalidad es poder
agregar nuevas funciones y corregir bugs criticos que se encuentran en los bugs causados por errores
de diseño.

# ============== SECCIÓN 2: BUGS Y ERRORES DE DISEÑO Y FLUJO DETECTADOS ==================
-listado de errores por diseño y bugs Documentados

=> flujo en miniApp Telegram en finalizar viaje.
    -Problema detectado:
    al momento de finalizar el viaje, se marca el kilometraje final, todo bien hasta esta parte del
    flujo todo transcuerre normal, te da la opcion de crear otro viaje, problema documentado es que
    al momento de iniciar un nuevo viaje, este toma el kilometraje anterior y no el que se marco
    al finalizar el viaje, no se actualiza o hace refesh de datos, por lo que tienes que cerrar la
    pantalla de la mini app para que está pueda abrir ya con el refesh de los datos, este es un error
    que puede romper la base de datos si no se arregla, ya que hbara una incongruencia entre el
    kilometraje final contra el kilometraje anterior que muestra al momento de crear un nuevo viaje
    dentro de la MiniApp de Telegram.

==>flujo de Grupo de Supervisores
    -Problema detectado:
    durante las pruebas surgio lo sigiente, el bot contesta y reacciona adecuadament sin ningun 
    problema, esta con el comportamiento que debe tener, el tema es el grupo, este no esta 
    generando las alertas, y revisando los logs al momento de recibir el trigger del bot que 
    manda la signal, este en la parte donde debe evaluarsi es grupo de supervisor marca
    `isGroup: false, matches: false`, lo que sugiere que el comando de disparador de signal
    funciona pero el grupo es incapas de recivir o rechaza el mensaje.

==> Bug de fecha de PDF de inspeccion de vehiculo
    bug detectado:
    duarante la depuracion se ve que los archivos de pdf generados marcan una hora de
    6 horas mas de las que esta el equipo, es decir deberia de tener la zona horaria de mexico
    -6 UTC, cuando sale en ves de que tome 1:25 pm toma 7:25pm.

=> Error de diseño inspeccion vehícular
    -Falla detectada:
    durante la fase de pruebas encontre esta falla de diseño, la inspeccion vehicular, efectivamente 
    se realiza una vez, hasta ahí todo esta bien y el comportamiento es el esperado, sin ningun 
    problema ni error durante el despliegue, manda la notificacion al panel ademin, y aunque no manda 
    mensaje al grupo de supervisores, el bot de supervisores marca efectivamente que hay una
    nueva notificacion en estado pendiente, todo bien esta ahí, el problema surge cuando otro 
    usuario con id de telegram entra a la miniapp como anteriormente a la unidad se le hizo una 
    ispeccion vehicular y se realizo la autorizacion el vehiculo queda libre, por lo que el otro
    usuario al elegir la misma unidad este se puede saltar la inspección vehicular, en esta parte 
    hay una parte de falla de diseño por lo que se debe ajustar una regla, la inspeccion vehucular
    es una ve al dia, se reinicia a las 10:00 pm de hora mexico -6UTC, pero cada usuario esta obligado
    a hacer la inspeccion vehicular aunque se el mismo vehículo y este haya tenido una inspeccion 
    previa por otro usuario.

==> Error de diseño de supervisores.
    Falla detectada:
    durante esta fas de pruebas surgio lo siguiente, use mi mismo telegram para pruebas y debug
    el error de diseño es el siguient, yo estoy dado de alta como conductor y supervisor, se supone
    que mi rol me permite autorizar la inspeccion vehicular, sin ningun problema. hasta ahí todo va 
    perfecto, la falla de diseño viene al momento de crear yo un viaje, creo un viaje con una unidad
    que requiere inspeccion, la mando, como ay un administrador (control) este deberia poder darme 
    autorizacion, el problema es que cuando yo entro en mi usuario, me sale la notificacion y me 
    puedo auto-aprobar la inspeccion, cuando alguien superior a mi , es decir el gerente o 
    administrador debe de autorizarme, este debe guardar relacion coeherencia de jerarquias.

# ======================= SECCIÓN 3: IMPLEMENTACIONES DEL FLUJO DE TRABAJO ======================
1. ASIGNACION Y VERIFICACION DE ROLES:
# ya tenemos definido los roles, pero estas son las siguientes sugerencias que se discutieron en la junta
# tecnica de demostracion de la beta de gerenciamiento-viajes.

# ROLES ASIGNADOS Y FUNCIONES QUE DEBERIAN TENER:
`ADMINISTRADOR`
    el administrador es el ownwer, es decir es el que tiene contol total de permisos, puede
    subir de nivel de acceso, puede crear, borrar y modificar la base de datos desde la pagina
    web.
    como esta el panel-admin esta bien por el control que se tiene ahora

`SUPERVISOR`
    Este nivel de acceso restringe varias funciones, puede crear unidades, ver consultar y aprobar 
    en el sitio web deberia aplicar estas  restricciones.

`OPERADOR`
     este solo puede ver el historial de viaje y ubicaciones y crear gerenciamiento de viaje para viajes ya
     fuera del estado
     esto debe verse reflegado en la app.

`CONSULTA`
    solo de pude realizar consultas y ver las estadisticas.

# IMPLEMENTACIONES PARA el paso 1.
visualmente en el pnel admin debe verse estas mejoras.
`ADMINISTRADOR`
    => Como esta el panel admin actual esta bien y las funciones.
    => Caracteristicas nuevas:
        => en el side bar crear una opcion de Administrador de usuarios,
        este modulo debe ser para administrar los usuarios administrativos
        aqui se puede mover jerarquia o eliminar usuario, se debe consider
        crear una page para este modulo

`SUPERVISOR`
    => visualmente esta bien, pero hay que tener las siguientes restricciones
    encuenta:
        1. los botones de dar de baja,elimainar y editar no estaran disponibles.
        2. puede agregar una nueva unidad o destino, y revisar ubicaciones viajes.
        3. en historial de las unidades, estara bloqueado la opccion de registrar
        manualmete el kilometraje.
        4.la opccion de Administrar usuarion no aparecera.

`OPERADOR`
    ==> restricciones a tomar en cuenta
    solo podra ver su viajes y ubicaciones.
    se añadira el modulo de gerensamiento de viajes.(este es un modulo a futuro,
    generar el flujo de trabajo y revisar las regalas)

`CONSULTA`
    ==>restricciones a tomar en cuenta
    solo podra ver su viajes y ubicaciones.

2. modificacion de registro de conductor.
esta parte se implementa lo siguiente para la miniapp, se va a agregar poner la
texbox de tipo de licencia.
# funcionalidad para implementar
se creara la siguiente implementacion, al registrarse el usuariose le generea un 
usuario y contraseña, y el rol que se le generara es de OPERADOR.
# consideraciones de cracion Usuario y contraña
seria que se tome el primer nombre y primer apellido, por lo que se debe de separar
el nombre y apellido, y despues concatenarse, para poder generar un usuario de esta
foma: `josue.tovar` y en la base de datos nombre completo: `Josue + Tovar Garcia`.
y al crear una contraseña esta se genera automaticamente, ademas de que se le debe
mandar un mensaje con su usuario y contraseña.
igual si es posible, que se cree un usuario al ingresar por primera vez le de la 
opccion de establecer su contraeña propia.
igual en el panel de `ADMINISTRADOR` el puede reestablecer contraseñas. por lo que debe
haber una opcion de restablecer contraseña si el usuario olvido su contraeña.
y telegram debe abrir un panel de restablesimiento de contraseña del panel-admin

3. ESTABLECIMIENTO DE REGLAS DE FLUJO DE TRABAJO
# SE ESTABLECE ESTA REGLA EN EL FLUJO DE TABAJO
en el backend y frontend, se debe de establecer la regla de que la inspeccion vehicular 
se realiza una vez por usuario, el restablecimiento sigue igual a las 10:00 pm, 
pero si deve validar el id de usuario, para realizar la inspeccion vehicular, por lo que
no importa si el vehiculo ya tubo una inspeccion anterior, ya que si orto usuario
agarra la misma unidad este esta obligado a hacer la inspeccion vehicular.

4. verificacion y Normalizacion de base de datos.
# chequeo de base de datos y normalizacion al hacer delete en un conductor
normalizaremos la base de datos para protejer la integridad de datos, verificaremos
que la eliminacion de lugares, vehiculos y conductores, sin que boerre el historial
de viajes y se pueda hacer que el boton de dar de baja, elemine el usuario junto con
usuario_telegram y usuarios admin por la modificacion del paso 2

5. MEJORAS DE FUNCIONALIDAD
# viajes, ver detalle
mi jefe de desarrollo, pidio que de donde apareche la ubucacion gps no made mensaje
si no despliegue la ubicacion actual dentro de viajes de panel-admin.

6. IMPLEMENTACION DE CRHOME NATIVO ANDROID
# implementacion de migracion de mini app a chrome
durante la revision , el gerente de TI sugiro que el proyecto se manejara con la
coneccion de telegram para avisar en los grupos, pero que las ventanas de las mini
app se pasen a cromhe, esto con el fin de tener el soporte nativo de gps y poder 
trabajarlo en segundo plano. esto con la finalidad de poder generar un traking
fiable, y asi poder verificar la ubicacion en tiempo real. esta seria la unica 
actualizacion que tomaria bastante y seria la mas fuerte por que es seguir usando
telegram para notificaciones y bots, pero usando chrome para poder usar la 
miniApp de conductor y supervisor, esta se debe planear, ya que un error a estas 
alturas puede romper todo el proyecto. (en este punto en especifico no lo 
implementaremos de golpe este debe ser por etapas y bien planeado)

7. MEJORAS ESTETICAS y Nuevas funciones
# personalizacion de perfil
durante este puno hagamos que el boton dnde esta el nombre usuario y rol, esto
aplica a todos los roles, la fincion de pesonalizacion para poner algunos datos
y poder poner foto de perfil, y datos importantes si tubiera un siniestro el
conductor.

# MINIAPP una funcion de reporte de siniestros
el bot de telegram pude abrir otra page diseñada para poder registrar un siniestro,
es decir si hay una abolladura, ponchadura, etc. para poder generar un reporte de
incidente que se envie al grupo de supervisores, para tenerlo archicvarlo.

# Guardar PDF en sharepoints dados por el cliente
el bot debe pder guardar las inspecciones y reporte de siniestros en un sharepoint
compartido por la parte de Activos para poder tener en la nube los reportes

#inspeccion vehicular
cambiar las letara aparecen blanco sobre el tono verde y no se entiende nada
igual implemetar el panel de abrit fitma y mostrar la parte de daños de 
vehiculo tanto en miniapp y en pane-admin.
# bug critico
verificar error de 409 con el bot de supervisor, por lo que se queda esperando, tengo 
el depurador de vs code para que funcione el bot en telegram, y no se manda los mensajes
al grupo.

8. Carga de datos reales y migracion a supabase,
# 2da migracion de datos en tabla limpia a SUPABASE
este paso es manual, solo se realizara para cargar los daros reales del los vehiculos
se esta tomando en consideracion para poder cargar dataos reales, en este puno es 
creacion de base de datos con los ecripst modificados y ejecucion de los scripts.
este es ultimo y solo sera cuando todo este funcional y poder desplegar ya para produccion
se plane usar supabase.

