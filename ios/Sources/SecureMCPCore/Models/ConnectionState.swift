import Foundation

/// Connection state matching the MCP server protocol
public enum ConnectionState: String, Codable, Sendable {
    case disconnected
    case connecting
    case reconnecting
    case connected
    case pendingApproval = "pending_approval"
    case approved
    case rejected
    case error
}

/// Device approval status
public enum DeviceStatus: String, Codable, Sendable {
    case pending
    case approved
    case rejected
}

/// VPN tunnel state
public enum TunnelState: String, Sendable {
    case inactive
    case activating
    case active
    case deactivating
    case reasserting
    case invalid
}
