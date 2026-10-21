# secure-mobile-mcp — Arquitectura

Control remoto de dispositivos Android/iOS sobre túnel cifrado punto a punto.

---

## Diagrama de Componentes

```
                                 INTERNET (cifrado E2E)
                                         |
         +-------------------------------+-------------------------------+
         |                               |                               |
+--------v--------+            +---------v---------+           +---------v---------+
|  MCP Server     |            |  Android Client   |           |  iOS Client       |
|  (Node.js)      |            |  (Kotlin)         |           |  (Swift)          |
+-----------------+            +-------------------+           +-------------------+
| - WireGuard iface|           | - WireGuard iface |           | - NetworkExtension|
| - API REST/WS   |            | - AccessibilityS. |           | - XPC Service     |
| - MCP Handler   |            | - MediaProjection |           | - Screen Recording|
| - SQLite state  |            | - Local API       |           | - Local API       |
+-----------------+            +-------------------+           +-------------------+
         |                               |                               |
         +---------------+---------------+---------------+---------------+
                         |                               |
                  +------v------+                 +------v------+
                  | WireGuard   |                 | WireGuard   |
                  | Tunnel      |<===============>| Tunnel      |
                  | 10.77.0.1   |  (UDP 51820)    | 10.77.0.x   |
                  +-------------+                 +-------------+
```

---

## Flujo de Conexión Cifrada

```
1. BOOTSTRAP
   Server genera keypair WireGuard (wg genkey / wg pubkey)
   Server escucha en UDP :51820 con IP interna 10.77.0.1/24

2. ENROLLMENT (fuera de banda)
   a) Server muestra QR con: endpoint, pubkey, PSK opcional
   b) Cliente escanea QR → configura túnel local
   c) Cliente genera su keypair, envía pubkey al server vía HTTPS bootstrap

3. HANDSHAKE WireGuard
   a) Cliente inicia handshake hacia endpoint:51820
   b) Intercambio Noise_IK con curva Curve25519
   c) Derivación de claves simétricas (ChaCha20-Poly1305)
   d) Túnel establecido — tráfico interno en 10.77.0.0/24

4. SESIÓN MCP
   a) Cliente conecta WebSocket a wss://10.77.0.1:3000/ws
   b) Autenticación: token JWT firmado con clave derivada del PSK
   c) Bidireccional: server envía comandos, cliente responde
```

---

## WireGuard vs IPsec — Justificación

| Criterio              | WireGuard                        | IPsec (IKEv2)                   |
|-----------------------|----------------------------------|---------------------------------|
| Complejidad           | ~4k líneas, auditable            | >400k líneas, superficie amplia |
| Latencia handshake    | 1-RTT                            | 2-4 RTT (IKE_SA_INIT + AUTH)    |
| Criptografía          | Moderna (ChaCha20, Curve25519)   | Negociable (puede ser débil)    |
| NAT traversal         | Nativo (UDP)                     | Requiere NAT-T, complejo        |
| Roaming               | Seamless (IP puede cambiar)      | Requiere MOBIKE                 |
| Soporte móvil         | Libs oficiales Android/iOS       | Nativo pero config compleja     |
| Consumo batería       | Bajo (UDP keepalive mínimo)      | Mayor (IKE rekeys frecuentes)   |

**Decisión: WireGuard como transporte primario.**

IPsec queda como fallback para redes corporativas que bloquean UDP no estándar:
- Detección automática: si WireGuard no conecta en 5s, intenta IKEv2/IPsec
- Android: StrongSwan embebido; iOS: NEVPNProtocolIKEv2 nativo

---

## Componentes

### 1. MCP Server (Node.js/TypeScript)

```
mcp-server/
├── src/
│   ├── index.ts              # Entry point
│   ├── wireguard/
│   │   ├── manager.ts        # wg-quick wrapper, peer management
│   │   ├── config.ts         # Generación wg0.conf dinámico
│   │   └── qr.ts             # QR enrollment generator
│   ├── tunnel/
│   │   ├── fallback.ts       # IPsec fallback logic
│   │   └── health.ts         # Keepalive, reconnect
│   ├── mcp/
│   │   ├── handler.ts        # Tool dispatch
│   │   ├── tools/            # 49+ tools (heredados de aster-mcp)
│   │   └── schemas.ts        # JSON Schema validation
│   ├── api/
│   │   ├── rest.ts           # Express/Fastify routes
│   │   └── ws.ts             # WebSocket server
│   ├── auth/
│   │   ├── jwt.ts            # Token signing/verification
│   │   └── psk.ts            # PSK derivation (HKDF)
│   ├── db/
│   │   └── sqlite.ts         # Device state, logs
│   └── types/
│       └── index.ts
├── wg/                       # WireGuard configs runtime
├── package.json
└── tsconfig.json
```

### 2. Android Client (Kotlin)

```
android/
├── app/
│   └── src/main/
│       ├── java/com/securemcp/
│       │   ├── MainActivity.kt
│       │   ├── tunnel/
│       │   │   ├── WireGuardTunnel.kt      # wireguard-android binding
│       │   │   ├── IpsecFallback.kt        # StrongSwan integration
│       │   │   └── TunnelManager.kt        # State machine
│       │   ├── mcp/
│       │   │   ├── McpClient.kt            # WebSocket client
│       │   │   ├── ToolExecutor.kt         # Local tool dispatch
│       │   │   └── tools/                  # Tool implementations
│       │   ├── services/
│       │   │   ├── AccessibilityService.kt # UI automation
│       │   │   ├── MediaProjectionService.kt
│       │   │   └── NotificationListener.kt
│       │   ├── enrollment/
│       │   │   └── QrScanner.kt
│       │   └── util/
│       │       └── Crypto.kt               # Key derivation
│       └── res/
├── build.gradle.kts
└── wireguard-android/                      # Git submodule
```

### 3. iOS Client (Swift)

```
ios/
├── SecureMCP/
│   ├── App/
│   │   └── SecureMCPApp.swift
│   ├── Tunnel/
│   │   ├── PacketTunnelProvider.swift      # NetworkExtension
│   │   ├── WireGuardAdapter.swift          # wireguard-apple binding
│   │   └── IKEv2Fallback.swift             # NEVPNProtocolIKEv2
│   ├── MCP/
│   │   ├── MCPClient.swift
│   │   ├── ToolExecutor.swift
│   │   └── Tools/
│   ├── Services/
│   │   ├── ScreenCapture.swift             # ReplayKit
│   │   └── Automation.swift                # XCTest private APIs (jailbreak) / Shortcuts
│   ├── Enrollment/
│   │   └── QRScanner.swift
│   └── Crypto/
│       └── KeyDerivation.swift             # CryptoKit HKDF
├── SecureMCPTunnel/                        # Network Extension target
│   └── PacketTunnelProvider.swift
├── SecureMCP.xcodeproj
└── Podfile / Package.swift
```

---

## APIs Expuestas sobre el Túnel

Todas las APIs operan dentro de la red 10.77.0.0/24, inaccesibles desde internet público.

### REST API (Server → Client polling fallback)

| Endpoint                    | Método | Descripción                          |
|-----------------------------|--------|--------------------------------------|
| `/api/v1/device/register`   | POST   | Registro inicial con pubkey          |
| `/api/v1/device/status`     | GET    | Estado: batería, conectividad, etc.  |
| `/api/v1/device/screenshot` | GET    | Captura de pantalla actual           |
| `/api/v1/device/execute`    | POST   | Ejecutar tool MCP específico         |
| `/api/v1/device/logs`       | GET    | Logs de ejecución recientes          |

### WebSocket API (bidireccional, preferida)

```jsonc
// Server → Client: comando
{
  "id": "uuid",
  "type": "tool_call",
  "tool": "tap",
  "params": { "x": 540, "y": 1200 }
}

// Client → Server: respuesta
{
  "id": "uuid",
  "type": "tool_result",
  "success": true,
  "data": { "tapped": true }
}

// Client → Server: evento push
{
  "type": "event",
  "event": "notification_received",
  "data": { "app": "com.whatsapp", "title": "Nuevo mensaje", ... }
}
```

### Tools MCP Heredados (49+)

Categorías principales:
- **UI**: tap, swipe, longPress, typeText, pressKey, getUiTree
- **Screen**: screenshot, screenRecord, getDisplayInfo
- **Apps**: launchApp, closeApp, listApps, installApk, uninstallApp
- **Files**: listFiles, readFile, writeFile, deleteFile, pushFile, pullFile
- **Comms**: sendSms, makeCall, readSms, readContacts, readCallLog
- **Notifications**: getNotifications, clearNotification, postNotification
- **System**: getBatteryInfo, getNetworkInfo, setVolume, setScreenBrightness
- **Media**: takePhoto, recordAudio, listMedia, playMedia

---

## Modelo de Amenazas y Mitigaciones

### Amenazas

| ID  | Amenaza                                | Impacto   | Probabilidad |
|-----|----------------------------------------|-----------|--------------|
| T1  | MITM en enrollment (QR interceptado)   | Crítico   | Baja         |
| T2  | Compromiso de clave privada del server | Crítico   | Baja         |
| T3  | Replay de comandos MCP                 | Alto      | Media        |
| T4  | Denegación de servicio UDP flood       | Medio     | Media        |
| T5  | Exfiltración de datos via tool abuse   | Alto      | Media        |
| T6  | Escalación de privilegios en cliente   | Crítico   | Baja         |
| T7  | Rogue device enrollment                | Alto      | Media        |

### Mitigaciones

| ID  | Mitigación                                                                 |
|-----|----------------------------------------------------------------------------|
| M1  | QR incluye hash del servidor; verificación visual del fingerprint en app  |
| M2  | Claves en HSM/Secure Enclave; rotación automática cada 30 días            |
| M3  | Nonces en cada comando; ventana de 30s; tabla de nonces vistos            |
| M4  | Rate limiting por IP; fail2ban en UDP; cookie WireGuard (DoS protection)  |
| M5  | Políticas por tool: whitelist de tools permitidos por dispositivo/rol    |
| M6  | Sandboxing: Accessibility con scope limitado; sin root; SELinux enforcing |
| M7  | Enrollment requiere OTP de admin + aprobación manual en dashboard         |

### Controles Adicionales

1. **Logging inmutable**: Todos los comandos se loguean con hash encadenado (append-only)
2. **Kill switch**: Server puede revocar peer instantáneamente (wg set wg0 peer ... remove)
3. **Geofencing opcional**: Rechazar conexiones fuera de rangos IP/país configurados
4. **Autenticación 2FA**: Dashboard admin requiere TOTP
5. **Cifrado at-rest**: SQLite con SQLCipher; configs con age/sops

---

## Decisiones de Diseño

1. **Monorepo**: Facilita cambios coordinados entre server y clientes
2. **WireGuard userspace**: Evita requerir root/jailbreak (wireguard-go, wireguard-apple)
3. **WebSocket sobre REST**: Menor latencia, eventos push, conexión persistente
4. **JWT con PSK**: Sin dependencia de PKI externa; PSK derivado del handshake WireGuard
5. **Fallback IPsec**: Garantiza conectividad en redes restrictivas
6. **Tools modulares**: Mismo patrón que aster-mcp para reusar lógica existente
