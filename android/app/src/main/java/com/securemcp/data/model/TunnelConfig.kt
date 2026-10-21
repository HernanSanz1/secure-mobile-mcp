package com.securemcp.data.model

import kotlinx.serialization.Serializable

@Serializable
data class TunnelConfig(
    val serverUrl: String,
    val privateKey: String,
    val publicKey: String,
    val address: String,
    val dns: String = "1.1.1.1",
    val endpoint: String,
    val allowedIps: String = "0.0.0.0/0",
    val persistentKeepalive: Int = 25
)

@Serializable
data class McpCommand(
    val id: String,
    val type: CommandType,
    val payload: String,
    val timestamp: Long = System.currentTimeMillis()
)

@Serializable
enum class CommandType {
    SHELL,
    UI_ACTION,
    SCREENSHOT,
    FILE_OPERATION,
    PACKAGE_OPERATION,
    CUSTOM
}

@Serializable
data class CommandResult(
    val commandId: String,
    val success: Boolean,
    val output: String? = null,
    val error: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)

sealed class TunnelState {
    data object Disconnected : TunnelState()
    data object Connecting : TunnelState()
    data class Connected(val stats: TunnelStats? = null) : TunnelState()
    data class Error(val message: String) : TunnelState()
}

data class TunnelStats(
    val rxBytes: Long = 0,
    val txBytes: Long = 0,
    val lastHandshake: Long = 0
)

@Serializable
data class ServerConfig(
    val host: String,
    val port: Int = 443,
    val token: String? = null,
    val autoConnect: Boolean = false
)
