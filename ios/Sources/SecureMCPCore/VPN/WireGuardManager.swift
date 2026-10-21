import Foundation
import NetworkExtension
import Combine

/// WireGuard VPN tunnel configuration
public struct WireGuardConfig: Codable, Sendable {
    public let privateKey: String
    public let address: String
    public let dns: [String]
    public let peer: PeerConfig

    public struct PeerConfig: Codable, Sendable {
        public let publicKey: String
        public let endpoint: String
        public let allowedIPs: [String]
        public let persistentKeepalive: Int?

        public init(
            publicKey: String,
            endpoint: String,
            allowedIPs: [String] = ["0.0.0.0/0", "::/0"],
            persistentKeepalive: Int? = 25
        ) {
            self.publicKey = publicKey
            self.endpoint = endpoint
            self.allowedIPs = allowedIPs
            self.persistentKeepalive = persistentKeepalive
        }
    }

    public init(
        privateKey: String,
        address: String,
        dns: [String] = ["1.1.1.1", "8.8.8.8"],
        peer: PeerConfig
    ) {
        self.privateKey = privateKey
        self.address = address
        self.dns = dns
        self.peer = peer
    }

    /// Generate WireGuard config file content
    public func toConfigString() -> String {
        var config = """
        [Interface]
        PrivateKey = \(privateKey)
        Address = \(address)
        DNS = \(dns.joined(separator: ", "))

        [Peer]
        PublicKey = \(peer.publicKey)
        Endpoint = \(peer.endpoint)
        AllowedIPs = \(peer.allowedIPs.joined(separator: ", "))
        """

        if let keepalive = peer.persistentKeepalive {
            config += "\nPersistentKeepalive = \(keepalive)"
        }

        return config
    }
}

/// Manager for WireGuard VPN tunnel via Network Extension
@MainActor
public final class WireGuardManager: ObservableObject {
    // MARK: - Published State

    @Published public private(set) var tunnelState: TunnelState = .inactive
    @Published public private(set) var lastError: String?
    @Published public private(set) var bytesReceived: UInt64 = 0
    @Published public private(set) var bytesSent: UInt64 = 0

    // MARK: - Private Properties

    private var tunnelManager: NETunnelProviderManager?
    private var statusObserver: NSObjectProtocol?

    private static let bundleIdentifier = "com.securemcp.app.network-extension"
    private static let tunnelDescription = "SecureMCP WireGuard"

    // MARK: - Initialization

    public init() {}

    deinit {
        if let observer = statusObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Public API

    /// Load or create tunnel manager
    public func loadTunnelManager() async throws {
        let managers = try await NETunnelProviderManager.loadAllFromPreferences()

        if let existing = managers.first(where: {
            ($0.protocolConfiguration as? NETunnelProviderProtocol)?
                .providerBundleIdentifier == Self.bundleIdentifier
        }) {
            tunnelManager = existing
        } else {
            tunnelManager = NETunnelProviderManager()
        }

        setupStatusObserver()
        updateState()
    }

    /// Configure tunnel with WireGuard config
    public func configure(_ config: WireGuardConfig) async throws {
        guard let manager = tunnelManager else {
            throw WireGuardError.managerNotLoaded
        }

        let proto = NETunnelProviderProtocol()
        proto.providerBundleIdentifier = Self.bundleIdentifier
        proto.serverAddress = config.peer.endpoint
        proto.providerConfiguration = [
            "wgConfig": config.toConfigString()
        ]

        manager.protocolConfiguration = proto
        manager.localizedDescription = Self.tunnelDescription
        manager.isEnabled = true

        try await manager.saveToPreferences()
        try await manager.loadFromPreferences()
    }

    /// Start the VPN tunnel
    public func startTunnel() async throws {
        guard let manager = tunnelManager else {
            throw WireGuardError.managerNotLoaded
        }

        guard manager.isEnabled else {
            throw WireGuardError.tunnelNotConfigured
        }

        do {
            try manager.connection.startVPNTunnel()
        } catch {
            lastError = error.localizedDescription
            throw error
        }
    }

    /// Stop the VPN tunnel
    public func stopTunnel() {
        tunnelManager?.connection.stopVPNTunnel()
    }

    /// Toggle tunnel state
    public func toggleTunnel() async throws {
        switch tunnelState {
        case .active:
            stopTunnel()
        case .inactive:
            try await startTunnel()
        default:
            break
        }
    }

    /// Remove tunnel configuration
    public func removeTunnel() async throws {
        guard let manager = tunnelManager else { return }
        try await manager.removeFromPreferences()
        tunnelManager = nil
        tunnelState = .inactive
    }

    // MARK: - Private Methods

    private func setupStatusObserver() {
        statusObserver = NotificationCenter.default.addObserver(
            forName: .NEVPNStatusDidChange,
            object: tunnelManager?.connection,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                self?.updateState()
            }
        }
    }

    private func updateState() {
        guard let connection = tunnelManager?.connection else {
            tunnelState = .inactive
            return
        }

        switch connection.status {
        case .invalid:
            tunnelState = .invalid
        case .disconnected:
            tunnelState = .inactive
        case .connecting:
            tunnelState = .activating
        case .connected:
            tunnelState = .active
        case .reasserting:
            tunnelState = .reasserting
        case .disconnecting:
            tunnelState = .deactivating
        @unknown default:
            tunnelState = .inactive
        }
    }
}

// MARK: - Errors

public enum WireGuardError: LocalizedError {
    case managerNotLoaded
    case tunnelNotConfigured
    case configurationInvalid(String)

    public var errorDescription: String? {
        switch self {
        case .managerNotLoaded:
            return "Tunnel manager not loaded"
        case .tunnelNotConfigured:
            return "Tunnel not configured"
        case .configurationInvalid(let reason):
            return "Invalid configuration: \(reason)"
        }
    }
}
