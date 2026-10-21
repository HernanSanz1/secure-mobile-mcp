import SwiftUI

/// View showing current connection status
public struct ConnectionStatusView: View {
    let state: ConnectionState
    let deviceStatus: DeviceStatus

    public init(state: ConnectionState, deviceStatus: DeviceStatus) {
        self.state = state
        self.deviceStatus = deviceStatus
    }

    public var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(statusColor)
                .frame(width: 12, height: 12)
                .overlay(
                    Circle()
                        .stroke(statusColor.opacity(0.3), lineWidth: 4)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(statusTitle)
                    .font(.headline)

                Text(statusSubtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
    }

    private var statusColor: Color {
        switch state {
        case .disconnected, .error:
            return .red
        case .connecting, .reconnecting:
            return .orange
        case .connected, .pendingApproval:
            return .yellow
        case .approved:
            return .green
        case .rejected:
            return .red
        }
    }

    private var statusTitle: String {
        switch state {
        case .disconnected:
            return "Disconnected"
        case .connecting:
            return "Connecting..."
        case .reconnecting:
            return "Reconnecting..."
        case .connected:
            return "Connected"
        case .pendingApproval:
            return "Pending Approval"
        case .approved:
            return "Approved"
        case .rejected:
            return "Rejected"
        case .error:
            return "Error"
        }
    }

    private var statusSubtitle: String {
        switch state {
        case .disconnected:
            return "Not connected to server"
        case .connecting, .reconnecting:
            return "Establishing connection..."
        case .connected:
            return "Awaiting device approval"
        case .pendingApproval:
            return "Waiting for server approval"
        case .approved:
            return "Ready to receive commands"
        case .rejected:
            return "Connection rejected by server"
        case .error:
            return "Connection error occurred"
        }
    }
}

/// View showing VPN tunnel status
public struct TunnelStatusView: View {
    let state: TunnelState
    let onToggle: () -> Void

    public init(state: TunnelState, onToggle: @escaping () -> Void) {
        self.state = state
        self.onToggle = onToggle
    }

    public var body: some View {
        HStack(spacing: 12) {
            Image(systemName: tunnelIcon)
                .font(.title2)
                .foregroundColor(tunnelColor)
                .frame(width: 40)

            VStack(alignment: .leading, spacing: 2) {
                Text("VPN Tunnel")
                    .font(.headline)

                Text(tunnelStatusText)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button(action: onToggle) {
                Text(buttonText)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(buttonColor)
                    .cornerRadius(8)
            }
            .disabled(isTransitioning)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
    }

    private var tunnelIcon: String {
        switch state {
        case .inactive, .invalid:
            return "shield.slash"
        case .activating, .deactivating, .reasserting:
            return "shield"
        case .active:
            return "shield.checkered"
        }
    }

    private var tunnelColor: Color {
        switch state {
        case .inactive, .invalid:
            return .gray
        case .activating, .deactivating, .reasserting:
            return .orange
        case .active:
            return .green
        }
    }

    private var tunnelStatusText: String {
        switch state {
        case .inactive:
            return "Tunnel is inactive"
        case .activating:
            return "Activating tunnel..."
        case .active:
            return "Tunnel is active"
        case .deactivating:
            return "Deactivating tunnel..."
        case .reasserting:
            return "Reconnecting..."
        case .invalid:
            return "Configuration invalid"
        }
    }

    private var buttonText: String {
        switch state {
        case .active:
            return "Stop"
        case .inactive, .invalid:
            return "Start"
        default:
            return "..."
        }
    }

    private var buttonColor: Color {
        switch state {
        case .active:
            return .red
        default:
            return .blue
        }
    }

    private var isTransitioning: Bool {
        switch state {
        case .activating, .deactivating, .reasserting:
            return true
        default:
            return false
        }
    }
}

// MARK: - Previews

#if DEBUG
struct ConnectionStatusView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            ConnectionStatusView(state: .disconnected, deviceStatus: .pending)
            ConnectionStatusView(state: .connecting, deviceStatus: .pending)
            ConnectionStatusView(state: .approved, deviceStatus: .approved)
            ConnectionStatusView(state: .error, deviceStatus: .rejected)
        }
        .padding()
        .background(Color(.systemGroupedBackground))
    }
}

struct TunnelStatusView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            TunnelStatusView(state: .inactive, onToggle: {})
            TunnelStatusView(state: .activating, onToggle: {})
            TunnelStatusView(state: .active, onToggle: {})
        }
        .padding()
        .background(Color(.systemGroupedBackground))
    }
}
#endif
