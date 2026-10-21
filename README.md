# Secure Mobile MCP

Control remoto seguro de Android para asistentes de IA via MCP (Model Context Protocol).

## Descarga

**APK Android**: [Releases v1.0.0](https://github.com/HernanSanz1/secure-mobile-mcp/releases/tag/v1.0.0)

## Que es

Conecta tu telefono Android a Claude u otros asistentes de IA. Controla el dispositivo con lenguaje natural: SMS, llamadas, capturas de pantalla, notificaciones, automatizacion de UI, y 49 herramientas MCP.

## Seguridad (lo nuevo)

Esta version implementa autenticacion criptografica que no existe en el proyecto original:

### Pareo mediante QR
1. El servidor genera un QR con su llave publica y un token unico
2. La app escanea el QR y genera sus propias llaves en Android Keystore (hardware-backed)
3. Se intercambian las llaves publicas
4. Solo ese dispositivo puede conectarse al servidor

### Handshake criptografico
- Cada conexion inicia con un handshake firmado
- El servidor verifica la firma antes de aceptar comandos
- Conexiones sin credenciales validas son ignoradas silenciosamente
- Para un atacante, el puerto parece cerrado

### Llaves en hardware
- Llaves ECDSA P-256 almacenadas en Android Keystore
- Protegidas por TEE o StrongBox cuando esta disponible
- La llave privada nunca sale del dispositivo

### Comandos firmados
- El servidor firma cada comando que envia
- El dispositivo verifica firmas antes de ejecutar
- Previene inyeccion de comandos

## Instalacion

### 1. Descargar la APK

Descarga desde [Releases](https://github.com/HernanSanz1/secure-mobile-mcp/releases/tag/v1.0.0) e instala en tu Android.

### 2. Instalar el servidor

```bash
cd server
npm install
npm start
```

### 3. Parear el dispositivo

1. Abre el dashboard en `http://localhost:5989`
2. Click en "Add Device" para generar QR
3. En la app Android, ve a Settings > Pair via QR
4. Escanea el QR - las llaves se generan automaticamente
5. Conecta al servidor - el handshake seguro ocurre automaticamente

### 4. Configurar tu cliente de IA

Agrega a tu configuracion MCP:

```json
{
  "mcpServers": {
    "secure-mobile": {
      "type": "http",
      "url": "http://localhost:5988/mcp"
    }
  }
}
```

## Funcionalidades

### Control de pantalla
- Capturas de pantalla
- Jerarquia de UI
- Taps, swipes, escritura

### Dispositivo
- SMS: leer y enviar
- Llamadas: hacer llamadas, TTS en altavoz
- Notificaciones
- Ubicacion, bateria
- Contactos
- Portapapeles

### Archivos
- Navegacion de almacenamiento
- Lectura y escritura
- Busqueda de medios

### Automatizacion
- Lanzar apps
- Click por texto o ID
- Acciones globales (Back, Home, Recents)

## Arquitectura

```
+------------------+     Handshake      +------------------+
|                  |    criptografico   |                  |
|  Servidor MCP    |<------------------>|  App Android     |
|  (Node.js)       |     WebSocket      |  (Keystore)      |
|                  |     cifrado        |                  |
+--------+---------+                    +------------------+
         |
         | MCP (HTTP)
         |
+--------v---------+
|                  |
|  Claude / IA     |
|                  |
+------------------+
```

## Diferencias con el original

| Aspecto | Original | Esta version |
|---------|----------|--------------|
| Autenticacion | Gate de aprobacion simple | Llaves criptograficas |
| Pareo | IP y puerto | QR con intercambio de llaves |
| Conexiones no autorizadas | Quedan pendientes | Ignoradas silenciosamente |
| Almacenamiento de llaves | N/A | Android Keystore (hardware) |
| Comandos | Sin firmar | Firmados por el servidor |

## Puertos

| Puerto | Uso |
|--------|-----|
| 5987 | WebSocket dispositivo |
| 5988 | API + MCP HTTP |
| 5989 | Dashboard web |

## Requisitos

- **Servidor**: Node.js >= 20
- **Android**: 8.0+ (API 26)
- **Red**: Dispositivo y servidor en la misma red (o Tailscale/VPN)

## Licencia

GPL-3.0

---

Fork seguro basado en [aster-mcp](https://github.com/satyajiit/aster-mcp). Las mejoras de seguridad (autenticacion criptografica, pareo QR, llaves hardware) son contribucion propia.
