# Taxi Empresa Android (APK)

Este proyecto permite empaquetar la versión web como app Android usando `WebView`.

## Requisitos
- Android Studio (Hedgehog o más reciente)
- Android SDK 34
- JDK 17

## Abrir proyecto
1. Abrir Android Studio.
2. Seleccionar **Open** y elegir la carpeta `android/`.
3. Esperar sincronización de Gradle.

## Generar APK de prueba (debug)
- En Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
- O terminal:
  ```bash
  cd android
  ./gradlew assembleDebug
  ```

APK resultante:
`android/app/build/outputs/apk/debug/app-debug.apk`

## Instalar en móvil real
- Activar "Opciones de desarrollador" y "Depuración USB".
- Conectar móvil y ejecutar:
  ```bash
  adb install -r app/build/outputs/apk/debug/app-debug.apk
  ```
