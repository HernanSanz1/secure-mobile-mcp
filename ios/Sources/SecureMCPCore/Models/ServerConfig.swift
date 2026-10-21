import Foundation

/// Server configuration for MCP connection
public struct ServerConfig: Codable, Sendable {
    public let serverUrl: String
    public let authToken: String?
    public let deviceName: String
    public let enableTLS: Bool

    public init(
        serverUrl: String,
        authToken: String? = nil,
        deviceName: String,
        enableTLS: Bool = true
    ) {
        self.serverUrl = serverUrl
        self.authToken = authToken
        self.deviceName = deviceName
        self.enableTLS = enableTLS
    }

    /// Build WebSocket URL from server URL
    public var wsUrl: String {
        WsUrlPolicy.buildWsUrl(serverUrl)
    }
}

/// URL policy for WebSocket connections
public enum WsUrlPolicy {
    /// Build WebSocket URL with proper scheme
    public static func buildWsUrl(_ serverUrl: String) -> String {
        let cleanUrl = serverUrl.trimmingCharacters(in: .whitespaces)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        if cleanUrl.hasPrefix("ws://") || cleanUrl.hasPrefix("wss://") {
            return cleanUrl
        }
        if cleanUrl.hasPrefix("http://") {
            return cleanUrl.replacingOccurrences(of: "http://", with: "ws://")
        }
        if cleanUrl.hasPrefix("https://") {
            return cleanUrl.replacingOccurrences(of: "https://", with: "wss://")
        }

        let host = extractHost(cleanUrl)
        if isLanHost(host) {
            return "ws://\(cleanUrl)"
        }
        return "wss://\(cleanUrl)"
    }

    /// Extract host from URL
    public static func extractHost(_ url: String) -> String {
        var rest = url.trimmingCharacters(in: .whitespaces)
        let schemes = ["wss://", "ws://", "https://", "http://"]
        for scheme in schemes {
            if rest.hasPrefix(scheme) {
                rest = String(rest.dropFirst(scheme.count))
                break
            }
        }

        if let atIndex = rest.firstIndex(of: "@") {
            rest = String(rest[rest.index(after: atIndex)...])
        }

        let hostPort = rest.split(separator: "/").first.map(String.init) ?? rest
        let host = hostPort.split(separator: "?").first.map(String.init) ?? hostPort

        if host.hasPrefix("[") {
            return host.replacingOccurrences(of: "[", with: "")
                .split(separator: "]").first.map(String.init) ?? host
        }
        return host.split(separator: ":").first.map(String.init) ?? host
    }

    /// Check if host is a LAN address (use cleartext ws://)
    public static func isLanHost(_ host: String) -> Bool {
        host.hasPrefix("192.") ||
        host.hasPrefix("10.") ||
        host.hasPrefix("100.") ||  // Tailscale CGNAT
        host.hasPrefix("172.") ||
        host == "localhost" ||
        host == "127.0.0.1"
    }
}
