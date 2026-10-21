# secure-mobile-mcp — Dependencias

## MCP Server (Node.js/TypeScript)

### Runtime

| Paquete                | Versión  | Propósito                                    |
|------------------------|----------|----------------------------------------------|
| `typescript`           | ^5.4     | Lenguaje                                     |
| `@modelcontextprotocol/sdk` | ^1.x | SDK oficial MCP                              |
| `fastify`              | ^5.x     | HTTP server (más rápido que Express)         |
| `@fastify/websocket`   | ^10.x    | WebSocket support                            |
| `better-sqlite3`       | ^11.x    | SQLite sincrónico, rápido                    |
| `drizzle-orm`          | ^0.35    | ORM type-safe                                |
| `jose`                 | ^5.x     | JWT signing/verification                     |
| `zod`                  | ^3.23    | Schema validation                            |
| `consola`              | ^3.x     | Logger estructurado                          |
| `dotenv`               | ^16.x    | Environment variables                        |
| `qrcode`               | ^1.5     | QR generation para enrollment                |
| `wireguard-tools`      | ^1.x     | Wrapper para wg CLI (o child_process)        |

### Dev

| Paquete                | Propósito                          |
|------------------------|------------------------------------|
| `vitest`               | Testing                            |
| `tsx`                  | TS execution                       |
| `eslint` + `prettier`  | Linting/formatting                 |
| `@types/node`          | Node.js types                      |
| `@types/better-sqlite3`| SQLite types                       |

### Sistema (host)

- Node.js 22 LTS
- pnpm 9+
- WireGuard tools (`wg`, `wg-quick`)
- SQLite3 (para CLI debugging)

---

## Android Client (Kotlin)

### Gradle Dependencies (libs.versions.toml)

```toml
[versions]
kotlin = "2.0.20"
agp = "8.7.0"
coroutines = "1.9.0"
ktor = "3.0.0"
wireguard = "1.0.20231121"
strongswan = "2.5.1"
camera = "1.4.0"
mlkit = "17.3.0"

[libraries]
# Core
kotlin-stdlib = { module = "org.jetbrains.kotlin:kotlin-stdlib", version.ref = "kotlin" }
coroutines-core = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-core", version.ref = "coroutines" }
coroutines-android = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-android", version.ref = "coroutines" }

# Networking
ktor-client-core = { module = "io.ktor:ktor-client-core", version.ref = "ktor" }
ktor-client-okhttp = { module = "io.ktor:ktor-client-okhttp", version.ref = "ktor" }
ktor-client-websockets = { module = "io.ktor:ktor-client-websockets", version.ref = "ktor" }
ktor-serialization-json = { module = "io.ktor:ktor-serialization-kotlinx-json", version.ref = "ktor" }

# VPN/Tunnel
wireguard-android = { module = "com.wireguard.android:tunnel", version.ref = "wireguard" }
strongswan-vpn = { module = "org.strongswan.android:vpn", version.ref = "strongswan" }

# UI
compose-bom = { module = "androidx.compose:compose-bom", version = "2024.10.00" }
compose-material3 = { module = "androidx.compose.material3:material3" }
compose-ui = { module = "androidx.compose.ui:ui" }
navigation-compose = { module = "androidx.navigation:navigation-compose", version = "2.8.2" }

# QR Scanning
camera-core = { module = "androidx.camera:camera-core", version.ref = "camera" }
camera-camera2 = { module = "androidx.camera:camera-camera2", version.ref = "camera" }
mlkit-barcode = { module = "com.google.mlkit:barcode-scanning", version.ref = "mlkit" }

# Crypto
tink-android = { module = "com.google.crypto.tink:tink-android", version = "1.15.0" }

# Persistence
datastore = { module = "androidx.datastore:datastore-preferences", version = "1.1.1" }

# Logging
timber = { module = "com.jakewharton.timber:timber", version = "5.0.1" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
```

### Requisitos

- Android SDK 34 (target), minSdk 26 (Android 8.0)
- Kotlin 2.0+
- Gradle 8.7+
- Java 17

### Permisos Críticos

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
<uses-permission android:name="android.permission.BIND_ACCESSIBILITY_SERVICE" />
<uses-permission android:name="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" />
<uses-permission android:name="android.permission.READ_CONTACTS" />
<uses-permission android:name="android.permission.SEND_SMS" />
<uses-permission android:name="android.permission.CALL_PHONE" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

---

## iOS Client (Swift)

### Swift Package Manager (Package.swift)

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SecureMCP",
    platforms: [.iOS(.v15)],
    dependencies: [
        // WireGuard
        .package(url: "https://github.com/WireGuard/wireguard-apple", from: "1.0.16"),
        
        // Networking
        .package(url: "https://github.com/daltoniam/Starscream", from: "4.0.8"),
        
        // JSON
        .package(url: "https://github.com/apple/swift-argument-parser", from: "1.5.0"),
        
        // Logging
        .package(url: "https://github.com/apple/swift-log", from: "1.6.1"),
        
        // QR Scanning (AVFoundation nativo, no dep externa)
        
        // Keychain
        .package(url: "https://github.com/kishikawakatsumi/KeychainAccess", from: "4.2.2"),
    ],
    targets: [
        .target(
            name: "SecureMCP",
            dependencies: [
                .product(name: "WireGuardKit", package: "wireguard-apple"),
                "Starscream",
                "KeychainAccess",
                .product(name: "Logging", package: "swift-log"),
            ]
        ),
        .target(
            name: "SecureMCPTunnel",
            dependencies: [
                .product(name: "WireGuardKit", package: "wireguard-apple"),
            ]
        ),
    ]
)
```

### Frameworks del Sistema

| Framework               | Propósito                                    |
|-------------------------|----------------------------------------------|
| `NetworkExtension`      | Packet Tunnel Provider (VPN)                 |
| `CryptoKit`             | HKDF, AES-GCM, hashes                        |
| `AVFoundation`          | QR scanning con cámara                       |
| `ReplayKit`             | Screen capture/recording                     |
| `UserNotifications`     | Push notifications                           |
| `Security`              | Keychain, Secure Enclave                     |
| `LocalAuthentication`   | Face ID / Touch ID                           |

### Capabilities (Entitlements)

```xml
<key>com.apple.developer.networking.networkextension</key>
<array>
    <string>packet-tunnel-provider</string>
</array>
<key>com.apple.developer.networking.vpn.api</key>
<array>
    <string>allow-vpn</string>
</array>
<key>keychain-access-groups</key>
<array>
    <string>$(AppIdentifierPrefix)com.securemcp.shared</string>
</array>
```

### Requisitos

- iOS 15.0+ (mínimo para NetworkExtension moderno)
- Xcode 16+
- Swift 6
- Apple Developer Program (para Network Extension capability)

---

## Dashboard (Nuxt 3)

Heredado de aster-mcp con ajustes mínimos.

```json
{
  "dependencies": {
    "nuxt": "^3.13",
    "@nuxt/ui": "^2.18",
    "@vueuse/core": "^11.1",
    "pinia": "^2.2"
  },
  "devDependencies": {
    "typescript": "^5.6",
    "@nuxt/devtools": "^1.5"
  }
}
```

---

## Resumen de Herramientas Externas

| Herramienta       | Plataforma | Instalación                          |
|-------------------|------------|--------------------------------------|
| WireGuard         | Server     | `brew install wireguard-tools`       |
| pnpm              | Server     | `npm install -g pnpm`                |
| Android Studio    | Android    | Descarga oficial                     |
| Xcode             | iOS        | Mac App Store                        |
| Fastlane          | iOS CI     | `gem install fastlane`               |
