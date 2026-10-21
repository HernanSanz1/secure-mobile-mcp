package com.securemcp.ui.viewmodel

import android.app.Application
import android.content.Context
import android.net.VpnService
import android.provider.Settings
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.securemcp.data.local.CommandLogDao
import com.securemcp.data.local.CommandLogEntity
import com.securemcp.data.local.SettingsDataStore
import com.securemcp.data.model.ServerConfig
import com.securemcp.data.model.TunnelConfig
import com.securemcp.data.model.TunnelState
import com.securemcp.service.AutomationAccessibilityService
import com.securemcp.service.McpCommandService
import com.securemcp.service.TunnelService
import com.securemcp.tunnel.WireGuardTunnel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class MainUiState(
    val tunnelState: TunnelState = TunnelState.Disconnected,
    val mcpConnected: Boolean = false,
    val accessibilityEnabled: Boolean = false,
    val serverConfig: ServerConfig? = null,
    val tunnelConfig: TunnelConfig? = null,
    val autoConnect: Boolean = false,
    val logs: List<CommandLogEntity> = emptyList()
)

sealed class MainEvent {
    data object RequestVpnPermission : MainEvent()
    data class ShowError(val message: String) : MainEvent()
    data class ShowMessage(val message: String) : MainEvent()
}

@HiltViewModel
class MainViewModel @Inject constructor(
    private val application: Application,
    private val settingsDataStore: SettingsDataStore,
    private val tunnel: WireGuardTunnel,
    private val commandLogDao: CommandLogDao
) : AndroidViewModel(application) {

    private val _events = MutableStateFlow<MainEvent?>(null)
    val events: StateFlow<MainEvent?> = _events.asStateFlow()

    val uiState: StateFlow<MainUiState> = combine(
        tunnel.state,
        McpCommandService.connectionState,
        settingsDataStore.serverConfig,
        settingsDataStore.tunnelConfig,
        settingsDataStore.autoConnect,
        commandLogDao.getRecentLogs(50)
    ) { values ->
        @Suppress("UNCHECKED_CAST")
        MainUiState(
            tunnelState = values[0] as TunnelState,
            mcpConnected = values[1] as Boolean,
            accessibilityEnabled = AutomationAccessibilityService.isEnabled(),
            serverConfig = values[2] as ServerConfig?,
            tunnelConfig = values[3] as TunnelConfig?,
            autoConnect = values[4] as Boolean,
            logs = values[5] as List<CommandLogEntity>
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = MainUiState()
    )

    fun connectTunnel() {
        viewModelScope.launch {
            val vpnIntent = TunnelService.prepare(application)
            if (vpnIntent != null) {
                _events.value = MainEvent.RequestVpnPermission
                return@launch
            }
            TunnelService.connect(application)
        }
    }

    fun disconnectTunnel() {
        TunnelService.disconnect(application)
    }

    fun startMcpService() {
        McpCommandService.start(application)
    }

    fun stopMcpService() {
        McpCommandService.stop(application)
    }

    fun saveServerConfig(host: String, port: Int, token: String?) {
        viewModelScope.launch {
            val config = ServerConfig(host = host, port = port, token = token)
            settingsDataStore.saveServerConfig(config)
            _events.value = MainEvent.ShowMessage("Server configuration saved")
        }
    }

    fun saveTunnelConfig(config: TunnelConfig) {
        viewModelScope.launch {
            settingsDataStore.saveTunnelConfig(config)
            _events.value = MainEvent.ShowMessage("Tunnel configuration saved")
        }
    }

    fun setAutoConnect(enabled: Boolean) {
        viewModelScope.launch {
            settingsDataStore.setAutoConnect(enabled)
        }
    }

    fun generateKeyPair(): Pair<String, String> {
        return tunnel.generateKeyPair()
    }

    fun clearLogs() {
        viewModelScope.launch {
            commandLogDao.clearAll()
        }
    }

    fun consumeEvent() {
        _events.value = null
    }

    fun isAccessibilityServiceEnabled(): Boolean {
        return AutomationAccessibilityService.isEnabled()
    }

    fun getAccessibilitySettingsIntent(): android.content.Intent {
        return android.content.Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
    }
}
