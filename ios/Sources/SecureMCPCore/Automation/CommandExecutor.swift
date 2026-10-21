import Foundation
import Combine

/// Executes MCP commands received from the server
@MainActor
public final class CommandExecutor: ObservableObject {
    // MARK: - Published State

    @Published public private(set) var isExecuting = false
    @Published public private(set) var lastCommand: String?
    @Published public private(set) var executionLogs: [LogEntry] = []

    // MARK: - Types

    public struct LogEntry: Identifiable, Sendable {
        public let id = UUID()
        public let timestamp: Date
        public let command: String
        public let success: Bool
        public let message: String

        public init(command: String, success: Bool, message: String) {
            self.timestamp = Date()
            self.command = command
            self.success = success
            self.message = message
        }
    }

    // MARK: - Private Properties

    private var cancellables = Set<AnyCancellable>()
    private let maxLogs = 100

    // MARK: - Initialization

    public init() {}

    // MARK: - Public API

    /// Execute a command and return response
    public func execute(_ command: Command) async -> CommandResponse {
        isExecuting = true
        lastCommand = command.action
        defer { isExecuting = false }

        do {
            let result = try await executeAction(command.action, params: command.params)
            let log = LogEntry(command: command.action, success: true, message: "OK")
            appendLog(log)
            return CommandResponse(id: command.id, success: true, data: result)
        } catch {
            let log = LogEntry(command: command.action, success: false, message: error.localizedDescription)
            appendLog(log)
            return CommandResponse(id: command.id, success: false, error: error.localizedDescription)
        }
    }

    /// Clear execution logs
    public func clearLogs() {
        executionLogs.removeAll()
    }

    // MARK: - Private Methods

    private func appendLog(_ log: LogEntry) {
        executionLogs.insert(log, at: 0)
        if executionLogs.count > maxLogs {
            executionLogs.removeLast()
        }
    }

    private func executeAction(_ action: String, params: [String: AnyCodable]?) async throws -> AnyCodable? {
        // iOS sandbox restrictions limit what commands can do
        // These are the safe operations we can perform

        switch action {
        case "ping":
            return AnyCodable(["pong": true, "timestamp": Date().timeIntervalSince1970])

        case "device_info":
            return try await getDeviceInfo()

        case "battery_status":
            return try await getBatteryStatus()

        case "network_info":
            return try await getNetworkInfo()

        case "app_list":
            // iOS doesn't allow listing installed apps
            throw CommandError.notSupported("App listing not available on iOS")

        case "screenshot":
            // Screenshots require UIKit and user interaction
            throw CommandError.notSupported("Screenshots require app to be in foreground")

        case "notification":
            return try await showNotification(params)

        case "clipboard_read":
            return try await readClipboard()

        case "clipboard_write":
            return try await writeClipboard(params)

        case "open_url":
            return try await openURL(params)

        case "haptic":
            return try await triggerHaptic(params)

        default:
            throw CommandError.unknownAction(action)
        }
    }

    // MARK: - Command Implementations

    private func getDeviceInfo() async throws -> AnyCodable {
        #if canImport(UIKit)
        await MainActor.run {
            let device = UIDevice.current
            return AnyCodable([
                "name": device.name,
                "model": device.model,
                "systemName": device.systemName,
                "systemVersion": device.systemVersion,
                "identifierForVendor": device.identifierForVendor?.uuidString ?? "unknown"
            ])
        }
        #else
        return AnyCodable(["platform": "iOS"])
        #endif
    }

    private func getBatteryStatus() async throws -> AnyCodable {
        #if canImport(UIKit)
        await MainActor.run {
            let device = UIDevice.current
            device.isBatteryMonitoringEnabled = true
            return AnyCodable([
                "level": device.batteryLevel,
                "state": batteryStateString(device.batteryState)
            ])
        }
        #else
        throw CommandError.notSupported("Battery status not available")
        #endif
    }

    #if canImport(UIKit)
    private func batteryStateString(_ state: UIDevice.BatteryState) -> String {
        switch state {
        case .unknown: return "unknown"
        case .unplugged: return "unplugged"
        case .charging: return "charging"
        case .full: return "full"
        @unknown default: return "unknown"
        }
    }
    #endif

    private func getNetworkInfo() async throws -> AnyCodable {
        // Basic network reachability
        // Full implementation would use NWPathMonitor
        return AnyCodable([
            "available": true,
            "type": "unknown"
        ])
    }

    private func showNotification(_ params: [String: AnyCodable]?) async throws -> AnyCodable {
        guard let params = params,
              let title = params["title"]?.value as? String else {
            throw CommandError.missingParameter("title")
        }

        let body = params["body"]?.value as? String ?? ""

        // Would use UNUserNotificationCenter here
        // Requires notification permission
        return AnyCodable(["scheduled": true, "title": title, "body": body])
    }

    private func readClipboard() async throws -> AnyCodable {
        #if canImport(UIKit)
        await MainActor.run {
            let pasteboard = UIPasteboard.general
            return AnyCodable(["content": pasteboard.string ?? ""])
        }
        #else
        throw CommandError.notSupported("Clipboard not available")
        #endif
    }

    private func writeClipboard(_ params: [String: AnyCodable]?) async throws -> AnyCodable {
        guard let params = params,
              let content = params["content"]?.value as? String else {
            throw CommandError.missingParameter("content")
        }

        #if canImport(UIKit)
        await MainActor.run {
            UIPasteboard.general.string = content
        }
        return AnyCodable(["written": true])
        #else
        throw CommandError.notSupported("Clipboard not available")
        #endif
    }

    private func openURL(_ params: [String: AnyCodable]?) async throws -> AnyCodable {
        guard let params = params,
              let urlString = params["url"]?.value as? String,
              let url = URL(string: urlString) else {
            throw CommandError.missingParameter("url")
        }

        #if canImport(UIKit)
        let opened = await UIApplication.shared.open(url)
        return AnyCodable(["opened": opened, "url": urlString])
        #else
        throw CommandError.notSupported("URL opening not available")
        #endif
    }

    private func triggerHaptic(_ params: [String: AnyCodable]?) async throws -> AnyCodable {
        #if canImport(UIKit)
        let style = params?["style"]?.value as? String ?? "medium"

        await MainActor.run {
            let generator: UIImpactFeedbackGenerator
            switch style {
            case "light":
                generator = UIImpactFeedbackGenerator(style: .light)
            case "heavy":
                generator = UIImpactFeedbackGenerator(style: .heavy)
            default:
                generator = UIImpactFeedbackGenerator(style: .medium)
            }
            generator.impactOccurred()
        }
        return AnyCodable(["triggered": true, "style": style])
        #else
        throw CommandError.notSupported("Haptics not available")
        #endif
    }
}

// MARK: - Errors

public enum CommandError: LocalizedError {
    case unknownAction(String)
    case notSupported(String)
    case missingParameter(String)
    case executionFailed(String)

    public var errorDescription: String? {
        switch self {
        case .unknownAction(let action):
            return "Unknown action: \(action)"
        case .notSupported(let reason):
            return "Not supported: \(reason)"
        case .missingParameter(let param):
            return "Missing parameter: \(param)"
        case .executionFailed(let reason):
            return "Execution failed: \(reason)"
        }
    }
}
