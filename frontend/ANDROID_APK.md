# APK Android para pruebas

El APK es un contenedor de la Mini App/PWA publicada en
`https://gv.aspromex.mx/conductor/`. Al iniciar, carga esa URL HTTPS; por ello
requiere conexión a Internet y siempre usa la versión publicada más reciente.
Las peticiones a `/api` se hacen desde el mismo origen (`gv.aspromex.mx`).

## Requisitos

- Node.js y las dependencias del directorio `frontend`.
- Android Studio con Android SDK y JDK **17 o 21**. No usar el JBR incluido
  en versiones recientes de Android Studio si es Java 25: Gradle/Android
  Gradle Plugin todavía no lo admite para este proyecto.
- Una conexión a Internet para que el contenedor pueda cargar la PWA publicada.

Ejemplo para una compilación de prueba (usar la URL real del servidor):

```powershell
$env:VITE_API_BASE_URL = "https://gv.aspromex.mx"
$env:JAVA_HOME = "C:\\Program Files\\Java\\jdk-21"
$env:Path = "$env:JAVA_HOME\\bin;$env:Path"
npm run android:apk:debug
```

El archivo resultante se genera en:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Para instalarlo por USB con depuración habilitada:

```powershell
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

También puede abrirse el proyecto nativo con `npm run android:open` y ejecutarse
directamente en un teléfono desde Android Studio.

## Conectividad con el backend

No requiere una excepción CORS para las rutas de la PWA: la página y la API
usan `https://gv.aspromex.mx`. El backend mantiene también los orígenes de
Capacitor en `CORS_ORIGINS` para operaciones nativas futuras.
