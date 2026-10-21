# SecureMCP Android Client

Cliente Android con integración WireGuard para secure-mobile-mcp.

## Arquitectura

```
android/
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/securemcp/
│       │   ├── SecureMcpApplication.kt    # Application + notification channels
│       │   ├── data/
│       │   │   ├── model/TunnelConfig.kt  # Data classes (TunnelConfig, McpCommand, etc.)
│       │   │   └── local/
│       │   │       ├── SettingsDataStore.kt  # DataStore preferences
│       │   │       └── LogDatabase.kt        # Room DB for command logs
│       │   ├── di/AppModule.kt             # Hilt DI
│       │   ├── tunnel/WireGuardTunnel.kt   # WireGuard tunnel manager
│       │   ├── service/
│       │   │   ├── TunnelService.kt        # VPN foreground service
│       │   │   ├── McpCommandService.kt    # WebSocket command receiver
│       │   │   ├── AutomationAccessibilityService.kt  # UI automation
│       │   │   └── BootReceiver.kt         # Auto-connect on boot
│       │   └── ui/
│       │       ├── MainActivity.kt
│       │       ├── viewmodel/MainViewModel.kt
│       │       ├── screens/MainScreen.kt
│       │       └── theme/Theme.kt
│       └── res/
│           └── xml/
│               ├── network_security_config.xml
│               └── accessibility_service_config.xml
├── build.gradle.kts
├── settings.gradle.kts
└── gradle/libs.versions.toml
```

## Patron MVVM

- **Model**: `data/model/` - Data classes con kotlinx.serialization
- **View**: `ui/screens/` - Composables
- **ViewModel**: `ui/viewmodel/` - State management con Hilt

## Servicios

### TunnelService (VpnService)

Servicio foreground que mantiene el tunel WireGuard activo.

```kotlin
// Conectar
TunnelService.connect(context)

// Desconectar
TunnelService.disconnect(context)

// Verificar permiso VPN
val intent = TunnelService.prepare(context)
if (intent != null) {
    // Lanzar activity para pedir permiso
}
```

### McpCommandService

WebSocket client que recibe comandos del servidor MCP.

Tipos de comando soportados:
- `SHELL` - Ejecuta comandos shell
- `UI_ACTION` - Acciones de UI via AccessibilityService
- `SCREENSHOT` - Captura de pantalla (Android 11+)
- `FILE_OPERATION` - Operaciones de archivos
- `PACKAGE_OPERATION` - Info/manejo de paquetes
- `CUSTOM` - Extensible

### AutomationAccessibilityService

Automatización de UI. Acciones:
- `tap` - Toque en coordenadas
- `swipe` - Deslizar
- `click_text` - Click por texto
- `click_id` - Click por resource ID
- `input_text` - Escribir texto
- `scroll` - Scroll
- `back`, `home`, `recents`, `notifications` - Acciones globales
- `screenshot` - Captura (Android P+)

## Permisos Requeridos

### En AndroidManifest (concedidos automaticamente)

| Permiso | Uso |
|---------|-----|
| `INTERNET` | Conexion al servidor MCP |
| `ACCESS_NETWORK_STATE` | Estado de red |
| `FOREGROUND_SERVICE` | Servicios en background |
| `RECEIVE_BOOT_COMPLETED` | Auto-connect al iniciar |
| `WAKE_LOCK` | Mantener CPU activa |
| `POST_NOTIFICATIONS` | Notificaciones de estado |

### Permisos en Runtime

| Permiso | Cuando |
|---------|--------|
| VPN Permission | Al conectar tunel (dialog del sistema) |
| Accessibility | Manual en Settings > Accessibility |
| Battery Optimization | Recomendado deshabilitar |

### Permisos Especiales (via ADB)

Para shell commands avanzados:
```bash
adb shell pm grant com.securemcp.android android.permission.WRITE_SECURE_SETTINGS
```

## Configuracion

### Servidor MCP

1. Abrir app > Config tab
2. Ingresar Host, Port, Token
3. Guardar

### Tunel WireGuard

La app genera keypairs. El servidor debe proveer:
- Public key del servidor
- Endpoint (IP:puerto)
- IP asignada al cliente
- Allowed IPs

### Auto-connect

Habilitar en Status tab > "Auto-connect on boot"

## Build

```bash
cd android/
./gradlew assembleDebug

# APK en app/build/outputs/apk/debug/
```

Release build:
```bash
./gradlew assembleRelease -Pandroid.injected.signing.store.file=keystore.jks \
  -Pandroid.injected.signing.store.password=xxx \
  -Pandroid.injected.signing.key.alias=xxx \
  -Pandroid.injected.signing.key.password=xxx
```

## Protocolo WebSocket

El servicio MCP se conecta a `wss://{host}:{port}/mcp/commands`

### Comando entrante
```json
{
  "id": "uuid",
  "type": "SHELL",
  "payload": "ls -la",
  "timestamp": 1234567890
}
```

### Respuesta
```json
{
  "commandId": "uuid",
  "success": true,
  "output": "...",
  "error": null,
  "timestamp": 1234567890
}
```

## UI Actions (AccessibilityService)

```json
{
  "type": "tap",
  "x": 500,
  "y": 800
}
```

```json
{
  "type": "swipe",
  "startX": 500,
  "startY": 1000,
  "endX": 500,
  "endY": 300,
  "duration": 300
}
```

```json
{
  "type": "click_text",
  "text": "Settings"
}
```

```json
{
  "type": "input_text",
  "text": "Hello World"
}
```

## Dependencias Clave

- `com.wireguard.android:tunnel:1.0.20230706` - WireGuard tunnel library
- `com.google.dagger:hilt-android` - Dependency injection
- `androidx.datastore:datastore-preferences` - Settings persistence
- `androidx.room` - Command log database
- `com.squareup.okhttp3:okhttp` - WebSocket client
- `org.jetbrains.kotlinx:kotlinx-serialization-json` - JSON parsing

## Notas de Seguridad

1. La app no requiere root
2. El tunel excluye la propia app para evitar loops
3. Cleartext solo permitido para desarrollo local (localhost, 192.168.x.x)
4. AccessibilityService requiere habilitacion manual del usuario
5. Los logs de comandos se almacenan localmente en Room DB
