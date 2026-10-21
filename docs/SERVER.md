# Secure Mobile MCP Server

Backend seguro para comunicacion MCP con dispositivos moviles. Implementa cifrado extremo a extremo, autenticacion por claves, y tunelizacion WireGuard.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                    Secure Mobile MCP Server                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │  WebSocket  │    │   REST API  │    │  WireGuard Tunnel   │  │
│  │   Server    │    │   Server    │    │    (Opcional)       │  │
│  │  (wss://)   │    │  (https://) │    │    (UDP/51820)      │  │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘  │
│         │                  │                      │             │
│         └──────────────────┼──────────────────────┘             │
│                            │                                    │
│  ┌─────────────────────────┴─────────────────────────────────┐  │
│  │                   Authentication Layer                    │  │
│  │  - Ed25519 signatures                                     │  │
│  │  - X25519 key exchange                                    │  │
│  │  - Session tokens                                         │  │
│  │  - Rate limiting                                          │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                            │                                    │
│  ┌─────────────────────────┴─────────────────────────────────┐  │
│  │                    Device Store (SQLite)                  │  │
│  │  - Device registry                                        │  │
│  │  - Session management                                     │  │
│  │  - Audit logs                                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Seguridad

### Autenticacion

1. **Registro de Dispositivo**
   - El dispositivo genera un par de claves Ed25519
   - Envia clave publica al servidor
   - Estado inicial: `pending`

2. **Flujo de Auth**
   ```
   Device                          Server
     │                               │
     │─── secure_auth ──────────────>│
     │    deviceId                   │
     │    timestamp                  │
     │    signature(deviceId+ts)     │
     │                               │
     │<── secure_auth_response ──────│
     │    status                     │
     │    sessionToken               │
     │    serverPublicKey            │
     │                               │
   ```

3. **Protecciones**
   - Firma Ed25519 verificada
   - Timestamp con drift maximo de 30 segundos (anti-replay)
   - Rate limiting: 5 intentos por minuto
   - Lockout: 5 minutos despues de exceder intentos

### Cifrado

- **Firmas**: Ed25519 (NaCl/libsodium)
- **Key Exchange**: X25519 (Curve25519)
- **Symmetric**: XSalsa20-Poly1305 (authenticated encryption)
- **Hashing**: BLAKE2b para derivacion de claves

### WireGuard Tunnel

El tunel WireGuard proporciona:
- Cifrado a nivel de red (capa 3)
- Proteccion contra ataques de red
- IP privada dedicada por dispositivo
- Keepalives para NAT traversal

## Instalacion

### Prerrequisitos

- Node.js 20+
- pnpm
- macOS: `brew install wireguard-go wireguard-tools`
- Linux: `apt install wireguard-tools`

### Setup

```bash
cd server

# Instalar dependencias
pnpm install

# Generar claves criptograficas
pnpm setup:keys

# (Opcional) Configurar WireGuard
pnpm setup:wireguard

# Copiar configuracion
cp .env.example .env

# Iniciar servidor
pnpm dev
```

## Configuracion

Variables de entorno (`.env`):

```bash
# Identidad del servidor
SERVER_ID=uuid-generado

# Puertos
WS_PORT=5987          # WebSocket seguro
API_PORT=5988         # REST API

# Base de datos
DB_PATH=./secure-mcp.db

# Seguridad
REQUIRE_MTLS=true           # Requerir autenticacion
MAX_AUTH_ATTEMPTS=5         # Intentos antes de lockout
AUTH_LOCKOUT_MS=300000      # 5 minutos de lockout
SESSION_TTL_MS=86400000     # 24 horas de sesion
AUTH_TIMEOUT=10000          # 10 segundos para autenticar

# Timeouts
COMMAND_TIMEOUT=30000       # 30 segundos
HEARTBEAT_INTERVAL=30000    # 30 segundos
HEARTBEAT_TIMEOUT=90000     # 90 segundos

# WireGuard (opcional)
WIREGUARD_ENABLED=false
WG_PORT=51820
WG_SUBNET=10.200.0.0/24
```

## API Reference

### Autenticacion WebSocket

```typescript
// Mensaje de auth del dispositivo
{
  type: "secure_auth",
  deviceId: "uuid",
  timestamp: 1698765432000,
  signature: "base64-ed25519-signature",
  deviceInfo: {
    name: "Mi Telefono",
    model: "Pixel 7",
    manufacturer: "Google",
    platform: "android",
    osVersion: "14",
    appVersion: "1.0.0"
  }
}

// Respuesta del servidor
{
  type: "secure_auth_response",
  success: true,
  status: "approved",
  sessionToken: "base64url-token",
  serverPublicKey: "base64-x25519-pubkey"
}
```

### REST API

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/status` | GET | Estado del servidor |
| `/api/devices` | GET | Listar dispositivos |
| `/api/devices/:id` | GET | Detalle de dispositivo |
| `/api/devices/:id/approve` | POST | Aprobar dispositivo |
| `/api/devices/:id/reject` | POST | Rechazar dispositivo |
| `/api/devices/:id/revoke` | POST | Revocar acceso |
| `/api/devices/:id/execute` | POST | Ejecutar comando |
| `/api/audit` | GET | Logs de auditoria |
| `/api/sessions/stats` | GET | Estadisticas de sesiones |

### Headers de Autenticacion

```
Authorization: Bearer <sessionToken>
```

## Estructura de Archivos

```
server/
├── src/
│   ├── index.ts              # Entry point
│   ├── types/
│   │   └── index.ts          # Type definitions
│   ├── auth/
│   │   ├── crypto.ts         # Cryptographic operations
│   │   ├── session.ts        # Session management
│   │   └── index.ts
│   ├── tunnel/
│   │   ├── wireguard.ts      # WireGuard management
│   │   └── index.ts
│   ├── mcp/
│   │   ├── secure-websocket.ts  # WebSocket server
│   │   ├── secure-server.ts     # REST API server
│   │   └── index.ts
│   └── util/
│       ├── audit.ts          # Audit logging
│       ├── validation.ts     # Input validation
│       └── index.ts
├── scripts/
│   ├── generate-keys.ts      # Key generation
│   └── setup-wireguard.ts    # WireGuard setup
├── package.json
└── tsconfig.json
```

## Logs de Auditoria

Todos los eventos de seguridad se registran:

- `auth_attempt` - Intento de autenticacion
- `auth_success` - Autenticacion exitosa
- `auth_failure` - Autenticacion fallida
- `auth_lockout` - Dispositivo bloqueado
- `device_registered` - Nuevo dispositivo
- `device_approved` - Dispositivo aprobado
- `device_rejected` - Dispositivo rechazado
- `device_revoked` - Acceso revocado
- `session_created` - Nueva sesion
- `session_expired` - Sesion expirada
- `command_sent` - Comando enviado
- `command_received` - Respuesta recibida
- `tunnel_connected` - Conexion WireGuard
- `tunnel_disconnected` - Desconexion WireGuard

Consulta logs:
```bash
curl http://localhost:5988/api/audit?eventTypes=auth_failure,auth_lockout&severity=warn,error
```

## DevSecOps

### Validacion de Inputs

- Todos los inputs validados con Zod schemas
- UUIDs, IPs, claves publicas con regex estrictos
- Parametros de comandos validados recursivamente
- Sanitizacion de strings (control characters)

### Sin Secretos Hardcodeados

- Claves generadas dinamicamente
- Configuracion via variables de entorno
- Claves privadas con permisos 0600
- Nunca se loguean secretos (redaction automatica)

### Principio de Minimo Privilegio

- Dispositivos inician como `pending`
- Aprobacion manual requerida
- Sesiones con TTL limitado
- Revocacion inmediata posible

## Troubleshooting

### Error: "Device not connected"

El dispositivo no tiene WebSocket activo. Verificar:
1. Conexion de red
2. Firewall permite puerto 5987
3. Estado del dispositivo es `approved`

### Error: "Too many auth attempts"

El dispositivo esta en lockout. Esperar 5 minutos o:
```bash
# Limpiar lockout manualmente (reiniciar servidor)
```

### WireGuard no conecta

1. Verificar que wireguard-tools esta instalado
2. Revisar firewall (UDP 51820)
3. Verificar endpoint correcto en cliente
4. Revisar logs: `sudo wg show`

## Licencia

MIT
