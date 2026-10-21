# SecureMCP iOS Client

## Overview

Native iOS client for SecureMCP, providing MCP server connectivity and WireGuard VPN tunnel support.

## Requirements

- iOS 15.0+
- Xcode 15.0+
- Swift 5.9+
- Apple Developer Program membership (for Network Extension entitlements)

## Project Structure

```
ios/
├── Package.swift                      # SPM package definition
├── Sources/SecureMCPCore/
│   ├── Models/
│   │   ├── ConnectionState.swift      # Connection/tunnel state enums
│   │   ├── WsMessages.swift           # WebSocket message types
│   │   └── ServerConfig.swift         # Server configuration
│   ├── WebSocket/
│   │   └── MCPWebSocketClient.swift   # WebSocket client with reconnection
│   ├── VPN/
│   │   └── WireGuardManager.swift     # WireGuard tunnel management
│   ├── Automation/
│   │   ├── ShortcutsIntents.swift     # Siri Shortcuts / App Intents
│   │   └── CommandExecutor.swift      # MCP command execution
│   └── UI/
│       ├── ConnectionStatusView.swift
│       ├── ServerConfigView.swift
│       └── LogsView.swift
├── SecureMCP/                         # Main app target
│   ├── SecureMCPApp.swift
│   ├── ContentView.swift
│   └── SecureMCP.entitlements
├── SecureMCPNetworkExtension/         # Network Extension target
│   ├── PacketTunnelProvider.swift
│   ├── Info.plist
│   └── SecureMCPNetworkExtension.entitlements
├── Tests/SecureMCPCoreTests/
└── SecureMCPUITests/
```

## iOS Limitations and Restrictions

### Sandbox Restrictions

iOS apps run in a sandboxed environment with significant restrictions compared to Android:

| Feature | Android | iOS | Notes |
|---------|---------|-----|-------|
| List installed apps | Yes | No | Privacy restriction |
| Read SMS/calls | Yes | No | Not accessible |
| Take screenshots | Yes | Limited | Only in-app, with user presence |
| Background execution | Flexible | Limited | Background modes required |
| System settings | Some | No | Cannot modify system settings |
| Accessibility services | Yes | No | Not available to third-party apps |
| Notification access | Yes | No | Cannot read other app notifications |
| File system access | Broad | Sandboxed | Only app container and user-selected files |

### Supported Commands

Due to iOS restrictions, only these MCP commands are implemented:

| Command | Status | Notes |
|---------|--------|-------|
| `ping` | Supported | Basic connectivity check |
| `device_info` | Supported | Returns device model, iOS version, etc. |
| `battery_status` | Supported | Battery level and charging state |
| `network_info` | Partial | Basic reachability only |
| `notification` | Supported | Requires notification permission |
| `clipboard_read` | Supported | Read pasteboard content |
| `clipboard_write` | Supported | Write to pasteboard |
| `open_url` | Supported | Opens URL in default browser/app |
| `haptic` | Supported | Trigger haptic feedback |
| `screenshot` | Not Supported | iOS privacy restriction |
| `app_list` | Not Supported | iOS privacy restriction |
| `ui_automation` | Not Supported | No accessibility services access |

### Network Extension Considerations

The WireGuard VPN requires a Network Extension, which has specific requirements:

1. **Apple Developer Program**: Must be enrolled to use Network Extension entitlements
2. **Provisioning Profile**: Requires explicit Network Extension capability
3. **App Groups**: Main app and extension must share an App Group for IPC
4. **Code Signing**: Extension must be signed with same team as main app
5. **Extension Lifecycle**: iOS may terminate the extension at any time to save resources

### Background Execution

iOS severely limits background execution:

- **WebSocket**: Connection will be suspended when app backgrounds
- **VPN Tunnel**: Remains active (system manages Network Extension)
- **Background Refresh**: Limited to periodic fetch (not guaranteed timing)
- **Push Notifications**: Can wake app briefly for processing

To maintain connectivity:
- Use VPN tunnel for critical communication path
- Implement push notification fallback for urgent commands
- Accept that WebSocket will disconnect on background

## Building

### Using Xcode

1. Open `ios/` folder in Xcode
2. Select your development team in Signing & Capabilities
3. Add Network Extension capability
4. Configure App Groups
5. Build and run

### Using Swift Package Manager

```bash
cd ios
swift build
swift test
```

Note: SPM build doesn't include the Network Extension or entitlements.

## Configuration

### Server Connection

The app connects to the MCP server via WebSocket. Configure in Settings:

- **Server URL**: WebSocket endpoint (e.g., `wss://mcp.example.com` or `ws://192.168.1.1:8080`)
- **Device Name**: Identifier shown in MCP dashboard
- **Auth Token**: Optional bearer token for authentication
- **Enable TLS**: Auto-detected based on URL scheme

URL scheme logic:
- LAN addresses (192.x, 10.x, 100.x, localhost) default to `ws://`
- Public addresses default to `wss://`
- Explicit schemes (`ws://`, `wss://`, `http://`, `https://`) are respected

### WireGuard VPN

Configure WireGuard tunnel in Settings > Configure WireGuard:

- **Private Key**: Client's WireGuard private key
- **Address**: Client IP in tunnel (e.g., `10.0.0.2/24`)
- **DNS Servers**: DNS to use through tunnel
- **Peer Public Key**: Server's WireGuard public key
- **Endpoint**: Server address and port (e.g., `vpn.example.com:51820`)

## Automation

### Siri Shortcuts

The app exposes these Shortcuts actions:

- **Connect to SecureMCP**: Initiates server connection
- **Disconnect from SecureMCP**: Closes connection
- **Toggle SecureMCP VPN**: Toggles VPN tunnel on/off
- **Get SecureMCP Status**: Returns current connection status

### Example Shortcut Phrases

- "Connect to SecureMCP"
- "Start SecureMCP connection"
- "Toggle SecureMCP VPN"
- "Is SecureMCP connected"

## Testing

### Unit Tests

```bash
swift test
```

### UI Tests

UI tests use XCUITest framework. Run from Xcode or:

```bash
xcodebuild test -scheme SecureMCP -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Entitlements Required

### Main App (SecureMCP.entitlements)

```xml
com.apple.developer.networking.networkextension: packet-tunnel-provider
com.apple.security.application-groups: group.com.securemcp.app
keychain-access-groups: $(AppIdentifierPrefix)com.securemcp.app
com.apple.developer.networking.vpn.api: allow-vpn
com.apple.developer.siri: true
```

### Network Extension

```xml
com.apple.developer.networking.networkextension: packet-tunnel-provider
com.apple.security.application-groups: group.com.securemcp.app
keychain-access-groups: $(AppIdentifierPrefix)com.securemcp.app
```

## Known Issues

1. **WebSocket disconnects on background**: iOS suspends the app; use VPN for reliable connectivity
2. **Network Extension cold start**: First VPN activation may take a few seconds
3. **Keychain access after device restart**: May require device unlock before first connection

## Comparison with Android Client

| Feature | Android | iOS |
|---------|---------|-----|
| Full MCP tool support | 49 tools | ~10 tools |
| Background WebSocket | Yes | Limited |
| UI automation | AccessibilityService | Not available |
| Screenshot capture | Yes | App only |
| Notification monitoring | Yes | Not available |
| On-device MCP server | Yes | Not feasible |
| Companion face overlay | Yes | Not available |

The iOS client is designed for secure tunneling and basic device interaction. For full MCP automation capabilities, use the Android client.
