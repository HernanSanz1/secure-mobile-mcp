# secure-mobile-mcp — Estructura de Carpetas

Monorepo con pnpm workspaces.

```
secure-mobile-mcp/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Lint, test, build
│   │   ├── android-release.yml       # Build APK/AAB
│   │   └── ios-release.yml           # Fastlane + TestFlight
│   └── CODEOWNERS
│
├── docs/
│   ├── ARCHITECTURE.md               # Este documento
│   ├── FOLDER_STRUCTURE.md           # Estructura del proyecto
│   ├── DEPENDENCIES.md               # Dependencias por plataforma
│   ├── ENROLLMENT.md                 # Flujo de enrollment detallado
│   ├── THREAT_MODEL.md               # Modelo de amenazas expandido
│   └── API.md                        # OpenAPI spec
│
├── packages/
│   ├── shared/                       # Código compartido TS
│   │   ├── src/
│   │   │   ├── crypto/               # HKDF, key derivation
│   │   │   ├── protocol/             # Mensajes MCP, schemas
│   │   │   └── types/                # TypeScript types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── wireguard-config/             # Generador de configs WG
│       ├── src/
│       │   ├── generator.ts
│       │   ├── qr.ts
│       │   └── validator.ts
│       └── package.json
│
├── mcp-server/                       # Servidor MCP principal
│   ├── src/
│   │   ├── index.ts
│   │   ├── wireguard/
│   │   │   ├── manager.ts
│   │   │   ├── config.ts
│   │   │   └── qr.ts
│   │   ├── tunnel/
│   │   │   ├── fallback.ts
│   │   │   └── health.ts
│   │   ├── mcp/
│   │   │   ├── handler.ts
│   │   │   ├── tools/
│   │   │   │   ├── ui.ts
│   │   │   │   ├── screen.ts
│   │   │   │   ├── apps.ts
│   │   │   │   ├── files.ts
│   │   │   │   ├── comms.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   ├── system.ts
│   │   │   │   └── media.ts
│   │   │   └── schemas.ts
│   │   ├── api/
│   │   │   ├── rest.ts
│   │   │   └── ws.ts
│   │   ├── auth/
│   │   │   ├── jwt.ts
│   │   │   └── psk.ts
│   │   ├── db/
│   │   │   ├── sqlite.ts
│   │   │   └── migrations/
│   │   └── types/
│   ├── wg/                           # WireGuard runtime configs
│   │   └── .gitkeep
│   ├── test/
│   ├── package.json
│   └── tsconfig.json
│
├── dashboard/                        # Web UI para administración
│   ├── app/                          # Nuxt 3 app
│   │   ├── components/
│   │   ├── pages/
│   │   ├── composables/
│   │   └── layouts/
│   ├── nuxt.config.ts
│   └── package.json
│
├── apps/
│   ├── android/                      # Cliente Android
│   │   ├── app/
│   │   │   └── src/
│   │   │       ├── main/
│   │   │       │   ├── java/com/securemcp/
│   │   │       │   │   ├── MainActivity.kt
│   │   │       │   │   ├── SecureMcpApp.kt
│   │   │       │   │   ├── tunnel/
│   │   │       │   │   │   ├── WireGuardTunnel.kt
│   │   │       │   │   │   ├── IpsecFallback.kt
│   │   │       │   │   │   └── TunnelManager.kt
│   │   │       │   │   ├── mcp/
│   │   │       │   │   │   ├── McpClient.kt
│   │   │       │   │   │   ├── ToolExecutor.kt
│   │   │       │   │   │   └── tools/
│   │   │       │   │   ├── services/
│   │   │       │   │   │   ├── McpAccessibilityService.kt
│   │   │       │   │   │   ├── MediaProjectionService.kt
│   │   │       │   │   │   └── NotificationListenerService.kt
│   │   │       │   │   ├── enrollment/
│   │   │       │   │   │   ├── QrScanner.kt
│   │   │       │   │   │   └── EnrollmentActivity.kt
│   │   │       │   │   ├── ui/
│   │   │       │   │   │   ├── theme/
│   │   │       │   │   │   └── screens/
│   │   │       │   │   └── util/
│   │   │       │   │       ├── Crypto.kt
│   │   │       │   │       └── Logger.kt
│   │   │       │   └── res/
│   │   │       └── test/
│   │   ├── tunnel/                   # Módulo VPN separado
│   │   │   └── src/main/java/
│   │   ├── build.gradle.kts
│   │   ├── settings.gradle.kts
│   │   └── gradle/
│   │       └── libs.versions.toml    # Version catalog
│   │
│   └── ios/                          # Cliente iOS
│       ├── SecureMCP/
│       │   ├── App/
│       │   │   ├── SecureMCPApp.swift
│       │   │   └── AppDelegate.swift
│       │   ├── Tunnel/
│       │   │   ├── WireGuardAdapter.swift
│       │   │   ├── IKEv2Fallback.swift
│       │   │   └── TunnelManager.swift
│       │   ├── MCP/
│       │   │   ├── MCPClient.swift
│       │   │   ├── ToolExecutor.swift
│       │   │   └── Tools/
│       │   ├── Services/
│       │   │   ├── ScreenCapture.swift
│       │   │   └── Automation.swift
│       │   ├── Enrollment/
│       │   │   └── QRScanner.swift
│       │   ├── Crypto/
│       │   │   └── KeyDerivation.swift
│       │   ├── UI/
│       │   │   ├── Views/
│       │   │   └── ViewModels/
│       │   └── Resources/
│       ├── SecureMCPTunnel/          # Network Extension target
│       │   ├── PacketTunnelProvider.swift
│       │   └── Info.plist
│       ├── SecureMCPTests/
│       ├── SecureMCP.xcodeproj/
│       ├── Package.swift             # SPM dependencies
│       └── Fastfile
│
├── tools/                            # Scripts de desarrollo
│   ├── generate-keys.sh              # Genera keypairs WireGuard
│   ├── dev-tunnel.sh                 # Túnel local para desarrollo
│   └── mock-device.ts                # Simulador de dispositivo
│
├── .claude/
│   └── settings.json
├── .gitignore
├── .gitmodules                       # wireguard-android, wireguard-apple
├── pnpm-workspace.yaml
├── package.json                      # Root scripts
├── tsconfig.base.json
└── README.md
```

## Workspaces (pnpm-workspace.yaml)

```yaml
packages:
  - 'packages/*'
  - 'mcp-server'
  - 'dashboard'
```

## Módulos Git (submodules)

```
apps/android/wireguard-android  → https://github.com/WireGuard/wireguard-android
apps/ios/wireguard-apple        → https://github.com/WireGuard/wireguard-apple
```
