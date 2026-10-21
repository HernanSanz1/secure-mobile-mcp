import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "gauge")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }

            LogsView(
                logs: appState.commandExecutor.executionLogs,
                onClear: { appState.commandExecutor.clearLogs() }
            )
            .tabItem {
                Label("Logs", systemImage: "doc.text")
            }
        }
    }
}

struct DashboardView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    ConnectionStatusView(
                        state: appState.webSocket.connectionState,
                        deviceStatus: appState.webSocket.deviceStatus
                    )

                    TunnelStatusView(
                        state: appState.vpnManager.tunnelState,
                        onToggle: {
                            Task {
                                try? await appState.vpnManager.toggleTunnel()
                            }
                        }
                    )

                    // Connection buttons
                    HStack(spacing: 12) {
                        Button(action: { appState.connect() }) {
                            Label("Connect", systemImage: "antenna.radiowaves.left.and.right")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isConnected)

                        Button(action: { appState.disconnect() }) {
                            Label("Disconnect", systemImage: "xmark.circle")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .disabled(!isConnected)
                    }
                    .padding(.horizontal)

                    if let error = appState.webSocket.lastError {
                        ErrorBanner(message: error)
                    }

                    CompactLogsView(logs: appState.commandExecutor.executionLogs)
                }
                .padding()
            }
            .navigationTitle("SecureMCP")
            .background(Color(.systemGroupedBackground))
        }
    }

    private var isConnected: Bool {
        switch appState.webSocket.connectionState {
        case .disconnected, .error, .rejected:
            return false
        default:
            return true
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var showVPNConfig = false

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Server Connection")) {
                    TextField("Server URL", text: $appState.serverUrl)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                        .keyboardType(.URL)

                    TextField("Device Name", text: $appState.deviceName)

                    SecureField("Auth Token", text: $appState.authToken)

                    Toggle("Use TLS", isOn: $appState.enableTLS)
                }

                Section(header: Text("VPN")) {
                    Button("Configure WireGuard") {
                        showVPNConfig = true
                    }

                    HStack {
                        Text("Status")
                        Spacer()
                        Text(vpnStatusText)
                            .foregroundColor(.secondary)
                    }
                }

                Section(header: Text("About")) {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(appVersion)
                            .foregroundColor(.secondary)
                    }

                    Link("Documentation", destination: URL(string: "https://github.com/securemcp/ios")!)
                }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showVPNConfig) {
                VPNConfigSheet()
            }
        }
    }

    private var vpnStatusText: String {
        switch appState.vpnManager.tunnelState {
        case .inactive: return "Not configured"
        case .active: return "Active"
        case .activating: return "Connecting..."
        default: return "Unknown"
        }
    }

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }
}

struct VPNConfigSheet: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var appState: AppState

    @State private var privateKey = ""
    @State private var address = ""
    @State private var peerPublicKey = ""
    @State private var endpoint = ""
    @State private var dns = "1.1.1.1, 8.8.8.8"
    @State private var isSaving = false

    var body: some View {
        NavigationView {
            VPNConfigView(
                privateKey: $privateKey,
                address: $address,
                peerPublicKey: $peerPublicKey,
                endpoint: $endpoint,
                dns: $dns,
                onSave: saveConfig,
                isSaving: isSaving
            )
            .navigationBarItems(
                leading: Button("Cancel") { dismiss() }
            )
        }
    }

    private func saveConfig() {
        isSaving = true

        let dnsServers = dns.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }

        let config = WireGuardConfig(
            privateKey: privateKey,
            address: address,
            dns: dnsServers,
            peer: WireGuardConfig.PeerConfig(
                publicKey: peerPublicKey,
                endpoint: endpoint
            )
        )

        Task {
            do {
                try await appState.vpnManager.configure(config)
                await MainActor.run {
                    isSaving = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    isSaving = false
                    // Show error
                }
            }
        }
    }
}

struct ErrorBanner: View {
    let message: String

    var body: some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.orange)

            Text(message)
                .font(.subheadline)

            Spacer()
        }
        .padding()
        .background(Color.orange.opacity(0.1))
        .cornerRadius(8)
    }
}

#if DEBUG
struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(AppState())
    }
}
#endif
