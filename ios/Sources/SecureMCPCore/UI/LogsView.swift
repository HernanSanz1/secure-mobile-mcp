import SwiftUI

/// View displaying command execution logs
public struct LogsView: View {
    let logs: [CommandExecutor.LogEntry]
    let onClear: () -> Void

    public init(logs: [CommandExecutor.LogEntry], onClear: @escaping () -> Void) {
        self.logs = logs
        self.onClear = onClear
    }

    public var body: some View {
        VStack(spacing: 0) {
            if logs.isEmpty {
                emptyState
            } else {
                logList
            }
        }
        .navigationTitle("Command Logs")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Clear", action: onClear)
                    .disabled(logs.isEmpty)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 60))
                .foregroundColor(.secondary)

            Text("No Commands Yet")
                .font(.title2)

            Text("Commands received from the server will appear here")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding()
    }

    private var logList: some View {
        List {
            ForEach(logs) { log in
                LogEntryRow(entry: log)
            }
        }
        .listStyle(.plain)
    }
}

/// Single log entry row
public struct LogEntryRow: View {
    let entry: CommandExecutor.LogEntry

    private var timeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .medium
        return formatter
    }

    public var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: entry.success ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundColor(entry.success ? .green : .red)
                .font(.title3)

            VStack(alignment: .leading, spacing: 4) {
                Text(entry.command)
                    .font(.headline)
                    .fontWeight(.medium)

                Text(entry.message)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)

                Text(timeFormatter.string(from: entry.timestamp))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
        .padding(.vertical, 8)
    }
}

/// Compact log view for dashboard
public struct CompactLogsView: View {
    let logs: [CommandExecutor.LogEntry]
    let maxItems: Int

    public init(logs: [CommandExecutor.LogEntry], maxItems: Int = 5) {
        self.logs = logs
        self.maxItems = maxItems
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Recent Commands")
                    .font(.headline)
                Spacer()
                Text("\(logs.count) total")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if logs.isEmpty {
                Text("No commands executed")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.vertical, 8)
            } else {
                ForEach(logs.prefix(maxItems)) { log in
                    HStack(spacing: 8) {
                        Circle()
                            .fill(log.success ? Color.green : Color.red)
                            .frame(width: 8, height: 8)

                        Text(log.command)
                            .font(.system(.caption, design: .monospaced))
                            .lineLimit(1)

                        Spacer()

                        Text(relativeTime(log.timestamp))
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
    }

    private func relativeTime(_ date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        if interval < 60 {
            return "just now"
        } else if interval < 3600 {
            let mins = Int(interval / 60)
            return "\(mins)m ago"
        } else {
            let hours = Int(interval / 3600)
            return "\(hours)h ago"
        }
    }
}

// MARK: - Previews

#if DEBUG
struct LogsView_Previews: PreviewProvider {
    static let sampleLogs: [CommandExecutor.LogEntry] = [
        CommandExecutor.LogEntry(command: "device_info", success: true, message: "OK"),
        CommandExecutor.LogEntry(command: "screenshot", success: false, message: "Not supported on iOS"),
        CommandExecutor.LogEntry(command: "ping", success: true, message: "OK"),
    ]

    static var previews: some View {
        NavigationView {
            LogsView(logs: sampleLogs, onClear: {})
        }
    }
}

struct CompactLogsView_Previews: PreviewProvider {
    static var previews: some View {
        CompactLogsView(logs: LogsView_Previews.sampleLogs)
            .padding()
            .background(Color(.systemGroupedBackground))
    }
}
#endif
