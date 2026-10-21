import SwiftUI

@main
struct SecureMCPApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
        }
    }
}

/// Main app state container
@MainActor
final class AppState: ObservableObject {
    @Published var webSocket = MCPWebSocketClient()
    @Published var vpnManager = WireGuardManager()
    @Published var commandExecutor = CommandExecutor()

    // Config storage
    @AppStorage("serverUrl") var serverUrl = ""
    @AppStorage("deviceName") var deviceName = ""
    @AppStorage("authToken") var authToken = ""
    @AppStorage("enableTLS") var enableTLS = true

    init() {
        setupCommandHandling()
        setupIntentHandling()

        Task {
            try? await vpnManager.loadTunnelManager()
        }
    }

    private func setupCommandHandling() {
        webSocket.commandReceived
            .receive(on: DispatchQueue.main)
            .sink { [weak self] command in
                Task { @MainActor in
                    guard let self = self else { return }
                    let response = await self.commandExecutor.execute(command)
                    self.webSocket.sendResponse(response)
                }
            }
            .store(in: &cancellables)
    }

    private func setupIntentHandling() {
        // Handle Shortcuts/Intents
        NotificationCenter.default.addObserver(
            forName: .mcpConnectRequested,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.connect()
        }

        NotificationCenter.default.addObserver(
            forName: .mcpDisconnectRequested,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.disconnect()
        }

        NotificationCenter.default.addObserver(
            forName: .vpnToggleRequested,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in
                try? await self?.vpnManager.toggleTunnel()
            }
        }
    }

    func connect() {
        let config = ServerConfig(
            serverUrl: serverUrl,
            authToken: authToken.isEmpty ? nil : authToken,
            deviceName: deviceName,
            enableTLS: enableTLS
        )

        let deviceInfo = DeviceInfo(
            deviceId: getDeviceId(),
            model: getDeviceModel(),
            osVersion: UIDevice.current.systemVersion,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        )

        webSocket.connect(config: config, deviceInfo: deviceInfo)
    }

    func disconnect() {
        webSocket.disconnect()
    }

    private func getDeviceId() -> String {
        UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
    }

    private func getDeviceModel() -> String {
        var systemInfo = utsname()
        uname(&systemInfo)
        let machineMirror = Mirror(reflecting: systemInfo.machine)
        return machineMirror.children.reduce("") { identifier, element in
            guard let value = element.value as? Int8, value != 0 else { return identifier }
            return identifier + String(UnicodeScalar(UInt8(value)))
        }
    }

    private var cancellables = Set<AnyCancellable>()
}

// Need Combine import
import Combine
