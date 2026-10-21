import Foundation
import Combine

/// Reconnection policy constants
public enum ReconnectPolicy {
    public static let heartbeatIntervalMs: Int64 = 30_000
    public static let reconnectBaseDelayMs: Int64 = 2_000
    public static let reconnectMaxDelayMs: Int64 = 30_000

    public static func reconnectDelay(attempts: Int) -> TimeInterval {
        let shift = min(max(attempts, 0), 16)
        let exponentialDelay = reconnectBaseDelayMs * Int64(1 << shift)
        let cappedDelay = min(exponentialDelay, reconnectMaxDelayMs)
        return TimeInterval(cappedDelay) / 1000.0
    }

    public static func ackTimedOut(lastAckAt: Date?, now: Date = Date()) -> Bool {
        guard let lastAck = lastAckAt else { return false }
        let intervalSec = TimeInterval(heartbeatIntervalMs) / 1000.0
        return now.timeIntervalSince(lastAck) > 2 * intervalSec
    }
}

/// WebSocket client for MCP server communication
@MainActor
public final class MCPWebSocketClient: NSObject, ObservableObject {
    // MARK: - Published State

    @Published public private(set) var connectionState: ConnectionState = .disconnected
    @Published public private(set) var deviceStatus: DeviceStatus = .pending
    @Published public private(set) var lastError: String?

    // MARK: - Publishers

    public let commandReceived = PassthroughSubject<Command, Never>()
    public let eventSent = PassthroughSubject<EventMessage, Never>()

    // MARK: - Private Properties

    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession!
    private var config: ServerConfig?
    private var deviceInfo: DeviceInfo?

    private var heartbeatTask: Task<Void, Never>?
    private var receiveTask: Task<Void, Never>?
    private var reconnectAttempts = 0
    private var lastAckAt: Date?
    private var generation = 0

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    // MARK: - Initialization

    public override init() {
        super.init()
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        self.urlSession = URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }

    // MARK: - Public API

    public func connect(config: ServerConfig, deviceInfo: DeviceInfo) {
        self.config = config
        self.deviceInfo = deviceInfo
        self.reconnectAttempts = 0
        doConnect()
    }

    public func disconnect() {
        generation += 1
        heartbeatTask?.cancel()
        receiveTask?.cancel()
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        connectionState = .disconnected
    }

    public func sendResponse(_ response: CommandResponse) {
        send(response)
    }

    public func sendEvent(_ event: EventMessage) {
        send(event)
        eventSent.send(event)
    }

    // MARK: - Private Methods

    private func doConnect() {
        guard let config = config else { return }

        generation += 1
        connectionState = reconnectAttempts > 0 ? .reconnecting : .connecting
        lastError = nil

        guard let url = URL(string: config.wsUrl) else {
            lastError = "Invalid server URL"
            connectionState = .error
            return
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 30

        if let token = config.authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        webSocketTask = urlSession.webSocketTask(with: request)
        webSocketTask?.resume()
    }

    private func scheduleReconnect() {
        let delay = ReconnectPolicy.reconnectDelay(attempts: reconnectAttempts)
        reconnectAttempts += 1

        Task {
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            if connectionState == .disconnected || connectionState == .error {
                doConnect()
            }
        }
    }

    private func startReceiving() {
        let currentGen = generation
        receiveTask = Task {
            while !Task.isCancelled && generation == currentGen {
                do {
                    guard let task = webSocketTask else { break }
                    let message = try await task.receive()
                    await handleMessage(message)
                } catch {
                    if generation == currentGen {
                        await handleDisconnect(error: error)
                    }
                    break
                }
            }
        }
    }

    private func startHeartbeat() {
        let currentGen = generation
        heartbeatTask = Task {
            while !Task.isCancelled && generation == currentGen {
                try? await Task.sleep(nanoseconds: UInt64(ReconnectPolicy.heartbeatIntervalMs) * 1_000_000)
                if Task.isCancelled || generation != currentGen { break }

                if ReconnectPolicy.ackTimedOut(lastAckAt: lastAckAt) {
                    await handleDisconnect(error: nil)
                    break
                }

                send(HeartbeatMessage())
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) async {
        guard case .string(let text) = message else { return }
        guard let data = text.data(using: .utf8) else { return }

        do {
            let incoming = try decoder.decode(IncomingMessage.self, from: data)

            switch incoming.type {
            case "auth_result":
                let result = try decoder.decode(AuthResult.self, from: data)
                handleAuthResult(result)

            case "command":
                let command = try decoder.decode(Command.self, from: data)
                commandReceived.send(command)

            case "heartbeat_ack":
                lastAckAt = Date()

            default:
                break
            }
        } catch {
            lastError = "Parse error: \(error.localizedDescription)"
        }
    }

    private func handleAuthResult(_ result: AuthResult) {
        if result.success {
            switch result.status {
            case "approved":
                deviceStatus = .approved
                connectionState = .approved
                reconnectAttempts = 0
            case "pending":
                deviceStatus = .pending
                connectionState = .pendingApproval
            case "rejected":
                deviceStatus = .rejected
                connectionState = .rejected
            default:
                break
            }
        } else {
            lastError = result.message
            connectionState = .error
        }
    }

    private func handleDisconnect(error: Error?) {
        heartbeatTask?.cancel()
        receiveTask?.cancel()
        webSocketTask = nil

        if let error = error {
            lastError = error.localizedDescription
        }

        connectionState = .disconnected
        scheduleReconnect()
    }

    private func send<T: Encodable>(_ message: T) {
        guard let data = try? encoder.encode(message),
              let string = String(data: data, encoding: .utf8) else { return }

        webSocketTask?.send(.string(string)) { [weak self] error in
            if let error = error {
                Task { @MainActor in
                    self?.lastError = error.localizedDescription
                }
            }
        }
    }

    private func sendAuth() {
        guard let deviceInfo = deviceInfo, let config = config else { return }

        let auth = AuthMessage(
            deviceId: deviceInfo.deviceId,
            deviceName: config.deviceName,
            model: deviceInfo.model,
            osVersion: deviceInfo.osVersion,
            appVersion: deviceInfo.appVersion
        )
        send(auth)
    }
}

// MARK: - URLSessionWebSocketDelegate

extension MCPWebSocketClient: URLSessionWebSocketDelegate {
    nonisolated public func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        Task { @MainActor in
            connectionState = .connected
            lastAckAt = Date()
            sendAuth()
            startReceiving()
            startHeartbeat()
        }
    }

    nonisolated public func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        Task { @MainActor in
            handleDisconnect(error: nil)
        }
    }
}

// MARK: - Device Info

public struct DeviceInfo: Sendable {
    public let deviceId: String
    public let model: String
    public let osVersion: String
    public let appVersion: String

    public init(deviceId: String, model: String, osVersion: String, appVersion: String) {
        self.deviceId = deviceId
        self.model = model
        self.osVersion = osVersion
        self.appVersion = appVersion
    }

    #if canImport(UIKit)
    public static func current(appVersion: String = "1.0.0") -> DeviceInfo {
        import UIKit
        let device = UIDevice.current
        let deviceId = device.identifierForVendor?.uuidString ?? UUID().uuidString
        return DeviceInfo(
            deviceId: deviceId,
            model: device.model,
            osVersion: device.systemVersion,
            appVersion: appVersion
        )
    }
    #endif
}
