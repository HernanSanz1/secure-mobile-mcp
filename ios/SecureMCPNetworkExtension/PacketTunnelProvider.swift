import NetworkExtension
import WireGuardKit

/// Network Extension packet tunnel provider for WireGuard
class PacketTunnelProvider: NEPacketTunnelProvider {

    // MARK: - Properties

    private var adapter: WireGuardAdapter?
    private var pendingStartCompletion: ((Error?) -> Void)?

    // MARK: - Lifecycle

    override func startTunnel(
        options: [String: NSObject]?,
        completionHandler: @escaping (Error?) -> Void
    ) {
        pendingStartCompletion = completionHandler

        guard let protocolConfig = protocolConfiguration as? NETunnelProviderProtocol,
              let providerConfig = protocolConfig.providerConfiguration,
              let wgConfigString = providerConfig["wgConfig"] as? String else {
            completionHandler(PacketTunnelError.invalidConfiguration)
            return
        }

        // Parse WireGuard config
        guard let tunnelConfig = try? TunnelConfiguration(fromWgQuickConfig: wgConfigString) else {
            completionHandler(PacketTunnelError.invalidConfiguration)
            return
        }

        // Create adapter
        adapter = WireGuardAdapter(with: self) { [weak self] logLevel, message in
            self?.log(logLevel, message)
        }

        // Start WireGuard
        adapter?.start(tunnelConfiguration: tunnelConfig) { [weak self] error in
            if let error = error {
                self?.pendingStartCompletion?(PacketTunnelError.wireguardError(error))
            } else {
                self?.pendingStartCompletion?(nil)
            }
            self?.pendingStartCompletion = nil
        }
    }

    override func stopTunnel(
        with reason: NEProviderStopReason,
        completionHandler: @escaping () -> Void
    ) {
        adapter?.stop { error in
            if let error = error {
                NSLog("WireGuard stop error: \(error)")
            }
            completionHandler()
        }
    }

    override func handleAppMessage(_ messageData: Data, completionHandler: ((Data?) -> Void)?) {
        // Handle messages from the app
        // Could be used for status queries, config updates, etc.

        if let command = String(data: messageData, encoding: .utf8) {
            switch command {
            case "status":
                let status = adapter != nil ? "active" : "inactive"
                completionHandler?(status.data(using: .utf8))

            case "stats":
                // Return traffic stats if available
                completionHandler?(nil)

            default:
                completionHandler?(nil)
            }
        } else {
            completionHandler?(nil)
        }
    }

    // MARK: - Logging

    private func log(_ level: WireGuardLogLevel, _ message: String) {
        #if DEBUG
        NSLog("[WireGuard \(level)] \(message)")
        #endif
    }
}

// MARK: - Errors

enum PacketTunnelError: LocalizedError {
    case invalidConfiguration
    case wireguardError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidConfiguration:
            return "Invalid tunnel configuration"
        case .wireguardError(let error):
            return "WireGuard error: \(error.localizedDescription)"
        }
    }
}
