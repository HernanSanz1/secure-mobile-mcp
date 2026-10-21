package com.aster.data.crypto

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.PublicKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages cryptographic keys for secure device authentication.
 *
 * Uses Android Keystore to securely generate and store an ECDSA P-256 keypair.
 * The private key never leaves the secure hardware (TEE/StrongBox when available).
 *
 * Note: Android Keystore does not natively support Ed25519/X25519.
 * We use ECDSA P-256 (secp256r1) which provides equivalent security and is
 * hardware-backed on all modern Android devices.
 */
@Singleton
class KeyManager @Inject constructor(
    private val context: Context
) {
    companion object {
        private const val TAG = "KeyManager"
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val KEY_ALIAS = "aster_device_identity"
        private const val SIGNATURE_ALGORITHM = "SHA256withECDSA"
    }

    private val keyStore: KeyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply {
        load(null)
    }

    /**
     * Check if device identity keys exist.
     */
    fun hasKeys(): Boolean {
        return try {
            keyStore.containsAlias(KEY_ALIAS)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking key existence", e)
            false
        }
    }

    /**
     * Generate new device identity keypair.
     * Keys are stored in Android Keystore and protected by hardware if available.
     */
    suspend fun generateKeys(): Result<PublicKey> = withContext(Dispatchers.IO) {
        try {
            // Delete existing key if present
            if (keyStore.containsAlias(KEY_ALIAS)) {
                keyStore.deleteEntry(KEY_ALIAS)
            }

            val keyPairGenerator = KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_EC,
                KEYSTORE_PROVIDER
            )

            val parameterSpec = KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(false)
                // Prevent key from being exported
                .setInvalidatedByBiometricEnrollment(false)
                .build()

            keyPairGenerator.initialize(parameterSpec)
            val keyPair: KeyPair = keyPairGenerator.generateKeyPair()

            Log.i(TAG, "Generated new device identity keypair")
            Result.success(keyPair.public)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to generate keys", e)
            Result.failure(e)
        }
    }

    /**
     * Get the public key as Base64 encoded string for transmission.
     */
    fun getPublicKeyBase64(): String? {
        return try {
            val publicKey = keyStore.getCertificate(KEY_ALIAS)?.publicKey
            publicKey?.let {
                Base64.encodeToString(it.encoded, Base64.NO_WRAP)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get public key", e)
            null
        }
    }

    /**
     * Get the public key fingerprint (SHA-256, first 8 bytes, colon-separated hex).
     */
    fun getPublicKeyFingerprint(): String? {
        return try {
            val publicKey = keyStore.getCertificate(KEY_ALIAS)?.publicKey ?: return null
            val digest = MessageDigest.getInstance("SHA-256")
            val hash = digest.digest(publicKey.encoded)
            hash.take(8)
                .joinToString(":") { byte -> "%02X".format(byte) }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to compute fingerprint", e)
            null
        }
    }

    /**
     * Sign data with the device's private key.
     *
     * @param data The data to sign
     * @return Base64-encoded signature, or null on error
     */
    fun sign(data: ByteArray): String? {
        return try {
            val privateKey = keyStore.getKey(KEY_ALIAS, null) as? PrivateKey
                ?: throw IllegalStateException("Private key not found")

            val signature = Signature.getInstance(SIGNATURE_ALGORITHM)
            signature.initSign(privateKey)
            signature.update(data)
            val signedBytes = signature.sign()

            Base64.encodeToString(signedBytes, Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sign data", e)
            null
        }
    }

    /**
     * Sign an authentication payload (deviceId + timestamp).
     *
     * @param deviceId The device identifier
     * @param timestamp Unix timestamp in milliseconds
     * @return Base64-encoded signature, or null on error
     */
    fun signAuthPayload(deviceId: String, timestamp: Long): String? {
        val payload = "$deviceId:$timestamp".toByteArray(Charsets.UTF_8)
        return sign(payload)
    }

    /**
     * Verify a signature using a provided public key.
     * Used to verify server signatures.
     *
     * @param data The original data
     * @param signatureBase64 The Base64-encoded signature
     * @param publicKeyBase64 The Base64-encoded public key
     * @return true if signature is valid
     */
    fun verify(data: ByteArray, signatureBase64: String, publicKeyBase64: String): Boolean {
        return try {
            val signatureBytes = Base64.decode(signatureBase64, Base64.NO_WRAP)
            val publicKeyBytes = Base64.decode(publicKeyBase64, Base64.NO_WRAP)

            val keyFactory = java.security.KeyFactory.getInstance("EC")
            val publicKey = keyFactory.generatePublic(
                java.security.spec.X509EncodedKeySpec(publicKeyBytes)
            )

            val signature = Signature.getInstance(SIGNATURE_ALGORITHM)
            signature.initVerify(publicKey)
            signature.update(data)
            signature.verify(signatureBytes)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to verify signature", e)
            false
        }
    }

    /**
     * Delete all stored keys. Used when unpairing from server.
     */
    suspend fun deleteKeys() = withContext(Dispatchers.IO) {
        try {
            if (keyStore.containsAlias(KEY_ALIAS)) {
                keyStore.deleteEntry(KEY_ALIAS)
                Log.i(TAG, "Deleted device identity keys")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete keys", e)
        }
    }
}
