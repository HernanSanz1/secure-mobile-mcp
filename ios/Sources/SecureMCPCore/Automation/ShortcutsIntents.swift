import Foundation
import AppIntents

// MARK: - Connection Intents

/// Intent to connect to MCP server
@available(iOS 16.0, *)
public struct ConnectToServerIntent: AppIntent {
    public static var title: LocalizedStringResource = "Connect to MCP Server"
    public static var description = IntentDescription("Connects to the configured MCP server")

    public static var openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult {
        // Post notification to app to handle connection
        await MainActor.run {
            NotificationCenter.default.post(
                name: .mcpConnectRequested,
                object: nil
            )
        }
        return .result()
    }
}

/// Intent to disconnect from MCP server
@available(iOS 16.0, *)
public struct DisconnectFromServerIntent: AppIntent {
    public static var title: LocalizedStringResource = "Disconnect from MCP Server"
    public static var description = IntentDescription("Disconnects from the MCP server")

    public static var openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult {
        await MainActor.run {
            NotificationCenter.default.post(
                name: .mcpDisconnectRequested,
                object: nil
            )
        }
        return .result()
    }
}

// MARK: - VPN Intents

/// Intent to start VPN tunnel
@available(iOS 16.0, *)
public struct StartVPNIntent: AppIntent {
    public static var title: LocalizedStringResource = "Start SecureMCP VPN"
    public static var description = IntentDescription("Starts the WireGuard VPN tunnel")

    public static var openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult {
        await MainActor.run {
            NotificationCenter.default.post(
                name: .vpnStartRequested,
                object: nil
            )
        }
        return .result()
    }
}

/// Intent to stop VPN tunnel
@available(iOS 16.0, *)
public struct StopVPNIntent: AppIntent {
    public static var title: LocalizedStringResource = "Stop SecureMCP VPN"
    public static var description = IntentDescription("Stops the WireGuard VPN tunnel")

    public static var openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult {
        await MainActor.run {
            NotificationCenter.default.post(
                name: .vpnStopRequested,
                object: nil
            )
        }
        return .result()
    }
}

/// Intent to toggle VPN
@available(iOS 16.0, *)
public struct ToggleVPNIntent: AppIntent {
    public static var title: LocalizedStringResource = "Toggle SecureMCP VPN"
    public static var description = IntentDescription("Toggles the WireGuard VPN tunnel on/off")

    public static var openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult {
        await MainActor.run {
            NotificationCenter.default.post(
                name: .vpnToggleRequested,
                object: nil
            )
        }
        return .result()
    }
}

// MARK: - Status Intents

/// Intent to get connection status
@available(iOS 16.0, *)
public struct GetStatusIntent: AppIntent {
    public static var title: LocalizedStringResource = "Get SecureMCP Status"
    public static var description = IntentDescription("Returns the current connection and VPN status")

    public init() {}

    public func perform() async throws -> some IntentResult & ReturnsValue<String> {
        // This would need to be connected to actual state
        // For now, return placeholder
        return .result(value: "Status check requires app integration")
    }
}

// MARK: - App Shortcuts Provider

@available(iOS 16.0, *)
public struct SecureMCPShortcuts: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ConnectToServerIntent(),
            phrases: [
                "Connect to \(.applicationName)",
                "Start \(.applicationName) connection"
            ],
            shortTitle: "Connect",
            systemImageName: "antenna.radiowaves.left.and.right"
        )

        AppShortcut(
            intent: DisconnectFromServerIntent(),
            phrases: [
                "Disconnect from \(.applicationName)",
                "Stop \(.applicationName) connection"
            ],
            shortTitle: "Disconnect",
            systemImageName: "antenna.radiowaves.left.and.right.slash"
        )

        AppShortcut(
            intent: ToggleVPNIntent(),
            phrases: [
                "Toggle \(.applicationName) VPN",
                "Switch \(.applicationName) VPN"
            ],
            shortTitle: "Toggle VPN",
            systemImageName: "network.badge.shield.half.filled"
        )

        AppShortcut(
            intent: GetStatusIntent(),
            phrases: [
                "\(.applicationName) status",
                "Is \(.applicationName) connected"
            ],
            shortTitle: "Status",
            systemImageName: "info.circle"
        )
    }
}

// MARK: - Notification Names

public extension Notification.Name {
    static let mcpConnectRequested = Notification.Name("SecureMCP.connectRequested")
    static let mcpDisconnectRequested = Notification.Name("SecureMCP.disconnectRequested")
    static let vpnStartRequested = Notification.Name("SecureMCP.vpnStartRequested")
    static let vpnStopRequested = Notification.Name("SecureMCP.vpnStopRequested")
    static let vpnToggleRequested = Notification.Name("SecureMCP.vpnToggleRequested")
}
