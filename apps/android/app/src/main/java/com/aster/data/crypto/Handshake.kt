package com.aster.data.crypto

import android.util.Base64
import android.util.Log
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Cryptographic handshake protocol for secure WebSocket authentication.
 *
 * The handshake flow:
 * 1. Client sends SecureAuthRequest with deviceId, timestamp, and signature
 * 2. Server verifies signature using stored device public key
 * 3. Server responds with SecureAuthResponse (success/pending/rejected)
 * 4. If approved, all subsequent commands are signed by the server
 */

// ============================================================================
// Handshake Messages
// ============================================================================

@Serializable
data class SecureAuthRequest(
    val type: String = "secure_auth",
    val deviceId: String,
    val timestamp: Long,
    val signature: String,
    val publicKey: String, // Device public key for registration
    val deviceInfo: DeviceInfo
)

@Serializable
data class DeviceInfo(
    val name: String,
    val model: String,
    val manufacturer: String,
    val platform: String = "android",
    val osVersion: String,
    val appVersion: String
)

@Serializable
data class SecureAuthResponse(
    val type: String,
    val success: Boolean,
    val status: String, // "pending", "approved", "rejected", "revoked", "error"
    val sessionToken: String? = null,
    val serverPublicKey: String? = null,
    val message: String? = null,
    val retryAfter: Long? = null
)

@Serializable
data class SecureCommand(
    val type: String = "secure_command",
    val id: String,
    val action: String,
    val params: Map<String, kotlinx.serialization.json.JsonElement>? = null,
    val timestamp: Long,
    val signature: String
)

@Serializable
data class SecureCommandResponse(
    val type: String = "secure_command_response",
    val id: String,
    val success: Boolean,
    val data: kotlinx.serialization.json.JsonElement? = null,
    val error: String? = null,
    val timestamp: Long = System.currentTimeMillis(),
    val signature: String
)

// ============================================================================
// Pairing Data (from QR Code)
// ============================================================================

@Serializable
data class PairingData(
    @SerialName("server_url")
    val serverUrl: String,
    @SerialName("server_public_key")
    val serverPublicKey: String,
    @SerialName("registration_token")
    val registrationToken: String,
    @SerialName("server_id")
    val serverId: String? = null,
    @SerialName("fingerprint")
    val fingerprint: String? = null,
    @SerialName("expires_at")
    val expiresAt: Long? = null
)

// ============================================================================
// Handshake Manager
// ============================================================================

@Singleton
class HandshakeManager @Inject constructor(
    private val keyManager: KeyManager
) {
    companion object {
        private const val TAG = "HandshakeManager"
        private const val TIMESTAMP_DRIFT_MS = 30_000L // 30 second tolerance
    }

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        isLenient = true
    }

    @Volatile
    private var serverPublicKey: String? = null

    @Volatile
    private var sessionToken: String? = null

    @Volatile
    private var isAuthenticated = false

    /**
     * Parse QR code data into PairingData.
     * Returns null if the QR code is invalid or expired.
     */
    fun parsePairingQR(qrData: String): PairingData? {
        return try {
            val pairingData = json.decodeFromString<PairingData>(qrData)

            // Check expiration if present
            pairingData.expiresAt?.let { expiresAt ->
                if (System.currentTimeMillis() > expiresAt) {
                    Log.w(TAG, "Pairing QR code has expired")
                    return null
                }
            }

            pairingData
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse pairing QR", e)
            null
        }
    }

    /**
     * Create a secure authentication request.
     *
     * @param deviceId The device identifier
     * @param deviceInfo Device information
     * @return JSON string of the auth request, or null on error
     */
    fun createAuthRequest(
        deviceId: String,
        deviceInfo: DeviceInfo
    ): String? {
        val timestamp = System.currentTimeMillis()

        val signature = keyManager.signAuthPayload(deviceId, timestamp)
            ?: return null

        val publicKey = keyManager.getPublicKeyBase64()
            ?: return null

        val request = SecureAuthRequest(
            deviceId = deviceId,
            timestamp = timestamp,
            signature = signature,
            publicKey = publicKey,
            deviceInfo = deviceInfo
        )

        return json.encodeToString(SecureAuthRequest.serializer(), request)
    }

    /**
     * Handle authentication response from server.
     *
     * @param responseJson JSON string from server
     * @return SecureAuthResponse parsed response
     */
    fun handleAuthResponse(responseJson: String): SecureAuthResponse? {
        return try {
            val response = json.decodeFromString<SecureAuthResponse>(responseJson)

            if (response.success) {
                serverPublicKey = response.serverPublicKey
                sessionToken = response.sessionToken
                isAuthenticated = response.status == "approved"
            }

            response
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse auth response", e)
            null
        }
    }

    /**
     * Verify a signed command from the server.
     *
     * @param commandJson Raw JSON string of the command
     * @return SecureCommand if valid, null if verification fails
     */
    fun verifyCommand(commandJson: String): SecureCommand? {
        return try {
            val command = json.decodeFromString<SecureCommand>(commandJson)

            // Check timestamp freshness
            val now = System.currentTimeMillis()
            if (kotlin.math.abs(now - command.timestamp) > TIMESTAMP_DRIFT_MS) {
                Log.w(TAG, "Command timestamp out of range")
                return null
            }

            // Verify signature if we have the server's public key
            val serverKey = serverPublicKey
            if (serverKey != null) {
                val payload = "${command.id}:${command.action}:${command.timestamp}"
                if (!keyManager.verify(payload.toByteArray(), command.signature, serverKey)) {
                    Log.w(TAG, "Command signature verification failed")
                    return null
                }
            }

            command
        } catch (e: Exception) {
            Log.e(TAG, "Failed to verify command", e)
            null
        }
    }

    /**
     * Create a signed command response.
     *
     * @param id Command ID
     * @param success Whether the command succeeded
     * @param data Response data
     * @param error Error message if failed
     * @return JSON string of the signed response
     */
    fun createCommandResponse(
        id: String,
        success: Boolean,
        data: kotlinx.serialization.json.JsonElement? = null,
        error: String? = null
    ): String? {
        val timestamp = System.currentTimeMillis()
        val payload = "$id:$success:$timestamp"
        val signature = keyManager.sign(payload.toByteArray()) ?: return null

        val response = SecureCommandResponse(
            id = id,
            success = success,
            data = data,
            error = error,
            timestamp = timestamp,
            signature = signature
        )

        return json.encodeToString(SecureCommandResponse.serializer(), response)
    }

    /**
     * Check if the connection is authenticated and approved.
     */
    fun isAuthenticated(): Boolean = isAuthenticated

    /**
     * Get the current session token.
     */
    fun getSessionToken(): String? = sessionToken

    /**
     * Clear authentication state.
     */
    fun clearSession() {
        serverPublicKey = null
        sessionToken = null
        isAuthenticated = false
    }
}
