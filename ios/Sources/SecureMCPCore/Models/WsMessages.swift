import Foundation

// MARK: - Client -> Server Messages

/// Authentication message sent on connection
public struct AuthMessage: Codable, Sendable {
    public let type: String
    public let deviceId: String
    public let deviceName: String
    public let model: String
    public let manufacturer: String
    public let platform: String
    public let osVersion: String
    public let appVersion: String

    public init(
        deviceId: String,
        deviceName: String,
        model: String,
        osVersion: String,
        appVersion: String
    ) {
        self.type = "auth"
        self.deviceId = deviceId
        self.deviceName = deviceName
        self.model = model
        self.manufacturer = "Apple"
        self.platform = "ios"
        self.osVersion = osVersion
        self.appVersion = appVersion
    }
}

/// Response to a command from the server
public struct CommandResponse: Codable, Sendable {
    public let type: String
    public let id: String
    public let success: Bool
    public let data: AnyCodable?
    public let error: String?

    public init(id: String, success: Bool, data: AnyCodable? = nil, error: String? = nil) {
        self.type = "command_response"
        self.id = id
        self.success = success
        self.data = data
        self.error = error
    }
}

/// Event notification sent to server
public struct EventMessage: Codable, Sendable {
    public let type: String
    public let eventType: String
    public let data: [String: AnyCodable]
    public let timestamp: Int64

    public init(eventType: String, data: [String: AnyCodable]) {
        self.type = "event"
        self.eventType = eventType
        self.data = data
        self.timestamp = Int64(Date().timeIntervalSince1970 * 1000)
    }
}

/// Heartbeat to keep connection alive
public struct HeartbeatMessage: Codable, Sendable {
    public let type: String
    public let timestamp: Int64

    public init() {
        self.type = "heartbeat"
        self.timestamp = Int64(Date().timeIntervalSince1970 * 1000)
    }
}

// MARK: - Server -> Client Messages

/// Authentication result from server
public struct AuthResult: Codable, Sendable {
    public let type: String
    public let success: Bool
    public let status: String
    public let message: String?
}

/// Command from server to execute
public struct Command: Codable, Sendable {
    public let type: String
    public let id: String
    public let action: String
    public let params: [String: AnyCodable]?
}

/// Heartbeat acknowledgment from server
public struct HeartbeatAck: Codable, Sendable {
    public let type: String
    public let timestamp: Int64
}

/// Generic incoming message for type detection
public struct IncomingMessage: Codable, Sendable {
    public let type: String
}

// MARK: - AnyCodable Helper

/// Type-erased Codable wrapper for dynamic JSON values
public struct AnyCodable: Codable, Sendable {
    public let value: Any

    public init(_ value: Any) {
        self.value = value
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self.value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            self.value = bool
        } else if let int = try? container.decode(Int.self) {
            self.value = int
        } else if let double = try? container.decode(Double.self) {
            self.value = double
        } else if let string = try? container.decode(String.self) {
            self.value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            self.value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            self.value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unable to decode value")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case is NSNull:
            try container.encodeNil()
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [Any]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: Any]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: [], debugDescription: "Unable to encode value"))
        }
    }
}
