# Compatibilidad de APK anterior — 14 de noviembre de 2026

## Resultado y alcance

**Compatibilidad de servicios/base de datos comprobada en el ambiente de pruebas existente. La validación integral en Android queda pendiente.** No se desplegó ni accedió a producción. No se reinició staging ni se ejecutó un corte real con un teléfono conectado.

Referencia: APK estable `com.aspromex.gerenciamientoviajes` **1.2.22 (28)**, identificada con aapt sobre `tmp/driver-stable-baseline.apk`. SHA256 `d924efd1a58562fcaff1813e09074088dc0fda123d264da8e62782d2ab9ba726`. El contenido web del binario usa `POST /api/viajes/:id/finalizar` con `{kilometrajeFinal}`, lote GPS con `{ubicaciones}` y sincronización offline. No contiene el endpoint de movimientos ni CONFIRMED_ACTIONS: esa APK todavía no ofrece acompañantes/remolques nuevos. Su configuración productiva no se modificó para apuntarla a pruebas.

## Verificaciones realizadas

Se ejecutó `scripts/production/verify-legacy-client-staging.mjs` dentro del backend existente `gvmobility-backend`, base `gerenciamiento_viajes_stg`. El script rechaza cualquier otra base antes de escribir. Fixtures sintéticos en transacción externa; transacciones de servicio mediante savepoints; rollback final. No invoca controladores de entrega ni bots; workers no pueden ver los eventos sin commit. Solo se consumen valores de secuencias de staging. Se verificó que no quedaron viajes de prueba.

- Un viaje EN_CURSO se consulta y finaliza usando el contrato de la APK anterior, conservando kilometraje inicial y guardando el final.
- Lote GPS/parada pendiente enviado dos veces: una sola ubicación persistida dentro de la prueba.
- GPS capturado durante el viaje se acepta incluso si llega después del cierre, dentro del margen admitido por el servidor.
- Cobertura adicional para clientes con movimientos: acompañante y remolque juntos, lugar/hora/GPS originales, inspección con captura y daños. Reenvío de la misma clave produce una sola parada y evento de bandeja.
- Inspección recuperable por el servicio de anexos antes y después de finalizar. Esto verifica datos del anexo, no el render visual de un PDF en Android.
- Cierre nativo repetido con la misma clave: un solo cierre; el reintento devuelve notify=false.
- **16 pruebas frontend correctas** de cola offline, movimientos, recarga, respuesta perdida, conflictos, conservación de nuevos pendientes durante sincronización y envío de movimientos/GPS antes del cierre. Estas pruebas corresponden al código actual, no a ejecución del binario antiguo.

No se enviaron Telegram/push, no se publicaron APK ni se actualizaron servicios.

## Lo que falta antes de afirmar validación completa

No hay teléfono Android conectado ni AVD configurado. Falta una prueba controlada en dispositivo con el código de la APK antigua, configurado para staging sin cambiar sus contratos: viaje activo y capturas pendientes antes del cambio, interrupción/reinicio del backend, reapertura offline, reconexión y finalización; comprobar autorización HTTP, UI, GPS en segundo plano y acuses de cola. Un build antiguo configurado para staging no es el mismo binario firmado productivo; registrar esa diferencia. No apuntar la APK productiva a datos reales para ensayar.

El cierre tradicional no aporta la clave idempotente del cierre nativo nuevo. Las verificaciones anteriores no demuestran recuperación automática de la UI antigua si se pierde la respuesta del cierre tradicional; incluir expresamente ese caso en el ensayo del dispositivo. Tampoco se garantiza GPS continuo por restricciones del sistema operativo.

Conclusión: no se encontró incompatibilidad en los contratos de servicio probados, pero no se considera cerrado el canario completo APK/despliegue por estas pruebas parciales.
