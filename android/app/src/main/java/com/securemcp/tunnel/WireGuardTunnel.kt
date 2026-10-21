package com.securemcp.tunnel

import android.content.Context
import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.util.Log
import com.securemcp.data.model.TunnelConfig
import com.securemcp.data.model.TunnelState
import com.securemcp.data.model.TunnelStats
import com.wireguard.config.Config
import com.wireguard.config.InetEndpoint
import com.wireguard.config.InetNetwork
import com.wireguard.config.Interface
import com.wireguard.config.Peer
import com.wireguard.crypto.Key
import com.wireguard.crypto.KeyPair
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.net.InetAddress
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WireGuardTunnel @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val TAG = "WireGuardTunnel"
        private const val MTU = 1280
    }

    private val _state = MutableStateFlow<TunnelState>(TunnelState.Disconnected)
    val state: StateFlow<TunnelState> = _state.asStateFlow()

    private var tunnelInterface: ParcelFileDescriptor? = null
    private var config: Config? = null
    private var statsJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO)

    fun generateKeyPair(): Pair<String, String> {
        val keyPair = KeyPair()
        return Pair(keyPair.privateKey.toBase64(), keyPair.publicKey.toBase64())
    }

    fun buildConfig(tunnelConfig: TunnelConfig): Config {
        val privateKey = Key.fromBase64(tunnelConfig.privateKey)
        val serverPublicKey = Key.fromBase64(tunnelConfig.publicKey)

        val interfaceBuilder = Interface.Builder()
            .parsePrivateKey(tunnelConfig.privateKey)
            .parseAddresses(tunnelConfig.address)
            .parseDnsServers(tunnelConfig.dns)

        val peerBuilder = Peer.Builder()
            .parsePublicKey(tunnelConfig.publicKey)
            .parseEndpoint(tunnelConfig.endpoint)
            .parseAllowedIPs(tunnelConfig.allowedIps)
            .parsePersistentKeepalive(tunnelConfig.persistentKeepalive.toString())

        return Config.Builder()
            .setInterface(interfaceBuilder.build())
            .addPeer(peerBuilder.build())
            .build()
    }

    fun connect(vpnService: VpnService, tunnelConfig: TunnelConfig): Boolean {
        return try {
            _state.value = TunnelState.Connecting

            config = buildConfig(tunnelConfig)
            val iface = config!!.`interface`

            val builder = vpnService.Builder()
                .setMtu(MTU)
                .setSession("SecureMCP")
                .setBlocking(true)

            // Add addresses
            for (addr in iface.addresses) {
                builder.addAddress(addr.address, addr.mask)
            }

            // Add DNS servers
            for (dns in iface.dnsServers) {
                builder.addDnsServer(dns)
            }

            // Add routes from allowed IPs
            for (peer in config!!.peers) {
                for (route in peer.allowedIps) {
                    builder.addRoute(route.address, route.mask)
                }
            }

            // Exclude app from VPN to avoid loops
            builder.addDisallowedApplication(context.packageName)

            tunnelInterface = builder.establish()

            if (tunnelInterface != null) {
                _state.value = TunnelState.Connected()
                startStatsCollection()
                Log.i(TAG, "Tunnel connected successfully")
                true
            } else {
                _state.value = TunnelState.Error("Failed to establish tunnel")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to connect tunnel", e)
            _state.value = TunnelState.Error(e.message ?: "Unknown error")
            false
        }
    }

    fun disconnect() {
        statsJob?.cancel()
        statsJob = null

        try {
            tunnelInterface?.close()
            tunnelInterface = null
            config = null
            _state.value = TunnelState.Disconnected
            Log.i(TAG, "Tunnel disconnected")
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting tunnel", e)
        }
    }

    private fun startStatsCollection() {
        statsJob?.cancel()
        statsJob = scope.launch {
            while (isActive && tunnelInterface != null) {
                // In production, collect actual stats from the tunnel
                val currentState = _state.value
                if (currentState is TunnelState.Connected) {
                    _state.value = TunnelState.Connected(
                        stats = TunnelStats(
                            rxBytes = 0, // Would come from actual tunnel
                            txBytes = 0,
                            lastHandshake = System.currentTimeMillis()
                        )
                    )
                }
                delay(5000)
            }
        }
    }

    fun isConnected(): Boolean = tunnelInterface != null && _state.value is TunnelState.Connected
}
