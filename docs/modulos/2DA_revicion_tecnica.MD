# segunda revision de proyecto por parte del jefe de desarrollo

# observaciones dadas por compañeros y jefe
1. en la parte de registro de conductor se debe de agregar los siguientes campos y la partede
creacion de viaje.

    * a. En la parte de donde se registra por primera vez el registro de conductor
    nuevo en la parte de la licencia, donde se pone la fecha se cambie por un combo
    box de mes y año, para que se rapido, al igual que incluir el combobox para 
    especificar el tipo de licencia.

    * b. En la parte de registro de viaje, con un compañero surgio un problema, no
    refresco bien la pagina de la miniapp, por lo que no pudo seleccionar unidad. se 
    soluciono abriendo y cerrando la ventana de miniapp. al igual estubo de ocioco en paso 8
    de inspeccion vehicular donde pide firma, lo lleno todo y trabo el boton de guardar
    firma.

    * c. Igual me comento mi jefe de desarrollo que debo considerar en las unidades maximo
    cuantos acompañantes pueden ir por unidad, es decir si la capacidad del vehiculo es de 
    4 pasajero y el maximo de acompañantes para esa unidad debe ser 3.

    * d. Mi compañero de desarrollo me sugirio que en la parte de acompañantes esta bien
    pero debian ir separados por coma, ciertamente el usuario final omitiria ese paso, por lo
    que sugirio que se haga un despliegue de un boto de añadir acompañante y se detenga segun
    el maximo de acompañantes de la unidad. es decir si voy en la L300 y esta me permite maximo
    3 acompañantes (copiloto y 2 atras) al querer agregar otro integrante este me arojara una 
    advertencia en mensaje de "ha superado el maximo de acompañantes", este es una sugerencia y buena
    idea de implementacion para la mini app.

    * e. Mi jefe me recordo un detalle importante, los conductores solo pueden darse de alta si han
    hecho manejo comentado. es decir pervio a registrarse deverian registrase y poner por seguridad un 
    folio y fecha de vencimiento, como no hemos llegado a esa parte, debemos pensar bien el flujo ya que debe
    de haber en el bot la parte de solicitud de curso de manejo comentado y examen de manejo.
    con eso de manera automatica deberia de generarse un folio que se le de al conductor para que entonces se pueda 
    registrar, este modulo no esta deisponible ya que hay que pensar bien el plan de trabajo y sentarme en reunion 
    con el ingeniero ricardo ocaña ya que el es le que ve toda la parte de logistica y el que lleva control de
    los instructores. (MODULO FUTURO A DESARROLLAR), por lo pronto cuando se registre solo pida casilla de 
    verificacion y fecha de vencimiento del manejo comentado.

    * f. Me comento igual mi jefe de desarrollo que debo saber de que empresa viene el conductor
    si biene de algunas de las sub empresa que tenemos 'ITZAMNA', 'MCCLICK'. 'BALAM', 'ASPROMEX',
    'AQUARIO','AGROKOOL', esto con la finalidad de saber de donde viene nuestro conductor

    * g. durante la pueba de creacion de viaje, se descubrio un bug, dos usuarios al mismo tiempo pueden
    generar un mismo viave. se hizo con un segundo de difernci, y exacatamente tomaron la misma unidad.
    sugirieron que dedsde el front end se haga el bloqueo, si el usuario final, seleciona una unidda esta se deberia bloquear en frontend para evitar que otro usuario agarre la misma unidad.
    es en esta parte de frontend/App.jsx, donde debe validar que otro usuario no elija una unidad si otro usuario
    intenta tomar la misma unidad.
                <label>
          Unidad
          <select name="idVehiculo" value={form.idVehiculo} onChange={handleChange} required>
            <option value="">Seleccione una unidad</option>
            {vehiculos.map((vehiculo) => (
              <option key={vehiculo.id_vehiculos} value={vehiculo.id_vehiculos}>
                {vehiculo.nombre} — {vehiculo.numero_economico}
              </option>
            ))}
          </select>
        </label>

2. detalles detectados durante el despliegue de inspeccion vehicular.

    # obserbaciones del jefe de desarrollo: (preguntas calaves que abren una nuva perspectiva)
    en la parte de check list me hizo las siguientes preguntas:
        1. ¿comó confirmo que los testigos (luces del auto) esten funcionando?
        2. ¿comó se que precion tenian las cuatro llantas?
        3. ¿comó se que voltaje o si esta o no esta descargada la bateria?
        2. ¿si el vehculo se va por un tiemp a otro estado? ¿como lo 
        gestionas? ¿como se a donde se fue?¿como se cuanto tiempo v a estar ahí?
        ¿se cconcider viaje largo con diferentes paradas o el sistema le deja hacer viajes pero
        la unidad queda anclada al usuari en ese periodo?
    estas preguntas cambian el paradigma, entonces en cierta parte tendriamos que verificar lo
    siguiente. la documentacion las fechas vigentes de tarjeta de circulacion (en mexico, campeche te
    dan las placas del vehiculo, junto con la tarjeta de circulacion que indica el tipo de vehiculo
    y que tipo de transporte es) eso es para verificacion visual y marcar fecha de vencimiento.
    al igua que en perecion de neumaticoa anotar la presion de los neumaticos que debe ser 35ps para
    ciudad y 32 psi para carretera. y marcar un indicador de vida util de bateria. esto para que en los 
    inforemes de reporte estos datos se agreguen.
    para viajes a otro estdo por seguridad deberia poder crearse una apartado para el conductor de 
    viaje a otra base, ya que tenemos 2 base campeche y tabasco. entonces este es un punto que no pude 
    responder pero en ACTUALIZACION_MODULOS_1.MD hay un apartado donde se concidera a futuro esa
    instansacion.

3. detalles de inicio de viaje, 
    # observacion logica del jefe de desarollo.
    - un viaje no solo tiene un destino si no que un viaje puede tener multiples destinos,
    considerando esto, entonces un viaje puede tener varias paradas, esto por que no solo 
    se hace viajes de base a obra, si no las de comercial van a comprar, suministros de papeleria
    , limpieza, y suministros para la pequeña cocina que tenemos (cafe galletas etc.).
    por lo que si un viaje tiene relacion 1:M done un viaje puede tener varios destinos, seria 
    dentro de viaje en curso la ocion de agregar destino, ya sea por gps o por destino previamente
    en la base de datos, asi hasta finalizar en el punto de destino final, este serian paradas,
    un ejemplo supongamos que mi origen es base peru, y mi destino sams club, pero debo hacer una 
    escala en home deppot o debo hacer escala en x lugar para compra o entregar documentacion.

4. Brechas de seguridad
    # observaciones de jefe de desarrollo
    # preguntas clave:
    * ¿Qué me asegura si algien encuenta el grupo (ya que el bot rabaja en grupo publico), no
    va aintentar acceder?
    * ¿Qué asegura de que cuando el conductor se registre realmente sea una persona de la empresa?
    * ¿Qué medida de seguridad se podria usar?, la sugerencia era un PIN personal
    esto es importante ya que se nececita una autenticacion ya que los operadores no tienen correo
    empresarial, por tanto uno de mis colegas sugirio rh para crea una whitwList,
    este es un punto importante ya que debe de ser la parte fuerte de seguridad e integridad de 
    datos.
    