import SwiftUI

/// View for configuring server connection
public struct ServerConfigView: View {
    @Binding var serverUrl: String
    @Binding var authToken: String
    @Binding var deviceName: String
    @Binding var enableTLS: Bool

    let onConnect: () -> Void
    let isConnecting: Bool

    public init(
        serverUrl: Binding<String>,
        authToken: Binding<String>,
        deviceName: Binding<String>,
        enableTLS: Binding<Bool>,
        onConnect: @escaping () -> Void,
        isConnecting: Bool
    ) {
        self._serverUrl = serverUrl
        self._authToken = authToken
        self._deviceName = deviceName
        self._enableTLS = enableTLS
        self.onConnect = onConnect
        self.isConnecting = isConnecting
    }

    public var body: some View {
        Form {
            Section(header: Text("Server")) {
                TextField("Server URL", text: $serverUrl)
                    .textContentType(.URL)
                    .autocapitalization(.none)
                    .disableAutocorrection(true)
                    .keyboardType(.URL)

                SecureField("Auth Token (optional)", text: $authToken)
                    .textContentType(.password)

                Toggle("Use TLS", isOn: $enableTLS)
            }

            Section(header: Text("Device")) {
                TextField("Device Name", text: $deviceName)
                    .textContentType(.name)
            }

            Section {
                Button(action: onConnect) {
                    HStack {
                        Spacer()
                        if isConnecting {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle())
                                .padding(.trailing, 8)
                        }
                        Text(isConnecting ? "Connecting..." : "Connect")
                            .fontWeight(.semibold)
                        Spacer()
                    }
                }
                .disabled(serverUrl.isEmpty || deviceName.isEmpty || isConnecting)
            }
        }
        .navigationTitle("Server Configuration")
    }
}

/// View for configuring WireGuard VPN
public struct VPNConfigView: View {
    @Binding var privateKey: String
    @Binding var address: String
    @Binding var peerPublicKey: String
    @Binding var endpoint: String
    @Binding var dns: String

    let onSave: () -> Void
    let isSaving: Bool

    public init(
        privateKey: Binding<String>,
        address: Binding<String>,
        peerPublicKey: Binding<String>,
        endpoint: Binding<String>,
        dns: Binding<String>,
        onSave: @escaping () -> Void,
        isSaving: Bool
    ) {
        self._privateKey = privateKey
        self._address = address
        self._peerPublicKey = peerPublicKey
        self._endpoint = endpoint
        self._dns = dns
        self.onSave = onSave
        self.isSaving = isSaving
    }

    public var body: some View {
        Form {
            Section(header: Text("Interface")) {
                SecureField("Private Key", text: $privateKey)
                    .font(.system(.body, design: .monospaced))

                TextField("Address (e.g., 10.0.0.2/24)", text: $address)
                    .font(.system(.body, design: .monospaced))
                    .autocapitalization(.none)
                    .disableAutocorrection(true)

                TextField("DNS Servers", text: $dns)
                    .font(.system(.body, design: .monospaced))
                    .autocapitalization(.none)
                    .disableAutocorrection(true)
            }

            Section(header: Text("Peer")) {
                TextField("Public Key", text: $peerPublicKey)
                    .font(.system(.body, design: .monospaced))
                    .autocapitalization(.none)
                    .disableAutocorrection(true)

                TextField("Endpoint (host:port)", text: $endpoint)
                    .font(.system(.body, design: .monospaced))
                    .autocapitalization(.none)
                    .disableAutocorrection(true)
                    .keyboardType(.URL)
            }

            Section(footer: Text("Configuration will be saved to the system VPN settings.")) {
                Button(action: onSave) {
                    HStack {
                        Spacer()
                        if isSaving {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle())
                                .padding(.trailing, 8)
                        }
                        Text(isSaving ? "Saving..." : "Save Configuration")
                            .fontWeight(.semibold)
                        Spacer()
                    }
                }
                .disabled(!isValid || isSaving)
            }
        }
        .navigationTitle("VPN Configuration")
    }

    private var isValid: Bool {
        !privateKey.isEmpty &&
        !address.isEmpty &&
        !peerPublicKey.isEmpty &&
        !endpoint.isEmpty
    }
}

// MARK: - QR Code Scanner (Placeholder)

/// View for scanning QR codes to import config
public struct QRScannerView: View {
    let onScanned: (String) -> Void
    let onCancel: () -> Void

    public init(onScanned: @escaping (String) -> Void, onCancel: @escaping () -> Void) {
        self.onScanned = onScanned
        self.onCancel = onCancel
    }

    public var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "qrcode.viewfinder")
                .font(.system(size: 100))
                .foregroundColor(.secondary)

            Text("QR Code Scanner")
                .font(.title2)

            Text("Point your camera at a SecureMCP configuration QR code")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            // Actual camera implementation would go here
            // Using AVCaptureSession + Vision framework

            Button("Cancel", action: onCancel)
                .padding(.top, 40)
        }
        .padding()
    }
}

// MARK: - Previews

#if DEBUG
struct ServerConfigView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            ServerConfigView(
                serverUrl: .constant("wss://mcp.example.com"),
                authToken: .constant(""),
                deviceName: .constant("My iPhone"),
                enableTLS: .constant(true),
                onConnect: {},
                isConnecting: false
            )
        }
    }
}

struct VPNConfigView_Previews: PreviewProvider {
    static var previews: some View {
        NavigationView {
            VPNConfigView(
                privateKey: .constant(""),
                address: .constant("10.0.0.2/24"),
                peerPublicKey: .constant(""),
                endpoint: .constant("vpn.example.com:51820"),
                dns: .constant("1.1.1.1, 8.8.8.8"),
                onSave: {},
                isSaving: false
            )
        }
    }
}
#endif
